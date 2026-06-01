import { NextRequest, NextResponse } from 'next/server';
import { AuthService, DevicePermission } from '@/services/authService';
import { MdnsService } from '@/services/mdnsService';
import { SocketService } from '@/services/socketService';

// 管理员身份拦截拦截器
function verifyAdminSession(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || request.cookies.get('share_home_token')?.value || '';
  if (!token) return false;

  const session = AuthService.getInstance().verifySession(token);
  return session?.role === 'admin';
}

/**
 * GET: 获取局域网内的全网用户设备列表与权限状态
 */
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'unauthorized', message: '权限不足，仅限超级管理员操作。' }, { status: 403 });
    }

    const mdns = MdnsService.getInstance();
    const authService = AuthService.getInstance();

    // 1. 获取当前 mDNS 在线活跃设备列表
    const onlinePeers = mdns.getPeers();
    
    // 2. 获取磁盘持久化存储的所有设备权限列表
    const storedPermissions = authService.getDevicePermissions();
    const knownDevices = authService.getKnownDevices();
    const activeSessions = authService.getActiveSessionDevices();
    const activeSessionsByClientId = new Map(activeSessions.map((session) => [session.clientId, session]));

    const mergedDevicesMap = new Map<string, any>();

    // 3. 先把在线设备加入 Map，标记在线
    for (const peer of onlinePeers) {
      mergedDevicesMap.set(peer.id, {
        id: peer.id,
        nickname: knownDevices[peer.id]?.nickname || peer.nickname,
        avatar: peer.avatar,
        ip: peer.ip,
        port: peer.port,
        os: knownDevices[peer.id]?.os || peer.os || 'unknown',
        role: knownDevices[peer.id]?.role || 'guest',
        online: true,
        lastSeen: activeSessionsByClientId.get(peer.id)?.lastActive || knownDevices[peer.id]?.lastSeen || peer.lastSeen,
        permissions: authService.getDevicePermission(peer.id)
      });
    }

    // 4. 合并曾经登录或配置过但当前可能离线的设备。
    // 本机浏览器访问会映射为宿主 peer id，不会进入 mDNS peers，因此必须参考活跃会话。
    for (const [clientId, device] of Object.entries(knownDevices)) {
      if (!mergedDevicesMap.has(clientId)) {
        const activeSession = activeSessionsByClientId.get(clientId);
        mergedDevicesMap.set(clientId, {
          id: clientId,
          nickname: device.nickname || '离线伙伴',
          avatar: device.avatar || 'avatar-1',
          ip: device.ip,
          port: 3000,
          os: device.os || 'unknown',
          role: activeSession?.role || device.role || 'guest',
          online: !!activeSession,
          lastSeen: activeSession?.lastActive || device.lastSeen || 0,
          permissions: authService.getDevicePermission(clientId)
        });
      }
    }

    for (const [clientId, perms] of Object.entries(storedPermissions)) {
      if (!mergedDevicesMap.has(clientId)) {
        const activeSession = activeSessionsByClientId.get(clientId);
        // 从 clientId 反推出 IP
        const cleanIp = clientId.replace(/^peer_/, '').replace(/_/g, '.');
        mergedDevicesMap.set(clientId, {
          id: clientId,
          nickname: '离线伙伴',
          avatar: 'avatar-1',
          ip: cleanIp,
          port: 3000,
          os: 'unknown',
          role: activeSession?.role || 'guest',
          online: !!activeSession,
          lastSeen: activeSession?.lastActive || 0,
          permissions: perms
        });
      }
    }

    for (const activeSession of activeSessions) {
      if (!mergedDevicesMap.has(activeSession.clientId)) {
        mergedDevicesMap.set(activeSession.clientId, {
          id: activeSession.clientId,
          nickname: activeSession.role === 'admin' ? '超级管理员' : '局域网伙伴',
          avatar: 'avatar-1',
          ip: activeSession.ip,
          port: 3000,
          os: 'unknown',
          role: activeSession.role,
          online: true,
          lastSeen: activeSession.lastActive,
          permissions: authService.getDevicePermission(activeSession.clientId)
        });
      }
    }

    return NextResponse.json({
      success: true,
      devices: Array.from(mergedDevicesMap.values())
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 超级管理员更新指定 IP 设备的特定功能权限，并落盘与 WebSocket 全网秒级广播同步
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'unauthorized', message: '权限不足，仅限超级管理员操作。' }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, key, value } = body;

    if (!clientId || !key || typeof value !== 'boolean') {
      return NextResponse.json({ success: false, error: '缺少必要参数 (clientId, key, value)' }, { status: 400 });
    }
    if (!['allowUpload', 'allowEditDoc', 'allowCreateDoc'].includes(key)) {
      return NextResponse.json({ success: false, error: '不支持的权限项' }, { status: 400 });
    }

    const authService = AuthService.getInstance();
    const ok = authService.updateDevicePermission(clientId, key as keyof DevicePermission, value);

    if (ok) {
      const latestPermissions = authService.getDevicePermission(clientId);
      
      // 🌟 【网关级实时协同核心】：通过 WebSocket 广播权限变动事件，受控端在 0.1 秒内无刷响应禁用状态！
      SocketService.getInstance().broadcast('permissions:update', {
        clientId,
        permissions: latestPermissions
      });

      return NextResponse.json({ success: true, permissions: latestPermissions });
    } else {
      return NextResponse.json({ success: false, error: '更新设备权限写入磁盘失败' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PUT: 超级管理员在线更新通用伙伴登录密钥
 */
export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'unauthorized', message: '权限不足，仅限超级管理员操作。' }, { status: 403 });
    }

    const body = await request.json();
    const { newGuestPass } = body;

    if (!newGuestPass || newGuestPass.trim().length < 6) {
      return NextResponse.json({ success: false, error: '普通伙伴密钥格式错误，长度必须不小于 6 位。' }, { status: 400 });
    }

    const authService = AuthService.getInstance();
    const ok = authService.updateGuestPassword(newGuestPass.trim());

    if (ok) {
      console.log(`[AdminAuth] 超级管理员已成功将局域网伙伴登录密钥更新密文落盘。`);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '密钥密文写入磁盘失败' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
