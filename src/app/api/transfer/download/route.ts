import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { FileService } from '@/services/fileService';
import { Readable } from 'stream';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return new NextResponse('缺少 taskId 参数', { status: 400 });
  }

  const uploadMetadata = FileService.getInstance().getUpload(taskId);
  if (!uploadMetadata) {
    return new NextResponse('任务不存在或已被注销', { status: 404 });
  }

  const { filePath, fileName, fileSize } = uploadMetadata;

  if (!fs.existsSync(filePath)) {
    return new NextResponse('文件物理路径不存在', { status: 410 });
  }

  const rangeHeader = request.headers.get('range');

  // 大文件流式处理头部
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  headers.set('Accept-Ranges', 'bytes');

  if (rangeHeader) {
    // 1. 处理断点续传 HTTP Range 请求 (格式: bytes=start-end)
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return new NextResponse('请求的范围不合法', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` }
      });
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    let transferredBytes = start;

    const customStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          transferredBytes += chunk.length;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));

          // 实时更新已读取进度
          const progress = Math.round((transferredBytes / fileSize) * 100);
          const SocketService = require('@/services/socketService').SocketService;
          const FileService = require('@/services/fileService').FileService;
          const taskInfo = FileService.getInstance().getTransferTasks()[taskId] || {};
          
          SocketService.getInstance().broadcast('transfer:progress', {
            id: taskId,
            fileName,
            fileSize,
            transferredBytes,
            progress,
            speed: 50 * 1024 * 1024,
            type: 'receive',
            status: progress >= 100 ? 'completed' : 'transferring',
            peerId: taskInfo.peerId || '',
            peerName: taskInfo.peerName || '',
            senderId: taskInfo.senderId || '',
            senderName: taskInfo.senderName || '',
            startedAt: Date.now()
          });
        });

        fileStream.on('end', () => {
          controller.close();
          // 如果全部字节已经拉取完，触发暂存文件物理删除自愈！
          if (transferredBytes >= fileSize - 1) {
            console.log(`[DownloadAPI] Range 流传输完毕，触发发送端大文件暂存物理删除. TaskId: ${taskId}`);
            const FileService = require('@/services/fileService').FileService;
            const fileService = FileService.getInstance();
            
            const tasks = fileService.getTransferTasks();
            if (tasks[taskId]) {
              tasks[taskId].status = 'completed';
              tasks[taskId].progress = 100;
              fileService.registerTransferTask(taskId, tasks[taskId]);
            }
            
            fileService.cleanupTransferFile(taskId);

            const SocketService = require('@/services/socketService').SocketService;
            SocketService.getInstance().broadcast('transfer:complete', { taskId, filePath });
          }
        });

        fileStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      }
    });

    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    headers.set('Content-Length', chunksize.toString());
    headers.set('Content-Type', 'application/octet-stream');

    return new Response(customStream as any, {
      status: 206, // Partial Content
      headers
    });
  } else {
    // 2. 正常下载整个文件
    const fileStream = fs.createReadStream(filePath);
    let transferredBytes = 0;

    const customStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => {
          transferredBytes += chunk.length;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));

          // 计算进度并高频广播
          const progress = Math.round((transferredBytes / fileSize) * 100);
          const SocketService = require('@/services/socketService').SocketService;
          const FileService = require('@/services/fileService').FileService;
          const taskInfo = FileService.getInstance().getTransferTasks()[taskId] || {};
          
          SocketService.getInstance().broadcast('transfer:progress', {
            id: taskId,
            fileName,
            fileSize,
            transferredBytes,
            progress,
            speed: 50 * 1024 * 1024,
            type: 'receive',
            status: progress >= 100 ? 'completed' : 'transferring',
            peerId: taskInfo.peerId || '',
            peerName: taskInfo.peerName || '',
            senderId: taskInfo.senderId || '',
            senderName: taskInfo.senderName || '',
            startedAt: Date.now()
          });
        });

        fileStream.on('end', () => {
          controller.close();
          console.log(`[DownloadAPI] 正常文件流接收结束，触发发送端暂存大文件物理删除自愈. TaskId: ${taskId}`);
          
          const FileService = require('@/services/fileService').FileService;
          const fileService = FileService.getInstance();
          
          // 更新持久化状态
          const tasks = fileService.getTransferTasks();
          if (tasks[taskId]) {
            tasks[taskId].status = 'completed';
            tasks[taskId].progress = 100;
            fileService.registerTransferTask(taskId, tasks[taskId]);
          }
          
          // 物理清理暂存大文件
          fileService.cleanupTransferFile(taskId);

          const SocketService = require('@/services/socketService').SocketService;
          SocketService.getInstance().broadcast('transfer:complete', { taskId, filePath });
        });

        fileStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      }
    });

    headers.set('Content-Length', fileSize.toString());
    headers.set('Content-Type', 'application/octet-stream');

    return new Response(customStream as any, {
      status: 200,
      headers
    });
  }
}
