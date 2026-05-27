import { NextResponse } from 'next/server';
import { ConfigService } from '@/services/configService';
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

// 物理迁移目录（首选 rename，跨盘符则分步自愈拷贝）
function migrateDirectory(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item.startsWith('.')) continue; // 忽略隐藏系统文件

    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

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
  }
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

export async function GET() {
  try {
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
      newAbsPath = path.resolve(process.cwd(), sanitizedPath);
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
        migrateDirectory(oldAbsPath, newAbsPath);
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
