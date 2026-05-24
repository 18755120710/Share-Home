import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FileService } from '@/services/fileService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const chunkIndex = parseInt(searchParams.get('chunkIndex') || '0', 10);
    const totalChunks = parseInt(searchParams.get('totalChunks') || '1', 10);
    const fileName = searchParams.get('fileName') || 'file';
    const fileSize = parseInt(searchParams.get('fileSize') || '0', 10);

    if (!taskId) {
      return NextResponse.json({ success: false, error: '缺少 taskId' }, { status: 400 });
    }

    // 缓存文件夹
    const cacheDir = path.join(process.cwd(), 'upload_cache', taskId);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 将本分片写入临时文件
    const chunkPath = path.join(cacheDir, `chunk_${chunkIndex}`);
    
    // 读取二进制 Request Body
    const buffer = await request.arrayBuffer();
    fs.writeFileSync(chunkPath, Buffer.from(buffer));

    // 校验是否所有分片都已传输完成
    const files = fs.readdirSync(cacheDir);
    if (files.length === totalChunks) {
      // 执行大文件分片合并
      console.log(`[PrepareUpload] 收到全部 ${totalChunks} 个分片，正在合并大文件: ${fileName}`);
      
      const finalDir = path.join(process.cwd(), 'shared_downloads');
      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }
      
      // 合并目标物理路径 (如果重名，自动加时间戳防覆盖)
      let finalPath = path.join(finalDir, fileName);
      if (fs.existsSync(finalPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        finalPath = path.join(finalDir, `${base}_${Date.now()}${ext}`);
      }

      const writeStream = fs.createWriteStream(finalPath);
      
      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(cacheDir, `chunk_${i}`);
        const data = fs.readFileSync(partPath);
        writeStream.write(data);
        // 删除临时分片
        fs.unlinkSync(partPath);
      }
      
      writeStream.end();
      
      // 删除临时文件夹
      fs.rmdirSync(cacheDir);

      const actualName = path.basename(finalPath);
      // 向本地 FileService 注册为允许他人下载的实体
      FileService.getInstance().registerUpload(taskId, finalPath, actualName, fileSize);

      return NextResponse.json({
        success: true,
        status: 'merged',
        fileName: actualName,
        filePath: finalPath
      });
    }

    return NextResponse.json({
      success: true,
      status: 'chunk_received',
      chunkIndex,
      totalChunks
    });
  } catch (err: any) {
    console.error('[PrepareUpload] 分片处理异常:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
