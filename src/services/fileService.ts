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

export class FileService {
  private static instance: FileService | null = null;
  
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
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
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
}
