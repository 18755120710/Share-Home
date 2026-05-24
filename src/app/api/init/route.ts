import { NextResponse } from 'next/server';
import { MdnsService } from '@/services/mdnsService';
import { SocketService } from '@/services/socketService';

export async function GET() {
  const globalSymbols = global as any;

  if (!globalSymbols.__services_initialized__) {
    console.log('[InitAPI] 正在全局初始化局域网后台常驻服务...');
    
    const sockets = SocketService.getInstance();
    const mdns = MdnsService.getInstance();

    // 1. 启动 WebSocket 服务器于端口 3001，服务于本端前端
    sockets.start(3001);

    // 2. 启动 mDNS 广播，使用默认昵称和头像，监听端口为 web 端的 3000
    mdns.start('局域网伙伴', 'avatar-1', 3000);

    // 绑定 mDNS 在线设备列表更新到 WebSocket 广播上实现解耦
    mdns.onPeersChange((peers) => {
      sockets.broadcast('peers:update', peers);
    });

    // 3. 挂载 HMR 保护标记
    globalSymbols.__services_initialized__ = true;
    console.log('[InitAPI] mDNS & WebSocket 初始化服务挂载完毕。');
  }

  const mdns = MdnsService.getInstance();

  return NextResponse.json({
    status: 'ready',
    self: {
      id: mdns.getSelfId(),
      nickname: '局域网伙伴',
      avatar: 'avatar-1',
      ip: mdns.getLocalIp(),
      port: 3000,
    }
  });
}

export async function POST(request: Request) {
  try {
    const { nickname, avatar } = await request.json();
    if (!nickname || !avatar) {
      return NextResponse.json({ success: false, error: '昵称和头像不能为空' }, { status: 400 });
    }
    
    const mdns = MdnsService.getInstance();
    mdns.updateBroadcast(nickname, avatar);
    
    return NextResponse.json({ success: true, nickname, avatar });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
