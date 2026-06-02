import { NextResponse } from 'next/server';
import { AuthService } from '@/services/authService';
import { SocketService } from '@/services/socketService';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

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

      // 根据平台判断命令
      const platform = os.platform();
      
      // Windows 平台下会发生 EBUSY 文件独占锁报错，必须启用外部升级器接管自愈模式
      if (platform === 'win32') {
        console.log('[SystemUpdate] 检测到处于 Windows 平台，启动外部自愈升级模式');
        
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '🔄 [SYSTEM] 检测到当前系统运行在 Windows 平台，为防文件占用导致升级失败...'
        });
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '⚙️ [SYSTEM] 正在系统临时目录部署独立的外部自愈更新器接管升级逻辑...'
        });
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '🔌 [SYSTEM] 协同服务与信道即将在 1.5 秒后优雅下线并释放全局包文件锁...'
        });
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '⏳ [SYSTEM] 外部更新器会在后台重新装配最新全局包并以原参数自愈拉起平台，请耐心等待 10-15 秒后页面自动重连。'
        });

        try {
          const tempDir = os.tmpdir();
          const upgradeScriptPath = path.join(tempDir, 'share-home-upgrade.js');
          const logFilePath = path.join(tempDir, 'share-home-upgrade.log');

          // 清理旧日志文件
          if (fs.existsSync(logFilePath)) {
            try { fs.unlinkSync(logFilePath); } catch (e) {}
          }

          const upgradeScriptContent = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempDir = "${tempDir.replace(/\\/g, '\\\\')}";
const logFile = path.join(tempDir, 'share-home-upgrade.log');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\\n';
  fs.appendFileSync(logFile, line, 'utf-8');
  console.log(msg);
}

log('=== Share Home 外部自愈升级器已拉起 ===');

const launcherPath = process.env.LAUNCHER_PATH || '';
const launcherArgsStr = process.env.LAUNCHER_ARGS || '[]';
let launcherArgs = [];
try {
  launcherArgs = JSON.parse(launcherArgsStr);
} catch (e) {
  log('解析启动参数失败: ' + e.message);
}

log('正在睡眠 2 秒等待父进程树优雅退出释放全部全局包文件锁...');
setTimeout(() => {
  log('正在通过 Windows UAC 原生管理员授权执行全局包升级安装...');
  
  const child = spawn('powershell.exe', [
    '-Command',
    "Start-Process cmd -ArgumentList '/c npm install -g share-home@latest' -Verb RunAs -Wait"
  ], {
    shell: true,
    stdio: 'pipe'
  });

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      try { fs.appendFileSync(logFile, data.toString()); } catch (e) {}
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      try { fs.appendFileSync(logFile, data.toString()); } catch (e) {}
    });
  }

  child.on('close', (code) => {
    if (code === 0) {
      log('🎉 全局包物理重装合并完成！成功退出码 0');
      log('正在使用原启动参数拉起新版本主协同服务...');
      
      let sub;
      if (launcherPath && fs.existsSync(launcherPath)) {
        log('执行自愈拉起指令: node "' + launcherPath + '" ' + launcherArgs.join(' '));
        sub = spawn('node', [launcherPath, ...launcherArgs], {
          shell: true,
          detached: true,
          stdio: 'ignore'
        });
      } else {
        log('未找到 LAUNCHER_PATH 环境变量，回退到全局命令拉起: share-home ' + launcherArgs.join(' '));
        sub = spawn('share-home', launcherArgs, {
          shell: true,
          detached: true,
          stdio: 'ignore'
        });
      }

      if (sub) {
        sub.unref();
        log('🎉 协同平台已成功拉起，独立升级器任务结束并退出。');
      } else {
        log('❌ 拉起协同平台失败。');
      }
      process.exit(0);
    } else {
      log('❌ NPM 物理重装失败，退出码: ' + code);
      log('💡 升级失败大概率是由于系统当前登录账户对 npm 全局安装目录缺乏写入权限所致。请尝试在终端中以管理员身份手动运行: npm install -g share-home@latest 进行升级。');
      process.exit(code);
    }
  });

  child.on('error', (err) => {
    log('❌ 唤起物理更新进程发生严重系统异常: ' + err.message);
    process.exit(1);
  });
}, 2000);
`;

          fs.writeFileSync(upgradeScriptPath, upgradeScriptContent.trim(), 'utf-8');
          console.log('[SystemUpdate] 外部升级器脚本已成功部署至:', upgradeScriptPath);

          const launcherPath = process.env.LAUNCHER_PATH || '';
          const launcherArgs = process.env.LAUNCHER_ARGS || '[]';

          const child = spawn('node', [upgradeScriptPath], {
            detached: true,
            stdio: 'ignore',
            env: {
              ...process.env,
              LAUNCHER_PATH: launcherPath,
              LAUNCHER_ARGS: launcherArgs
            }
          });
          child.unref();
          console.log('[SystemUpdate] 外部自愈升级器进程已脱钩启动。');

          // 延迟 1.5 秒退出 Next.js 服务进程，交由外壳 cli.js 优雅自我终结
          setTimeout(() => {
            console.log('[SystemUpdate] 正在以退出码 98 退出 Next.js 进程以完全释放文件锁...');
            process.exit(98);
          }, 1500);

        } catch (err: any) {
          console.error('[SystemUpdate] 部署/启动外部升级器失败:', err);
          socketService.broadcast('system:update-log', {
            type: 'error',
            text: `❌ [ERROR] 部署/拉起外部自愈升级器发生严重异常: ${err.message}`
          });
        }
        return;
      }

      // Unix 平台（Darwin, Linux 等）原生提权物理热更新
      let child;
      if (platform === 'darwin') {
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '🔑 [SYSTEM] 检测到 macOS 平台，正在唤起系统管理员凭证窗口进行提权安装...'
        });
        child = spawn('osascript', [
          '-e',
          'do shell script "npm install -g share-home@latest" with administrator privileges'
        ]);
      } else if (platform === 'linux') {
        socketService.broadcast('system:update-log', {
          type: 'log',
          text: '🔑 [SYSTEM] 检测到 Linux 平台，正在尝试使用 pkexec 提权安装...'
        });
        child = spawn('pkexec', ['npm', 'install', '-g', 'share-home@latest']);
      } else {
        child = spawn('npm', ['install', '-g', 'share-home@latest'], {
          shell: true
        });
      }

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            socketService.broadcast('system:update-log', {
              type: 'log',
              text: `[NPM] ${text}`
            });
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const text = data.toString().trim();
          if (text && !text.includes('npm warn') && !text.includes('deprecated') && !text.includes('notice')) {
            socketService.broadcast('system:update-log', {
              type: 'log',
              text: `[WARN] ${text}`
            });
          }
        });
      }

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
