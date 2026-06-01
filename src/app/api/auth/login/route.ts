import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { MdnsService } from '@/services/mdnsService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, username, password, guestPassword, adminUsername, adminPassword, guestPass, totpCode } = body;
    const authService = AuthService.getInstance();
    const mdns = MdnsService.getInstance();

    // 1. 获取客户端的局域网物理 IP (回环地址映射为物理局域网 IP)
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
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'localhost') {
      clientIp = mdns.getLocalIp();
    }

    // 2. 首次启动密码网页自愈初始化功能 (仅限本地回环 localhost/127.0.0.1 访问，保护网络安全)
    if (action === 'init') {
      if (authService.isInitialized()) {
        return NextResponse.json({ success: false, error: '超级管理员密码已初始化完毕，禁止重复注册。' }, { status: 400 });
      }

      // 安全限制：校验来源是否为本地回环 IP
      let requestIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
      if (requestIp.startsWith('::ffff:')) {
        requestIp = requestIp.substring(7);
      }
      const isLocalhost = 
        requestIp === '127.0.0.1' || 
        requestIp === '::1' || 
        requestIp === 'localhost';

      if (!isLocalhost) {
        return NextResponse.json({ 
          success: false, 
          error: '安全沙箱限制：非本地回环连接禁止执行管理员配置初始化！请联系主机管理员在本地操作。' 
        }, { status: 403 });
      }

      if (!adminPassword || !guestPass) {
        return NextResponse.json({ success: false, error: '管理员密码和伙伴登录密钥不能为空。' }, { status: 400 });
      }

      const ok = authService.initAuth(adminUsername || 'admin', adminPassword, guestPass);
      if (ok) {
        console.log(`[InitAuth] 宿主已通过本地回环网页端成功初始化密码配置！`);
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false, error: '密文写入磁盘失败，请检查系统文件夹读写权限。' }, { status: 500 });
      }
    }

    // 3. 拦截未初始化状态下的常规登录
    if (!authService.isInitialized()) {
      return NextResponse.json({ 
        success: false, 
        error: 'auth_not_initialized', 
        message: '系统尚未进行首次密码初始化设置，请在本地或终端完成初始化。' 
      }, { status: 200 });
    }

    // 3.5 超级管理员 2FA 两步验证免密快捷登录
    if (totpCode) {
      if (!authService.isAdmin2faEnabled()) {
        return NextResponse.json({ success: false, error: '超级管理员未开启两步验证 (2FA)，请切换至常规密码登录。' }, { status: 400 });
      }
      const isOk = authService.verifyAdmin2Fa(totpCode);
      if (isOk) {
        const token = authService.createSession('admin', clientIp);
        const adminUser = authService.getAdminUsername();
        authService.registerDevice({
          id: authService.getClientIdFromIp(clientIp),
          ip: clientIp,
          nickname: adminUser,
          avatar: 'avatar-1',
          os: 'unknown',
          role: 'admin'
        });
        console.log(`[Auth] 超级管理员通过 2FA 两步验证免密极速通道 (${clientIp}) 登录成功。颁发 Session 令牌。`);
        const response = NextResponse.json({
          success: true,
          token,
          role: 'admin',
          username: adminUser
        });
        response.cookies.set('share_home_token', token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
        return response;
      } else {
        return NextResponse.json({ success: false, error: '2FA 两步验证码验证失败，请重新确认手机 App 上显示的 6 位验证码。' }, { status: 401 });
      }
    }

    // 4. 超级管理员登录 (账号密码)
    if (username && password) {
      const isOk = authService.verifyAdmin(username, password);
      if (isOk) {
        const token = authService.createSession('admin', clientIp);
        authService.registerDevice({
          id: authService.getClientIdFromIp(clientIp),
          ip: clientIp,
          nickname: username,
          avatar: 'avatar-1',
          os: 'unknown',
          role: 'admin'
        });
        console.log(`[Auth] 超级管理员 ${username} (${clientIp}) 登录成功。颁发 Session 令牌。`);
        const response = NextResponse.json({
          success: true,
          token,
          role: 'admin',
          username
        });
        response.cookies.set('share_home_token', token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
        return response;
      } else {
        return NextResponse.json({ success: false, error: '管理员账号或密码错误。' }, { status: 401 });
      }
    }

    // 5. 局域网普通伙伴登录 (单密钥)
    if (guestPassword) {
      const isOk = authService.verifyGuest(guestPassword);
      if (isOk) {
        const token = authService.createSession('guest', clientIp);
        authService.registerDevice({
          id: authService.getClientIdFromIp(clientIp),
          ip: clientIp,
          nickname: '局域网伙伴',
          avatar: 'avatar-1',
          os: 'unknown',
          role: 'guest'
        });
        console.log(`[Auth] 局域网伙伴 (${clientIp}) 通过通用密钥验证登录成功。颁发 Guest 令牌。`);
        const response = NextResponse.json({
          success: true,
          token,
          role: 'guest'
        });
        response.cookies.set('share_home_token', token, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
        return response;
      } else {
        return NextResponse.json({ success: false, error: '登录密钥无效，验证失败。' }, { status: 401 });
      }
    }

    return NextResponse.json({ success: false, error: '缺少必需的登录凭证参数。' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || request.cookies.get('share_home_token')?.value || '';
    if (token) {
      AuthService.getInstance().destroySession(token);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set('share_home_token', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
