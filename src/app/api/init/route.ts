import { NextRequest, NextResponse } from 'next/server';
import { MdnsService } from '@/services/mdnsService';
import { SocketService } from '@/services/socketService';

const getRuntimePort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export async function GET(request: NextRequest) {
  const globalSymbols = global as any;
  const webPort = getRuntimePort(process.env.SHARE_HOME_WEB_PORT || process.env.PORT, 3000);
  const wsPort = getRuntimePort(process.env.SHARE_HOME_WS_PORT, webPort + 1);
  const host = process.env.SHARE_HOME_HOST || process.env.HOSTNAME || '127.0.0.1';

  if (!globalSymbols.__services_initialized__) {
    console.log('[InitAPI] 正在全局初始化局域网后台常驻服务...');
    
    const sockets = SocketService.getInstance();
    const mdns = MdnsService.getInstance();

    // 1. 启动 WebSocket 服务器，服务于本端前端
    sockets.start(wsPort, host);

    // 2. 启动 mDNS 广播，使用当前 Web 端口
    mdns.start('局域网伙伴', 'avatar-1', webPort);

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
  
  // 优先获取客户端透传的本地个性化属性
  const nickname = searchParams.get('nickname') || '局域网伙伴';
  const avatar = searchParams.get('avatar') || 'avatar-1';
  const os = searchParams.get('os') || 'Windows';

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

  // 统一基于客户端局域网真实IP生成全局唯一的 clientId，实现“一IP一设备”
  const clientId = `peer_${clientIp.replace(/\./g, '_')}`;

  // 只要不是本机的 Host 进程 ID，就将其注册为 Web 浏览器虚拟在线终端
  if (clientId !== mdns.getSelfId()) {
      mdns.registerWebPeer(clientId, clientIp, nickname, avatar, webPort, os);
  }

  return NextResponse.json({
    status: 'ready',
    clientId,
    wsPort,
    self: {
      id: clientId, // 返回本客户端独立的身份 ID，解决同名过滤冲突
      nickname,
      avatar,
      ip: clientIp,
      port: webPort,
      os, // 支持跨终端的真实操作系统显示
    }
  });
}

export async function POST(request: Request) {
  try {
    const webPort = getRuntimePort(process.env.SHARE_HOME_WEB_PORT || process.env.PORT, 3000);
    const { nickname, avatar, os } = await request.json();
    if (!nickname || !avatar) {
      return NextResponse.json({ success: false, error: '昵称和头像不能为空' }, { status: 400 });
    }
    
    const mdns = MdnsService.getInstance();
    
    // 解析 IP 并重新计算出此 IP 强绑定的物理 ID
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
    // 智能修正
    if (clientIp === '127.0.0.1' || clientIp === 'localhost') {
      clientIp = mdns.getLocalIp();
    }

    const calculatedClientId = `peer_${clientIp.replace(/\./g, '_')}`;
    
    if (calculatedClientId !== mdns.getSelfId()) {
      // 客户端在线修改资料：更新此 IP 强绑定的虚拟端注册
      mdns.registerWebPeer(calculatedClientId, clientIp, nickname, avatar, webPort, os || 'Windows');
    } else {
      // 远端浏览器访问的是这台主机的控制台，因此资料更新应作用于主机广播身份。
      mdns.updateBroadcast(nickname, avatar);
    }
    
    return NextResponse.json({ success: true, nickname, avatar });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
