import { NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { SocketService } from '@/services/socketService';
import { spawn } from 'child_process';
import os from 'os';

export async function POST(request: Request) {
  try {
    // 1. 超级管理员身份鉴权防火墙
    const authService = AuthService.getInstance();
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || '';
    const session = authService.verifySession(token);
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'forbidden',
        message: '权限不足，仅管理员有权执行系统更新操作'
      }, { status: 403 });
    }

    const socketService = SocketService.getInstance();
    
    // 异步执行更新操作，直接返回 200，日志和进度通过 WebSockets 实时不间断推送给前端
    const runUpdateProcess = () => {
      console.log('[SystemUpdate] 正在启动编程式全局一键升级...');
      socketService.broadcast('system:update-log', {
        type: 'log',
        text: '⚙️ [SYSTEM] 正在连接 NPM 全局仓库进行一键物理重装...'
      });

      // 根据平台判断命令 (Windows 下需要以 cmd.exe 包装 shell 运行)
      const platform = os.platform();
      const cmd = 'npm';
      const args = ['install', '-g', 'share-home@latest'];

      const child = spawn(cmd, args, {
        shell: platform === 'win32' || platform === 'darwin' || true
      });

      child.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          socketService.broadcast('system:update-log', {
            type: 'log',
            text: `[NPM] ${text}`
          });
        }
      });

      child.stderr.on('data', (data) => {
        const text = data.toString().trim();
        if (text && !text.includes('npm warn') && !text.includes('deprecated') && !text.includes('notice')) {
          socketService.broadcast('system:update-log', {
            type: 'log',
            text: `[WARN] ${text}`
          });
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('[SystemUpdate] 全局 NPM 包物理升级成功！退出码 0');
          socketService.broadcast('system:update-log', {
            type: 'log',
            text: '🎉 [SYSTEM] 全局包升级物理合并成功！退出码 0'
          });
          socketService.broadcast('system:update-log', {
            type: 'log',
            text: '🔄 [SYSTEM] 正在向守护程序派发热升级自愈重启信号，稍后系统将自动重新连接...'
          });

          // 推送 1.5 秒后，子进程触发 99 退出码，交由 cli.js 守护进程优雅拉起
          setTimeout(() => {
            console.log('[SystemUpdate] 正在以退出码 99 退出子进程进行热重启...');
            process.exit(99);
          }, 1500);
        } else {
          console.error(`[SystemUpdate] NPM 升级失败，退出码: ${code}`);
          socketService.broadcast('system:update-log', {
            type: 'error',
            text: `❌ [ERROR] 全局包物理重装失败，进程退出码: ${code}`
          });
          socketService.broadcast('system:update-log', {
            type: 'error',
            text: '💡 [TIPS] 升级失败大概率是由于系统当前登录账户对 npm 全局安装目录（如 node_modules）缺乏写入权限所致。请尝试在终端中以管理员权限手动运行: sudo npm install -g share-home@latest 进行升级。'
          });
        }
      });

      child.on('error', (err) => {
        console.error('[SystemUpdate] spawn 进程出错:', err);
        socketService.broadcast('system:update-log', {
          type: 'error',
          text: `❌ [ERROR] 唤起物理更新进程发生严重系统异常: ${err.message}`
        });
      });
    };

    // 延迟 500ms 执行更新，给前端留出拉起黑客终端抽屉的动感视觉缓冲时间
    setTimeout(runUpdateProcess, 500);

    return NextResponse.json({
      success: true,
      message: '一键热升级更新指令派发成功，更新流已激活'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
