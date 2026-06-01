import { NextResponse } from 'next/server';
import { ConfigService } from '@/services/configService';
import { SocketService } from '@/services/socketService';
import { AuthService } from '@/services/authService';
import fs from 'fs';
import path from 'path';

// 检查目录内是否存在真实的历史用户数据文件（排除系统隐藏及校验文件）
function hasUserData(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    const files = fs.readdirSync(dir);
    const dataFiles = files.filter(f => !f.startsWith('.') && f !== 'config-settings.json');
    return dataFiles.length > 0;
  } catch (e) {
    return false;
  }
}

// 优雅呼吸感微延时函数（非阻塞）
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 物理迁移目录（首选 rename，跨盘符则分步自愈拷贝并基于 WebSocket 推送进度，带优雅呼吸时序）
async function migrateDirectory(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const rawItems = fs.readdirSync(src);
  const items = rawItems.filter(item => !item.startsWith('.') && item !== 'config-settings.json');
  const total = items.length;
  let current = 0;

  const socketService = SocketService.getInstance();
  // 1. 发送初始进度 0%
  socketService.broadcast('migration:progress', {
    total,
    current: 0,
    percentage: 0,
    currentFile: '正在初始化目录合并...'
  });
  
  // 给予 0% 状态一个 250ms 的初始舒适缓冲
  await delay(250);

  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    current++;
    // 2. 发送当前正在搬运的文件的百分比进度
    socketService.broadcast('migration:progress', {
      total,
      current,
      percentage: Math.round((current / total) * 100),
      currentFile: item
    });

    try {
      // 尝试同逻辑分区瞬间移动
      fs.renameSync(srcPath, destPath);
    } catch (err: any) {
      if (err.code === 'EXDEV' || err.message.includes('cross-device')) {
        // 跨物理磁盘设备移动，触发降级自愈
        moveCrossDevice(srcPath, destPath);
      } else {
        throw err;
      }
    }
    
    // 每一个文件完成物理搬运后，加入 180ms 的平滑呼吸缓冲
    // 即使在高速 rename 场景下，也能呈现出起伏有序的跃动拉伸进度
    await delay(180);
  }

  // 3. 发送终期 100% 完成信号
  socketService.broadcast('migration:progress', {
    total,
    current: total,
    percentage: 100,
    currentFile: '所有历史大文件及云文档已安全合流重组！'
  });
  
  // 终期 100% 成功状态停留半秒，让用户从容阅毕，极具安全仪式感
  await delay(600);
}

// 跨盘移动递归处理，支持子目录和文件
function moveCrossDevice(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      moveCrossDevice(path.join(src, file), path.join(dest, file));
    }
    try {
      fs.rmdirSync(src);
    } catch (e) {}
  } else {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

export async function GET(request: Request) {
  try {
    // 后端管理员鉴权
    const authService = AuthService.getInstance();
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || '';
    const session = authService.verifySession(token);
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'forbidden',
        message: '权限不足，仅管理员有权访问系统配置'
      }, { status: 403 });
    }

    const configService = ConfigService.getInstance();
    const config = configService.getConfig();
    const absolutePath = configService.getStoragePath();
    
    return NextResponse.json({
      success: true,
      storagePath: config.storagePath,
      absolutePath: absolutePath
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 后端管理员鉴权
    const authService = AuthService.getInstance();
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || '';
    const session = authService.verifySession(token);
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'forbidden',
        message: '权限不足，仅管理员有权修改系统配置'
      }, { status: 403 });
    }

    const { storagePath, migrate } = await request.json();
    
    if (!storagePath) {
      return NextResponse.json({ success: false, error: '缺少 storagePath 参数' }, { status: 400 });
    }
    
    const configService = ConfigService.getInstance();
    
    // 1. 解析原物理绝对路径与拟修改的新物理绝对路径
    const oldAbsPath = configService.getStoragePath();
    
    let newAbsPath = '';
    const sanitizedPath = storagePath.trim();
    if (path.isAbsolute(sanitizedPath)) {
      newAbsPath = sanitizedPath;
    } else {
      // 强锁基准为 App 物理根目录，杜绝 process.cwd 路径漂移风险
      newAbsPath = path.resolve(configService.getAppDataDir(), sanitizedPath);
    }
    
    // 2. 校验新路径读写权限（通过 updateStoragePath 的写测试，但不修改配置，先做预测试）
    try {
      if (!fs.existsSync(newAbsPath)) {
        fs.mkdirSync(newAbsPath, { recursive: true });
      }
      const testFile = path.join(newAbsPath, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: '新路径无效或系统没有对该路径的写权限'
      }, { status: 400 });
    }
    
    // 3. 判断新旧路径是否指向同一个物理目录
    const isSamePath = oldAbsPath === newAbsPath;
    
    // 4. 第一阶段：如果新旧路径不同，旧目录有数据，且 migrate 参数未指定
    if (!isSamePath && hasUserData(oldAbsPath) && migrate === undefined) {
      return NextResponse.json({
        success: true,
        requireMigration: true,
        oldPath: oldAbsPath,
        newPath: newAbsPath
      });
    }
    
    // 5. 第二阶段：如果用户确认迁移数据 (migrate === true)
    if (!isSamePath && migrate === true) {
      try {
        console.log(`[ConfigAPI] 正在执行数据迁移: 从 ${oldAbsPath} 到 ${newAbsPath}`);
        await migrateDirectory(oldAbsPath, newAbsPath);
        console.log(`[ConfigAPI] 数据迁移合并成功！`);
      } catch (err: any) {
        console.error('[ConfigAPI] 数据迁移失败:', err);
        return NextResponse.json({
          success: false,
          error: `数据迁移失败: ${err.message || '请确保旧目录文件未被占用'}`
        }, { status: 500 });
      }
    }
    
    // 6. 执行真实的路径配置更新
    const ok = configService.updateStoragePath(sanitizedPath);
    
    if (ok) {
      return NextResponse.json({
        success: true,
        requireMigration: false,
        storagePath: configService.getConfig().storagePath,
        absolutePath: configService.getStoragePath(),
        migrated: migrate === true
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '更新存储路径配置失败'
      }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
