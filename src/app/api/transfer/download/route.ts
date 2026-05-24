import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { FileService } from '@/services/fileService';
import { Readable } from 'stream';

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
    
    // 将 Node 可读流转换为 Web ReadableStream
    // @ts-ignore
    const webStream = Readable.toWeb(fileStream);

    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    headers.set('Content-Length', chunksize.toString());
    headers.set('Content-Type', 'application/octet-stream');

    return new Response(webStream as any, {
      status: 206, // Partial Content
      headers
    });
  } else {
    // 2. 正常下载整个文件
    const fileStream = fs.createReadStream(filePath);
    // @ts-ignore
    const webStream = Readable.toWeb(fileStream);

    headers.set('Content-Length', fileSize.toString());
    headers.set('Content-Type', 'application/octet-stream');

    return new Response(webStream as any, {
      status: 200,
      headers
    });
  }
}
