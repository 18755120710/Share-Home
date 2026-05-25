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
  const clientId = searchParams.get('clientId') || `peer_web_${Math.random().toString(36).substring(2, 11)}`;
  
  // 优先获取客户端透传的本地个性化属性
  const nickname = searchParams.get('nickname') || '局域网伙伴';
  const avatar = searchParams.get('avatar') || 'avatar-1';

  // 解析客户端在局域网中的真实物理 IP
  let clientIp = '127.0.0.1';
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwardedFor) {
    clientIp = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    clientIp = realIp.trim();
  } else if ((request as any).ip) {
    clientIp = (request as any).ip;
  }
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  // 智能修正：若为本地回环 IP，自动映射为本端的局域网物理 IP，以使外部设备能够建立物理通信
  if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'localhost') {
    clientIp = mdns.getLocalIp();
  }

  // 只要不是本机的 Host 进程 ID，就将其注册为 Web 浏览器虚拟在线终端
  if (clientId !== mdns.getSelfId()) {
    mdns.registerWebPeer(clientId, clientIp, nickname, avatar);
  }

  return NextResponse.json({
    status: 'ready',
    clientId,
    self: {
      id: clientId, // 返回本客户端独立的身份 ID，解决同名过滤冲突
      nickname,
      avatar,
      ip: clientIp,
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
      // 客户端在线修改资料：解析当前 IP 并更新虚拟端注册
      let clientIp = '127.0.0.1';
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        clientIp = forwardedFor.split(',')[0].trim();
      }
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      } else if (clientIp === '::1') {
        clientIp = '127.0.0.1';
      }
      mdns.registerWebPeer(clientId, clientIp, nickname, avatar);
    } else {
      // 远端浏览器访问的是这台主机的控制台，因此资料更新应作用于主机广播身份。
      mdns.updateBroadcast(nickname, avatar);
    }
    
    return NextResponse.json({ success: true, nickname, avatar });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
