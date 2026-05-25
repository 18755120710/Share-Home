import { NextResponse } from 'next/server';
import { SocketService } from '@/services/socketService';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const { taskId, senderId, senderName, fileName, fileSize, downloadUrl } = await request.json();
    
    if (!taskId || !senderName || !fileName || !fileSize || !downloadUrl) {
      return NextResponse.json({ success: false, error: '缺失必要的文件元数据' }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
    
    console.log(`[TransferRequest] 收到来自 ${senderName} 的文件互传请求: ${fileName} (${fileSize} 字节)`);
    
    // 通过 WebSocket 广播给前端页面，弹出询问对话框
    SocketService.getInstance().broadcast('transfer:request', {
      taskId,
      senderId,
      senderName,
      fileName,
      fileSize,
      downloadUrl
    });
    
    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { 
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
