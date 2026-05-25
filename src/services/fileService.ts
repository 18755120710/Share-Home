import fs from 'fs';
import path from 'path';
import http from 'http';
import { TransferTask } from '../types/transfer';
import { SocketService } from './socketService';
import { ConfigService } from './configService';

export interface FileMetadata {
  taskId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
}

export interface SharedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  deviceInfo: string;
  filePath: string;
}

export class FileService {
  // 共享下载文件夹目录
  private downloadsDir: string;
  
  // 维护正在上传 (提供下载) 的文件映射: Key 为 taskId
  private uploadTasks: Map<string, FileMetadata> = new Map();
  
  // 维护正在下载的 HTTP 任务
  private downloadTasks: Map<string, {
    task: TransferTask;
    request?: http.ClientRequest;
    writer?: fs.WriteStream;
  }> = new Map();

  private constructor() {
    // 动态获取由 ConfigService 提供的存储路径
    const configService = ConfigService.getInstance();
    this.downloadsDir = configService.getStoragePath();
  }

  public static getInstance(): FileService {
    const globalSymbols = global as any;
    // 热重载自愈：若全局单例残留了旧方法，强制清空以在下一句重新 new 挂载新定义！
    if (globalSymbols.__file_service_instance__ && typeof globalSymbols.__file_service_instance__.registerTransferTask !== 'function') {
      console.warn('[FileService] 检测到 Next.js 热重载全局残留旧版单例，正在强制清空并重新初始化新版单例...');
      globalSymbols.__file_service_instance__ = null;
    }

    if (!globalSymbols.__file_service_instance__) {
      globalSymbols.__file_service_instance__ = new FileService();
    }
    return globalSymbols.__file_service_instance__;
  }

  /**
   * 注册一个发送文件的本地任务，生成临时可下载映射
   */
  public registerUpload(taskId: string, filePath: string, fileName: string, fileSize: number): void {
    this.uploadTasks.set(taskId, { taskId, filePath, fileName, fileSize });
    console.log(`[FileService] 已注册本地上传映射: ${fileName} (${taskId})`);
  }

  public getUpload(taskId: string): FileMetadata | undefined {
    return this.uploadTasks.get(taskId);
  }

