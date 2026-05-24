import { NextRequest, NextResponse } from 'next/server';
import { FileService } from '@/services/fileService';

/**
   * 拉取最新的局域网公共文件列表
   */
export async function GET() {
  try {
    const files = FileService.getInstance().getSharedFiles();
    return NextResponse.json({ success: true, files });
  } catch (err: any) {
    console.error('[SharedFilesAPI] 获取文件列表失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
   * 根据 ID 彻底注销并物理删除某个公共共享文件
   */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 });
    }

    const ok = FileService.getInstance().deleteSharedFile(id);
    if (ok) {
      return NextResponse.json({ success: true, message: '共享文件已被物理删除' });
    } else {
      return NextResponse.json({ success: false, error: '文件未找到或删除失败' }, { status: 404 });
    }
  } catch (err: any) {
    console.error('[SharedFilesAPI] 删除文件失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
