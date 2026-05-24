import { NextResponse } from 'next/server';
import { SocketService } from '@/services/socketService';
import { BoardMessage } from '@/types/board';

export async function POST(request: Request) {
  try {
    const message: BoardMessage = await request.json();
    
    console.log(`[BoardSync] 收到来自 ${message.senderName} 的公告同步投递`);
    
    // 实时广播给本机的浏览器页面
    SocketService.getInstance().broadcast('board:message', message);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
