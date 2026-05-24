import { NextResponse } from 'next/server';
import { DocumentService } from '@/services/documentService';
import { SocketService } from '@/services/socketService';
import { KBDocument } from '@/types/document';

export async function POST(request: Request) {
  try {
    const doc: KBDocument = await request.json();
    
    if (!doc.id || !doc.title) {
      return NextResponse.json({ success: false, error: '缺少 id 或 title' }, { status: 400 });
    }
    
    console.log(`[DocSync] 收到来自 ${doc.senderName} 对文档《${doc.title}》的局域网同步投递`);
    
    // 1. 将接收到的文档保存至本地物理 Markdown
    const ok = DocumentService.getInstance().saveDocument(doc);
    
    if (ok) {
      // 2. 实时广播给本机的浏览器页面进行 UI 刷新
      SocketService.getInstance().broadcast('documents:update', doc);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '同步文档物理落盘失败' }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
