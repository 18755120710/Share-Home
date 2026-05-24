import { NextRequest, NextResponse } from 'next/server';
import { MdnsService } from '@/services/mdnsService';
import { SocketService } from '@/services/socketService';

export async function GET(request: NextRequest) {
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
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  // 获取客户端的真实局域网 IP
  let clientIp = request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  if (clientIp === '::1') {
    clientIp = '127.0.0.1';
  }

  // 如果是由非本地主机网页访问（传入了专有 clientId 且非主机 ID），注册为 Web 浏览器虚拟伙伴
  if (clientId && clientId !== mdns.getSelfId()) {
    mdns.registerWebPeer(clientId, clientIp, '局域网伙伴', 'avatar-2');
    
    return NextResponse.json({
      status: 'ready',
      self: {
        id: clientId,
        nickname: '局域网伙伴',
        avatar: 'avatar-2',
        ip: clientIp,
        port: 3000,
      }
    });
  }

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
    const { nickname, avatar, clientId } = await request.json();
    if (!nickname || !avatar) {
      return NextResponse.json({ success: false, error: '昵称和头像不能为空' }, { status: 400 });
    }
    
    const mdns = MdnsService.getInstance();
    if (clientId && clientId !== mdns.getSelfId()) {
      // 动态更新 Web 客户端伙伴的资料
      const peers = mdns.getPeers();
      const target = peers.find(p => p.id === clientId);
      mdns.registerWebPeer(clientId, target ? target.ip : '127.0.0.1', nickname, avatar, target ? target.port : 3000);
    } else {
      // 更新主机自身广播资料
      mdns.updateBroadcast(nickname, avatar);
    }
    
    return NextResponse.json({ success: true, nickname, avatar });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
