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
  boxId?: string; // 新增：所属收纳盒ID
}

export interface SharedBox {
  id: string;
  name: string;
  description?: string;
  color: string; // 渐变色样式
  createdAt: number;
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
    if (globalSymbols.__file_service_instance__ && (
      typeof globalSymbols.__file_service_instance__.registerTransferTask !== 'function' ||
      typeof globalSymbols.__file_service_instance__.createSharedBox !== 'function'
    )) {
      console.warn('[FileService] 检测到 Next.js 热重载全局残留旧版单例，正在强制清空并重新初始化新版单例...');
      globalSymbols.__file_service_instance__ = null;
    }

    if (!globalSymbols.__file_service_instance__) {
      globalSymbols.__file_service_instance__ = new FileService();
    }
    return globalSymbols.__file_service_instance__;
  }

  /**
   * 运行时存储路径变更自愈：重新同步获取最新的 physical 物理存储绝对路径对齐
   */
  public reloadService(): void {
    const configService = ConfigService.getInstance();
    this.downloadsDir = configService.getStoragePath();
    console.log('[FileService] [自愈] 运行时由于存储路径变更，已成功同步刷新物理存储绝对路径！');
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
    const sharedDir = this.getSharedDir();
    
    // 1. 读取元数据索引文件中的共享文件
    let indexedFiles: SharedFile[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        indexedFiles = JSON.parse(data);
      } catch (err) {
        console.error('[FileService] 读取共享文件元数据失败，将重新构建:', err);
      }
    }

    // 2. 读取物理共享目录中的实际文件列表
    let physicalFiles: string[] = [];
    if (fs.existsSync(sharedDir)) {
      try {
        physicalFiles = fs.readdirSync(sharedDir);
      } catch (err) {
        console.error('[FileService] 读取物理共享目录失败:', err);
      }
    }

    // 3. 物理文件校验：保留索引中记录且在磁盘上真实存在的文件
    const validIndexedFiles = indexedFiles.filter(f => {
      try {
        return fs.existsSync(f.filePath);
      } catch {
        return false;
      }
    });

    // 3.5. 强力防重清洗：若多个索引对象指向同一物理文件路径，优先保留具有真实物理设备信息（非自愈导入）的那条
    const uniqueFilesMap = new Map<string, SharedFile>();
    validIndexedFiles.forEach(file => {
      const resolvedPath = path.resolve(file.filePath);
      const existing = uniqueFilesMap.get(resolvedPath);
      if (!existing) {
        uniqueFilesMap.set(resolvedPath, file);
      } else {
        if (existing.deviceInfo === '本地存储自愈导入' && file.deviceInfo !== '本地存储自愈导入') {
          uniqueFilesMap.set(resolvedPath, file);
        }
      }
    });
    const uniqueIndexedFiles = Array.from(uniqueFilesMap.values());

    // 4. 物理文件自愈重建索引：如果有物理文件没有在 validIndexedFiles 中记录，则自动登记
    let hasChanges = uniqueIndexedFiles.length !== indexedFiles.length;
    const finalFiles = [...uniqueIndexedFiles];

    physicalFiles.forEach(fileName => {
      const fullPath = path.join(sharedDir, fileName);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          // 检查该物理文件是否已经在索引中注册 (通过绝对路径或文件名比对)
          const isRegistered = finalFiles.some(f => {
            return path.resolve(f.filePath) === path.resolve(fullPath) || f.fileName === fileName;
          });

          // 增加 5 秒创建时间保护缓冲区，避免因大文件分片合并落盘瞬间尚未登记元数据而被误判为未登记的物理文件
          const isRecent = (Date.now() - (stat.mtimeMs || stat.birthtimeMs || Date.now())) < 5000;

          if (!isRegistered && !isRecent) {
            // 自动补全登记元数据
            const fileId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newFile: SharedFile = {
              id: fileId,
              fileName,
              fileSize: stat.size,
              uploadedAt: stat.mtimeMs || stat.birthtimeMs || Date.now(),
              deviceInfo: '本地存储自愈导入',
              filePath: fullPath
            };
            finalFiles.push(newFile);
            hasChanges = true;
            console.log(`[FileService] [自愈] 检测到未索引的物理文件，已自动重建索引: ${fileName}`);
          }
        }
      } catch (err) {
        console.error(`[FileService] 获取物理文件属性失败: ${fileName}`, err);
      }
    });

    // 5. 如果有新增元数据或过期元数据被清洗，自动写回索引文件
    if (hasChanges) {
      this.writeSharedFilesMetadata(finalFiles);
    }

    // 6. 按上传时间降序排序返回
    return finalFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);
  }

  /**
   * 注册一个公共共享文件
   */
  public registerSharedFile(id: string, fileName: string, fileSize: number, filePath: string, deviceInfo: string, boxId?: string): void {
    // 1. 先安全读取元数据索引文件，将当前新文件提前登记，解决物理合并落盘瞬时与 getSharedFiles() 产生的 Race Condition
    let indexedFiles: SharedFile[] = [];
    const metaPath = this.getSharedFilesPath();
    if (fs.existsSync(metaPath)) {
      try {
        const data = fs.readFileSync(metaPath, 'utf-8');
        indexedFiles = JSON.parse(data);
      } catch (err) {
        console.error('[FileService] 提前读取元数据失败:', err);
      }
    }

    const newFile: SharedFile = {
      id,
      fileName,
      fileSize,
      uploadedAt: Date.now(),
      deviceInfo,
      filePath,
      boxId: boxId || undefined
    };

    // 剔除相同 id
    const filtered = indexedFiles.filter(f => f.id !== id);
    filtered.push(newFile);

    // 提前写回元数据，使随后的 getSharedFiles 物理文件自愈扫描中能够正确识别“已登记”
    this.writeSharedFilesMetadata(filtered);

    // 2. 然后，再调用包含自愈与物理清洗的 getSharedFiles 得到最新的干净列表
    const cleanFiles = this.getSharedFiles();

    console.log(`[FileService] 公共共享文件已保存并写入索引: ${fileName} (${id})`);

    // 3. 广播事件通知局域网所有在线伙伴
    SocketService.getInstance().broadcast('shared-files:update', cleanFiles);
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
      if (tasks[taskId].status !== 'rejected' && tasks[taskId].status !== 'failed') {
        tasks[taskId].status = 'completed';
        tasks[taskId].progress = 100;
        this.writeTransferTasks(tasks);
      }
    }
  }

  // 物理擦除任何互传暂存文件，并更新指定任务状态 (用于拒绝或取消)
  public cancelAndCleanupTransfer(taskId: string, finalStatus: 'failed' | 'rejected'): void {
    const tasks = this.getTransferTasks();
    const upload = this.uploadTasks.get(taskId);
    
    // 1. 双重物理文件擦除
    if (upload) {
      try {
        if (fs.existsSync(upload.filePath)) {
          fs.unlinkSync(upload.filePath);
          console.log(`[FileService] [取消/拒绝] 已物理清理发送端暂存文件: ${upload.filePath}`);
        }
      } catch (err) {
        console.error(`[FileService] [取消/拒绝] 物理清理暂存文件失败: ${upload.filePath}`, err);
      }
      this.uploadTasks.delete(taskId);
    } else {
      // 兜底路径计算强行 unlink
      const cacheDir = path.join(process.cwd(), 'upload_cache');
      const possiblePath = path.join(cacheDir, taskId);
      try {
        if (fs.existsSync(possiblePath)) {
          fs.unlinkSync(possiblePath);
          console.log(`[FileService] [取消/拒绝/兜底] 已通过路径物理清理暂存文件: ${possiblePath}`);
        }
      } catch (err) {
        console.error(`[FileService] [取消/拒绝/兜底] 物理清理暂存文件失败: ${possiblePath}`, err);
      }
    }
    
    // 2. 更新任务状态持久化落盘
    if (tasks[taskId]) {
      tasks[taskId].status = finalStatus;
      tasks[taskId].progress = 0;
      this.writeTransferTasks(tasks);
      console.log(`[FileService] 任务 ${taskId} 状态已更新为 ${finalStatus} 并成功落盘`);
    }
  }

  /**
   * 物理删除指定的互传任务记录
   */
  public deleteTransferTask(taskId: string): void {
    const tasks = this.getTransferTasks();
    if (tasks[taskId]) {
      delete tasks[taskId];
      this.writeTransferTasks(tasks);
      console.log(`[FileService] 已物理删除互传任务记录: ${taskId}`);
    }
  }

  /**
   * 一键清空该客户端所有已完结的互传任务记录
   */
  public clearHistoryTransferTasks(clientId: string): void {
    const tasks = this.getTransferTasks();
    let hasChanges = false;
    Object.keys(tasks).forEach(taskId => {
      const t = tasks[taskId];
      if (
        t &&
        (t.senderId === clientId || t.peerId === clientId || t.receiverId === clientId) &&
        (t.status === 'completed' || t.status === 'failed' || t.status === 'rejected')
      ) {
        delete tasks[taskId];
        hasChanges = true;
      }
    });
    if (hasChanges) {
      this.writeTransferTasks(tasks);
      console.log(`[FileService] 已清空客户端 ${clientId} 所有完结的物理互传任务记录`);
    }
  }

  /**
   * 获取共享收纳盒元数据文件路径
   */
  private getSharedBoxesPath(): string {
    const storageDir = ConfigService.getInstance().getStoragePath();
    return path.join(storageDir, 'shared_boxes.json');
  }

  /**
   * 获取所有注册的公共共享收纳盒列表
   */
  public getSharedBoxes(): SharedBox[] {
    const filePath = this.getSharedBoxesPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[FileService] 读取收纳盒元数据失败:', err);
      return [];
    }
  }

  /**
   * 将收纳盒列表元数据写入 JSON
   */
  private writeSharedBoxesMetadata(boxes: SharedBox[]): void {
    const filePath = this.getSharedBoxesPath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(boxes, null, 2), 'utf-8');
    } catch (err) {
      console.error('[FileService] 写入收纳盒元数据失败:', err);
    }
  }

  /**
   * 创建一个全新的共享收纳盒
   */
  public createSharedBox(name: string, description?: string, color?: string): SharedBox {
    const boxes = this.getSharedBoxes();
    const boxId = `box_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 默认高质感炫彩渐变色预设 (HSL Tailormade Rich Aesthetics Gradients)
    const defaultGradients = [
      'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', // 熔岩橙
      'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)', // 霓虹紫
      'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)', // 极光蓝
      'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', // 翡翠绿
      'linear-gradient(135deg, #f12711 0%, #f5af19 100%)'  // 日落金
    ];
    
    const selectedColor = color || defaultGradients[boxes.length % defaultGradients.length];

    const newBox: SharedBox = {
      id: boxId,
      name,
      description,
      color: selectedColor,
      createdAt: Date.now()
    };

    boxes.push(newBox);
    this.writeSharedBoxesMetadata(boxes);
    
    console.log(`[FileService] 收纳盒已成功创建并保存: ${name} (${boxId})`);

    // 广播最新的收纳盒列表给局域网所有在线伙伴
    SocketService.getInstance().broadcast('shared-boxes:update', boxes);
    
    return newBox;
  }

  /**
   * 物理删除某个共享收纳盒 (非破坏性：仅将属于它的文件移回大厅未分类，防止物理文件丢失)
   */
  public deleteSharedBox(boxId: string): boolean {
    const boxes = this.getSharedBoxes();
    const filteredBoxes = boxes.filter(b => b.id !== boxId);
    if (boxes.length === filteredBoxes.length) {
      return false;
    }

    // 1. 写回收纳盒元数据
    this.writeSharedBoxesMetadata(filteredBoxes);

    // 2. 清洗文件元数据：将该盒子下的所有文件安全释放（重置 boxId 为 undefined）
    const files = this.getSharedFiles();
    let hasChanges = false;
    const updatedFiles = files.map(file => {
      if (file.boxId === boxId) {
        hasChanges = true;
        const { boxId: _, ...rest } = file; // 剔除 boxId
        return rest;
      }
      return file;
    });

    if (hasChanges) {
      this.writeSharedFilesMetadata(updatedFiles);
      // 广播更新文件列表
      SocketService.getInstance().broadcast('shared-files:update', updatedFiles.sort((a, b) => b.uploadedAt - a.uploadedAt));
    }

    console.log(`[FileService] 收纳盒 ${boxId} 已被成功删除，受影响文件已安全释放回未分类大厅`);

    // 3. 广播更新收纳盒列表
    SocketService.getInstance().broadcast('shared-boxes:update', filteredBoxes);
    return true;
  }

  /**
   * 将指定的一个或多个共享文件转移到特定收纳盒中 (移出为 null)
   */
  public moveFilesToBox(fileIds: string[], boxId: string | null): boolean {
    const files = this.getSharedFiles();
    let hasChanges = false;
    
    const updatedFiles = files.map(file => {
      if (fileIds.includes(file.id)) {
        hasChanges = true;
        if (boxId) {
          return { ...file, boxId };
        } else {
          const { boxId: _, ...rest } = file;
          return rest;
        }
      }
      return file;
    });

    if (hasChanges) {
      this.writeSharedFilesMetadata(updatedFiles);
      const sorted = updatedFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);
      console.log(`[FileService] 成功将 ${fileIds.length} 个文件转移到收纳盒: ${boxId || '未分类大厅'}`);
      // 广播更新
      SocketService.getInstance().broadcast('shared-files:update', sorted);
      return true;
    }
    
    return false;
  }
}
