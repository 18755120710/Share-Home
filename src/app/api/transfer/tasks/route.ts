import { NextRequest, NextResponse } from 'next/server';
import { FileService } from '@/services/fileService';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ success: false, error: '缺少 clientId' }, { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const fileService = FileService.getInstance();
    const allTasks = fileService.getTransferTasks();

    // 过滤出与当前客户端 clientId 相关的任务 (要么是发送者，要么是接收者)
    const clientTasks = Object.values(allTasks).filter(
      (t: any) => t.senderId === clientId || t.peerId === clientId
    );

    return NextResponse.json({ 
      success: true, 
      tasks: clientTasks 
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
