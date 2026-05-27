#!/usr/bin/env node

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const projectRoot = path.join(__dirname, '..');
const args = process.argv.slice(2);
const packageJson = require(path.join(projectRoot, 'package.json'));

if (args.includes('--version') || args.includes('-v')) {
  console.log(packageJson.version);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Share Home ${packageJson.version}

Usage:
  share-home [--port <port>] [--host <host>]

Examples:
  share-home
  share-home --port 8310
  share-home --host 127.0.0.1 --port 8310
  share-home --host 192.168.1.23 --port 8310
`);
  process.exit(0);
}

console.log('\x1b[36m%s\x1b[0m', '🚀 正在启动 Share Home 局域网协作平台...');

function getArgValue(name, fallback) {
  const arg = args.find((item) => item === name || item.startsWith(`${name}=`));
  if (!arg) {
    return fallback;
  }

  if (arg.includes('=')) {
    return arg.split('=').slice(1).join('=');
  }

  const index = args.indexOf(arg);
  return args[index + 1] || fallback;
}

const defaultHostname = process.platform === 'win32' ? '127.0.0.1' : '0.0.0.0';
const requestedPort = getArgValue('--port', getArgValue('-p', process.env.PORT || '8301'));
const requestedWsPort = getArgValue('--ws-port', process.env.SHARE_HOME_WS_PORT || String(Number(requestedPort) + 1));
const hostname = getArgValue('--host', getArgValue('-H', process.env.HOSTNAME || defaultHostname));

if (!/^\d+$/.test(requestedPort)) {
  console.error(`❌ 无效端口: ${requestedPort}`);
  process.exit(1);
}

if (!/^\d+$/.test(requestedWsPort)) {
  console.error(`❌ 无效 WebSocket 端口: ${requestedWsPort}`);
  process.exit(1);
}

function canListen(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve({ ok: false, code: err.code || 'UNKNOWN', message: err.message });
    });
    server.once('listening', () => {
      server.close(() => resolve({ ok: true }));
    });
    server.listen({ host, port, exclusive: true });
  });
}

async function findAvailablePort(host, preferredPort) {
  const first = Number(preferredPort);
  const candidates = [];

  for (let offset = 0; offset < 100; offset += 1) {
    candidates.push(first + offset);
  }
  for (let port = 49152; port < 49252; port += 1) {
    candidates.push(port);
  }

  for (const candidate of candidates) {
    const result = await canListen(host, candidate);
    if (result.ok) {
      return { port: candidate, changed: candidate !== first };
    }
    if (candidate === first) {
      console.warn(`[CLI] 端口 ${candidate} 无法监听 (${result.code}): ${result.message}`);
    }
  }

  console.error('❌ 未找到可用端口。请检查 Windows 防火墙、Hyper-V/WSL 保留端口或安全软件策略。');
  process.exit(1);
}

async function main() {
  const webPortResult = await findAvailablePort(hostname, requestedPort);
  const wsPortResult = await findAvailablePort(hostname, requestedWsPort === String(webPortResult.port) ? webPortResult.port + 1 : requestedWsPort);
  const port = String(webPortResult.port);
  const wsPort = String(wsPortResult.port);

  if (webPortResult.changed) {
    console.warn(`[CLI] Web 端口已自动切换为 ${port}`);
  }
  if (wsPortResult.changed) {
    console.warn(`[CLI] WebSocket 端口已自动切换为 ${wsPort}`);
  }

  // 1. 确保在用户当前运行命令的目录下（或宿主临时目录）创建存储空间，实现免侵入、免污染运行
  const userStorageDir = path.join(process.cwd(), 'share-home-storage');
  if (!fs.existsSync(userStorageDir)) {
    try {
      fs.mkdirSync(userStorageDir, { recursive: true });
      fs.mkdirSync(path.join(userStorageDir, 'shared'), { recursive: true });
      console.log(`[CLI] 已在当前目录下初始化物理存储舱: ${userStorageDir}`);
    } catch (err) {
      console.error(`[CLI] 创建本地存储目录失败: ${err.message}`);
    }
  }

  // 2. 注入环境变量，使 Next.js 服务能够动态读取该路径
  process.env.PORT = port;
  process.env.HOSTNAME = hostname;
  process.env.SHARE_HOME_HOST = hostname;
  process.env.SHARE_HOME_WEB_PORT = port;
  process.env.SHARE_HOME_WS_PORT = wsPort;
  process.env.NEXT_SHARP_PATH = 'none'; // 避免 sharp 依赖报错

  // 3. 编程式寻找 Next.js 核心执行文件
  const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

  if (!fs.existsSync(nextBin)) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 错误: 未能在包中找到 Next.js 核心执行文件，请确保已经完成 pnpm install！');
    process.exit(1);
  }

  console.log(`[CLI] 正在极速拉起 Web 协同服务与信道，请稍候...`);
  console.log(`[CLI] 监听地址: http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
  console.log(`[CLI] WebSocket 端口: ${wsPort}`);

  // 启动 Next.js 生产服务
  const nextStart = fork(nextBin, ['start', '-p', port, '-H', hostname], {
    cwd: projectRoot,
    env: {
      ...process.env,
      // 强制指定项目的物理存储目录，解决宿主物理存储隔离问题
      CUSTOM_STORAGE_PATH: userStorageDir
    }
  });

  nextStart.on('exit', (code) => {
    console.log(`[CLI] Next.js 服务进程已退出，代码: ${code}`);
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('❌ Share Home 启动失败:', err);
  process.exit(1);
});
