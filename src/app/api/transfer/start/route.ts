import { NextResponse } from 'next/server';
import { FileService } from '@/services/fileService';

export async function POST(request: Request) {
  try {
    const { taskId, fileName, fileSize, downloadUrl, peerId, peerName } = await request.json();
    
    if (!taskId || !fileName || !fileSize || !downloadUrl || !peerId || !peerName) {
      return NextResponse.json({ success: false, error: '缺少必要的传输元数据' }, { status: 400 });
    }
    
    // 调用 FileService 启动极速分块下载
    FileService.getInstance().startDownload(
      taskId,
      fileName,
      fileSize,
      downloadUrl,
      peerId,
      peerName
    );
    
    return NextResponse.json({ success: true, message: '极速文件下载任务已启动' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
