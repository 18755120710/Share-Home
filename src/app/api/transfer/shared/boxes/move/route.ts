import { NextRequest, NextResponse } from 'next/server';
import { FileService } from '@/services/fileService';

/**
 * 将指定的一个或多个共享文件转移到特定收纳盒中 (移出为 null)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileIds, boxId } = body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ success: false, error: '缺少有效的文件 ID 列表' }, { status: 400 });
    }

    const ok = FileService.getInstance().moveFilesToBox(fileIds, boxId);
    if (ok) {
      return NextResponse.json({ success: true, message: '共享文件转移成功' });
    } else {
      return NextResponse.json({ success: false, error: '文件未找到或转移失败' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[MoveFilesAPI] 转移文件失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
