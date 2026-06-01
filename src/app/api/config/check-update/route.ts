import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function findProjectPackageJson(): any {
  let currentDir = __dirname;
  for (let i = 0; i < 6; i++) {
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
  // 兜底读取
  try {
    const fallbackPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    }
  } catch (e) {}
  return { version: '1.0.7' }; // 静态兜底
}

export async function GET() {
  try {
    const pkg = findProjectPackageJson();
    const currentVersion = pkg.version || '1.0.7';

    // 智能防超时：并发拉取官方 npm 源和镜像源以防网络连接超时
    const fetchLatestVersion = async (): Promise<string> => {
      const controllers = [new AbortController(), new AbortController()];
      const timeoutId = setTimeout(() => {
        controllers.forEach(c => c.abort());
      }, 3500); // 3.5秒超时保护

      const urls = [
        'https://registry.npmmirror.com/share-home/latest',
        'https://registry.npmjs.org/share-home/latest'
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

        const latest = await Promise.any(promises);
        clearTimeout(timeoutId);
        return latest;
      } catch (err) {
        clearTimeout(timeoutId);
        throw new Error('NPM 源连接超时，请检查您的网络连接环境');
      }
    };

    let latestVersion = currentVersion;
    let hasUpdate = false;
    let errorMsg = '';

    try {
      latestVersion = await fetchLatestVersion();
      hasUpdate = latestVersion !== currentVersion;
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
