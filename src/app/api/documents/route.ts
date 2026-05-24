import { NextResponse } from 'next/server';
import { DocumentService } from '@/services/documentService';
import { SocketService } from '@/services/socketService';
import { KBDocument } from '@/types/document';

export async function GET() {
  try {
    const docs = DocumentService.getInstance().getDocuments();
    return NextResponse.json({ success: true, documents: docs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const doc: KBDocument = await request.json();
    
    if (!doc.id || !doc.title) {
      return NextResponse.json({ success: false, error: '缺少必需的文档参数 (id 或 title)' }, { status: 400 });
    }
    
    const docService = DocumentService.getInstance();
    const ok = docService.saveDocument(doc);
    
    if (ok) {
      // 实时广播给本机的浏览器网页，进行状态同步
      SocketService.getInstance().broadcast('documents:update', doc);
      return NextResponse.json({ success: true, document: doc });
    } else {
      return NextResponse.json({ success: false, error: '文档落盘写入物理文件失败' }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少 id 参数' }, { status: 400 });
    }
    
    const docService = DocumentService.getInstance();
    const ok = docService.deleteDocument(id);
    
    if (ok) {
      SocketService.getInstance().broadcast('documents:delete', { id });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '未找到该文档或删除失败' }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
