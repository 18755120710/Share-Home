#!/usr/bin/env node

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\x1b[36m%s\x1b[0m', '🚀 正在启动 Share Home 局域网协作平台...');

const projectRoot = path.join(__dirname, '..');

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
process.env.PORT = '8301';
process.env.HOSTNAME = '0.0.0.0';
process.env.NEXT_SHARP_PATH = 'none'; // 避免 sharp 依赖报错

// 3. 编程式寻找 Next.js 核心执行文件
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

if (!fs.existsSync(nextBin)) {
  console.error('\x1b[31m%s\x1b[0m', '❌ 错误: 未能在包中找到 Next.js 核心执行文件，请确保已经完成 pnpm install！');
  process.exit(1);
}

console.log(`[CLI] 正在极速拉起 Web 协同服务与信道，请稍候...`);

// 启动 Next.js 生产服务
const nextStart = fork(nextBin, ['start', '-p', '8301', '-H', '0.0.0.0'], {
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
