import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { FileService } from '@/services/fileService';
import { Readable } from 'stream';

// 辅助函数：根据文件名推导 Mime-Type
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg': return 'video/ogg';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    default: return 'application/octet-stream';
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isPreview = searchParams.get('preview') === 'true';

    if (!id) {
      return new NextResponse('缺少 id 参数', { status: 400 });
    }

    const sharedFile = FileService.getInstance().getSharedFile(id);
    if (!sharedFile) {
      return new NextResponse('文件不存在或已被注销', { status: 404 });
    }

    const { filePath, fileName, fileSize } = sharedFile;

    if (!fs.existsSync(filePath)) {
      return new NextResponse('文件物理路径不存在', { status: 410 });
    }

    const rangeHeader = request.headers.get('range');

    // 动态处理流式预览和下载头部
    const headers = new Headers();
    if (isPreview) {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    }
    headers.set('Accept-Ranges', 'bytes');

    const contentType = isPreview ? getMimeType(fileName) : 'application/octet-stream';

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
      headers.set('Content-Type', contentType);

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
      headers.set('Content-Type', contentType);

      return new Response(webStream as any, {
        status: 200,
        headers
      });
    }
  } catch (err: any) {
    console.error('[SharedDownloadAPI] 下载文件发生异常:', err);
    return new NextResponse(`下载失败: ${err.message}`, { status: 500 });
  }
}
