import { NextRequest, NextResponse } from 'next/server';
import { FileService } from '@/services/fileService';

/**
 * 获取最新局域网公共收纳盒列表
 */
export async function GET() {
  try {
    const boxes = FileService.getInstance().getSharedBoxes();
    return NextResponse.json({ success: true, boxes });
  } catch (err: any) {
    console.error('[SharedBoxesAPI] 获取收纳盒列表失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * 创建一个新的公共收纳盒
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '收纳盒名称不能为空' }, { status: 400 });
    }

    const box = FileService.getInstance().createSharedBox(name.trim(), description?.trim(), color);
    return NextResponse.json({ success: true, box });
  } catch (err: any) {
    console.error('[SharedBoxesAPI] 创建收纳盒失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * 根据 ID 彻底注销某个公共收纳盒 (非破坏性：仅将属于它的文件移回大厅)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 });
    }

    const ok = FileService.getInstance().deleteSharedBox(id);
    if (ok) {
      return NextResponse.json({ success: true, message: '收纳盒已被成功删除，文件已安全释放' });
    } else {
      return NextResponse.json({ success: false, error: '收纳盒未找到或删除失败' }, { status: 404 });
    }
  } catch (err: any) {
    console.error('[SharedBoxesAPI] 删除收纳盒失败:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
