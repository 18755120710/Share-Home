import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function findProjectPackageJson(): any {
  // 1. 优先通过 CLI 传入的 PROJECT_ROOT 环境变量定位
  if (process.env.PROJECT_ROOT) {
    const checkPath = path.join(process.env.PROJECT_ROOT, 'package.json');
    if (fs.existsSync(checkPath)) {
      try {
        return JSON.parse(fs.readFileSync(checkPath, 'utf-8'));
      } catch (e) {}
    }
  }

  // 2. 其次尝试在当前工作目录 process.cwd()（开发模式下为根目录）下寻找
  try {
    const fallbackPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    }
  } catch (e) {}

  // 3. 再次尝试基于 __dirname 向上逐级查找
  let currentDir = __dirname;
  for (let i = 0; i < 8; i++) {
    const checkPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(checkPath)) {
      try {
        return JSON.parse(fs.readFileSync(checkPath, 'utf-8'));
      } catch (e) {
        break;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return { version: '1.0.8' }; // 静态兜底，更新为当前已发布的 1.0.8 实际版本
}

// 语义化版本号（Semver）比较逻辑：v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/i, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/i, '').split('.').map(Number);
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export async function GET() {
  try {
    const pkg = findProjectPackageJson();
    const currentVersion = pkg.version || '1.0.8';

    // 智能防超时：并发拉取官方 npm 源和镜像源，通过 Promise.allSettled 规避单一源网络超时
    const fetchLatestVersion = async (): Promise<string> => {
      const controllers = [new AbortController(), new AbortController()];
      const timeoutId = setTimeout(() => {
        controllers.forEach(c => c.abort());
      }, 4000); // 4秒超时保护

      const urls = [
        'https://registry.npmjs.org/share-home/latest',
        'https://registry.npmmirror.com/share-home/latest'
      ];

      try {
        const promises = urls.map((url, index) => 
          fetch(url, { signal: controllers[index].signal })
            .then(res => {
              if (!res.ok) throw new Error('HTTP Error');
              return res.json();
            })
            .then(data => data.version as string)
        );

        const results = await Promise.allSettled(promises);
        clearTimeout(timeoutId);

        // 收集所有请求成功的版本号
        const successfulVersions = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && typeof r.value === 'string')
          .map(r => r.value);

        if (successfulVersions.length === 0) {
          throw new Error('NPM 源连接超时，请检查您的网络连接环境');
        }

        // 挑选出最新（最大）的版本号，规避国内镜像源因未完全同步落后于官方源的竞态问题
        successfulVersions.sort(compareVersions);
        return successfulVersions[successfulVersions.length - 1];
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    let latestVersion = currentVersion;
    let hasUpdate = false;
    let errorMsg = '';

    try {
      latestVersion = await fetchLatestVersion();
      // 基于严密的 Semver 语义版本比较，若最新版本号大于当前版本号才认为有更新
      hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    } catch (err: any) {
      errorMsg = err.message || '检测失败';
    }

    return NextResponse.json({
      success: true,
      currentVersion,
      latestVersion,
      hasUpdate,
      error: errorMsg
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
