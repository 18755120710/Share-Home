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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, action } = body;

    if (!taskId || !action) {
      return NextResponse.json({ success: false, error: '缺少 taskId 或 action' }, { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    const fileService = FileService.getInstance();
    
    // 执行取消/拒绝的物理文件强行擦除与状态落盘
    const finalStatus = action === 'reject' ? 'rejected' : 'failed';
    fileService.cancelAndCleanupTransfer(taskId, finalStatus);

    // 🌟 在服务端物理擦除后，立刻通过 WebSocket 广播该传输项状态已完结，通知远端两端同步更新
    const allTasks = fileService.getTransferTasks();
    const updatedTask = allTasks[taskId];
    if (updatedTask) {
      const { SocketService } = require('@/services/socketService');
      SocketService.getInstance().broadcast('transfer:progress', updatedTask);
      
      // 特殊处理拒绝弹窗的同步关闭
      if (action === 'reject') {
        SocketService.getInstance().broadcast('transfer:reject', { taskId });
      }
    }

    return NextResponse.json({ success: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