  /**
   * 启动极速 HTTP 客户端，从对端 Peer 极速拉取文件，支持断点续传
   */
  public startDownload(
    taskId: string,
    fileName: string,
    fileSize: number,
    downloadUrl: string,
    peerId: string,
    peerName: string
  ): void {
    const currentStorageDir = ConfigService.getInstance().getStoragePath();
    const savePath = path.join(currentStorageDir, fileName);
    
    // 检查是否已有下载任务，支持从上次的断点处继续下载
    let offset = 0;
    if (fs.existsSync(savePath)) {
      const stat = fs.statSync(savePath);
      // 如果文件已经下载完成，直接标记成功
      if (stat.size >= fileSize) {
        console.log(`[FileService] 文件 ${fileName} 已经存在且大小匹配，下载完成。`);
        this.notifyDownloadComplete(taskId, savePath);
        return;
      }
      offset = stat.size; // 获取已下载的大小作为偏移量
    }

    console.log(`[FileService] 启动高速流式下载: ${fileName}, 偏移: ${offset} B, 地址: ${downloadUrl}`);

    const task: TransferTask = {
      id: taskId,
      fileName,
      fileSize,
      transferredBytes: offset,
      progress: Math.round((offset / fileSize) * 100),
      speed: 0,
      type: 'receive',
      status: 'transferring',
      peerId,
      peerName,
      startedAt: Date.now()
    };

    // 创建写文件流 (r+ 或 a 模式追加写入)
    const writer = fs.createWriteStream(savePath, {
      flags: offset > 0 ? 'r+' : 'w',
      start: offset
    });

    // 解析请求 URL
    const url = new URL(downloadUrl);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        // 使用 HTTP Range 请求实现断点续传
        'Range': `bytes=${offset}-`
      }
    };

    let lastTime = Date.now();
    let lastBytes = offset;

    const req = http.get(options, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        task.status = 'failed';
        task.error = `HTTP 错误代码: ${res.statusCode}`;
        this.broadcastProgress(task);
        writer.end();
        return;
      }

      res.on('data', (chunk) => {
        writer.write(chunk);
        task.transferredBytes += chunk.length;
        
        // 限制进度广播频率，防止卡顿，每 200ms 计算一次速度
        const now = Date.now();
        const duration = (now - lastTime) / 1000;
        if (duration >= 0.2) {
          const bytesDiff = task.transferredBytes - lastBytes;
          task.speed = Math.round(bytesDiff / duration);
          task.progress = Math.round((task.transferredBytes / fileSize) * 100);
          
          this.broadcastProgress(task);
          
          lastTime = now;
          lastBytes = task.transferredBytes;
        }
      });

      res.on('end', () => {
        writer.end();
        if (task.transferredBytes >= fileSize) {
          task.status = 'completed';
          task.speed = 0;
          task.progress = 100;
          console.log(`[FileService] 文件下载成功: ${fileName}`);
          this.broadcastProgress(task);
        } else {
          task.status = 'paused';
          task.speed = 0;
          console.log(`[FileService] 下载被意外中止: ${fileName}`);
          this.broadcastProgress(task);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[FileService] 下载请求发生网络异常:', err);
      task.status = 'failed';
      task.error = err.message;
      this.broadcastProgress(task);
      writer.end();
    });

    // 缓存下载句柄以供取消/暂停使用
    this.downloadTasks.set(taskId, { task, request: req, writer });
    this.broadcastProgress(task);
  }

  /**
   * 暂停或取消下载任务
   */
  public pauseDownload(taskId: string): void {
    const handle = this.downloadTasks.get(taskId);
    if (handle) {
      if (handle.request) {
        handle.request.destroy();
      }
      if (handle.writer) {
        handle.writer.end();
      }
      handle.task.status = 'paused';
      handle.task.speed = 0;
      this.broadcastProgress(handle.task);
      console.log(`[FileService] 已暂停任务: ${handle.task.fileName}`);
    }
  }

  /**
   * 移除或删除下载任务记录
   */
  public removeDownload(taskId: string): void {
    this.pauseDownload(taskId);
    this.downloadTasks.delete(taskId);
  }

  /**
   * 广播进度给前端
   */
  private broadcastProgress(task: TransferTask): void {
    SocketService.getInstance().broadcast('transfer:progress', task);
  }

  private notifyDownloadComplete(taskId: string, filePath: string): void {
    SocketService.getInstance().broadcast('transfer:complete', {
      taskId,
      filePath,
      timestamp: Date.now()
    });
  }

  public getDownloadsDir(): string {
    return ConfigService.getInstance().getStoragePath();
  }

  /**
   * 获取共享文件元数据文件路径
   */
  private getSharedFilesPath(): string {
    const storageDir = ConfigService.getInstance().getStoragePath();
    return path.join(storageDir, 'shared_files.json');
  }

  /**
   * 获取公共共享物理目录
   */
  public getSharedDir(): string {
    const storageDir = ConfigService.getInstance().getStoragePath();
    const sharedDir = path.join(storageDir, 'shared');
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    return sharedDir;
  }

  /**
   * 将共享文件列表元数据写入 JSON
   */
  private writeSharedFilesMetadata(files: SharedFile[]): void {
    const filePath = this.getSharedFilesPath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(files, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FileService] 写入共享文件元数据失败:', err);
    }
  }

  /**
   * 获取所有注册的公共共享文件列表，并自动清洗无效的丢失文件
   */
  public getSharedFiles(): SharedFile[] {
    const filePath = this.getSharedFilesPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const files: SharedFile[] = JSON.parse(data);
      
      // 物理文件校验，确保文件在磁盘上真实存在
      const validFiles = files.filter(f => {
        try {
          return fs.existsSync(f.filePath);
        } catch {
          return false;
        }
      });
      
      // 自动修正同步
      if (validFiles.length !== files.length) {
        this.writeSharedFilesMetadata(validFiles);
      }
      
      return validFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);
    } catch (err) {
      console.error('[FileService] 读取共享文件元数据失败:', err);
      return [];
    }
  }

  /**
   * 注册一个公共共享文件
   */
  public registerSharedFile(id: string, fileName: string, fileSize: number, filePath: string, deviceInfo: string): void {
    const files = this.getSharedFiles();
    const newFile: SharedFile = {
      id,
      fileName,
      fileSize,
      uploadedAt: Date.now(),
      deviceInfo,
      filePath
    };

    const filtered = files.filter(f => f.id !== id);
    filtered.push(newFile);

    this.writeSharedFilesMetadata(filtered);
    console.log(`[FileService] 公共共享文件已保存并写入索引: ${fileName} (${id})`);

    // 广播事件通知局域网所有在线伙伴
    SocketService.getInstance().broadcast('shared-files:update', filtered.sort((a, b) => b.uploadedAt - a.uploadedAt));
  }

  /**
   * 获取指定公共文件详情
   */
  public getSharedFile(id: string): SharedFile | undefined {
    const files = this.getSharedFiles();
    return files.find(f => f.id === id);
  }

  /**
   * 物理删除某个公共共享文件
   */
  public deleteSharedFile(id: string): boolean {
    const files = this.getSharedFiles();
    const target = files.find(f => f.id === id);
    if (!target) return false;

    // 1. 从物理磁盘中删除
    try {
      if (fs.existsSync(target.filePath)) {
        fs.unlinkSync(target.filePath);
        console.log(`[FileService] 共享物理文件已从磁盘中彻底清除: ${target.filePath}`);
      }
    } catch (err) {
      console.error(`[FileService] 物理删除共享文件失败: ${target.filePath}`, err);
    }

    // 2. 清理元数据索引
    const filtered = files.filter(f => f.id !== id);
    this.writeSharedFilesMetadata(filtered);

    // 3. 广播更新
    SocketService.getInstance().broadcast('shared-files:update', filtered.sort((a, b) => b.uploadedAt - a.uploadedAt));
    return true;
  }

  // 缓存互传任务索引文件路径
  private getTransferTasksPath(): string {
    const storageDir = ConfigService.getInstance().getStoragePath();
    return path.join(storageDir, 'transfer_tasks.json');
  }

  // 从物理磁盘读取互传任务列表
  public getTransferTasks(): Record<string, any> {
    const filePath = this.getTransferTasksPath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[FileService] 读取互传任务列表失败:', err);
      return {};
    }
  }

  // 物理写入互传任务列表
  private writeTransferTasks(tasks: Record<string, any>): void {
    const filePath = this.getTransferTasksPath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FileService] 写入互传任务列表失败:', err);
    }
  }

  // 注册或更新一个互传任务
  public registerTransferTask(taskId: string, task: any): void {
    const tasks = this.getTransferTasks();
    tasks[taskId] = {
      ...tasks[taskId],
      ...task,
      updatedAt: Date.now()
    };
    this.writeTransferTasks(tasks);
    console.log(`[FileService] 已持久化注册/更新互传任务: ${task.fileName} (${taskId})`);
  }

  // 获取特定客户端的 pending 状态任务 (用于补发提醒/自愈)
  public getPendingTasksForClient(clientId: string): any[] {
    const tasks = this.getTransferTasks();
    return Object.values(tasks).filter((t: any) => t.peerId === clientId && t.status === 'pending');
  }

  // 清理互传物理大文件，并在任务清单中更新状态为已删除
  public cleanupTransferFile(taskId: string): void {
    const upload = this.uploadTasks.get(taskId);
    const tasks = this.getTransferTasks();
    
    if (upload) {
      try {
        if (fs.existsSync(upload.filePath)) {
          fs.unlinkSync(upload.filePath);
          console.log(`[FileService] [自愈] 接收端已下载完毕，已物理清理发送端暂存文件: ${upload.filePath}`);
        }
      } catch (err) {
        console.error(`[FileService] 物理清理暂存文件失败: ${upload.filePath}`, err);
      }
      this.uploadTasks.delete(taskId);
    }
    
    // 更新持久化状态
    if (tasks[taskId]) {
      tasks[taskId].status = 'completed';
      tasks[taskId].progress = 100;
      this.writeTransferTasks(tasks);
    }
  }
}
