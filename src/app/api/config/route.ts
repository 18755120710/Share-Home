import { NextResponse } from 'next/server';
import { ConfigService } from '@/services/configService';

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
    const { storagePath } = await request.json();
    
    if (!storagePath) {
      return NextResponse.json({ success: false, error: '缺少 storagePath 参数' }, { status: 400 });
    }
    
    const configService = ConfigService.getInstance();
    const ok = configService.updateStoragePath(storagePath);
    
    if (ok) {
      return NextResponse.json({
        success: true,
        storagePath: configService.getConfig().storagePath,
        absolutePath: configService.getStoragePath()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '路径无效或系统没有对该路径的写权限'
      }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
