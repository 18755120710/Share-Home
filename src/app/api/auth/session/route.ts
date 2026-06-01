import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { MdnsService } from '@/services/mdnsService';

export async function GET(request: NextRequest) {
  try {
    const authService = AuthService.getInstance();
    const mdns = MdnsService.getInstance();

    // 1. 系统未配置密码时，直接返回待初始化标记，提醒前端启动引导
    if (!authService.isInitialized()) {
      return NextResponse.json({ 
        success: false, 
        error: 'auth_not_initialized',
        message: '系统尚未进行密码配置初始化'
      });
    }

    // 2. 解析 Header 里的 Bearer Token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || request.cookies.get('share_home_token')?.value || '';

    const admin2faEnabled = authService.isAdmin2faEnabled();

    if (!token) {
      return NextResponse.json({ success: false, error: 'missing_token', message: '未检测到会话凭证。', admin2faEnabled }, { status: 401 });
    }

    const session = authService.verifySession(token);
    if (!session) {
      return NextResponse.json({ success: false, error: 'invalid_session', message: '会话已过期或已被销毁，请重新验证。', admin2faEnabled }, { status: 401 });
    }

    // 3. 动态获取该终端在局域网中的物理 IP 绑定的 clientId
    let clientIp = session.ip;
    // 智能防错：如果是本机回环 IP，重新映射为物理局域网 IP
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'localhost') {
      clientIp = mdns.getLocalIp();
    }
    const clientId = authService.getClientIdFromIp(clientIp);
    authService.registerDevice({
      id: clientId,
      ip: clientIp,
      nickname: session.role === 'admin' ? '超级管理员' : '局域网伙伴',
      avatar: 'avatar-1',
      os: 'unknown',
      role: session.role
    });

    // 4. 读取该客户端当前受管理员管控的权限列表
    const permissions = authService.getDevicePermission(clientId);

    return NextResponse.json({
      success: true,
      role: session.role,
      clientId,
      ip: clientIp,
      permissions,
      admin2faEnabled
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
