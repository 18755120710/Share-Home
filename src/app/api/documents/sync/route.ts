import { NextResponse } from 'next/server';
import { DocumentService } from '@/services/documentService';
import { SocketService } from '@/services/socketService';
import { KBDocument } from '@/types/document';
import { AuthService } from '@/services/authService';
import { MdnsService } from '@/services/mdnsService';

export async function POST(request: Request) {
  try {
    const mdns = MdnsService.getInstance();
    const authService = AuthService.getInstance();

    // 解析 IP 并换算为 clientId
    let clientIp = '127.0.0.1';
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      clientIp = forwardedFor.split(',')[0].trim();
    }
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === 'localhost') {
      clientIp = mdns.getLocalIp();
    }
    const clientId = `peer_${clientIp.replace(/\./g, '_')}`;

    const doc: KBDocument = await request.json();
    
    if (!doc.id || !doc.title) {
      return NextResponse.json({ success: false, error: '缺少 id 或 title' }, { status: 400 });
    }

    const isCreate = !DocumentService.getInstance().getDocuments().some(item => item.id === doc.id);

    // 校验云文档同步、新建与编辑权限防火墙
    const perms = authService.getDevicePermission(clientId);
    if (isCreate && !perms.allowCreateDoc) {
      return NextResponse.json({ 
        success: false, 
        error: 'forbidden_create_doc', 
        message: '您的局域网云文档新建同步权限已被超级管理员禁用。' 
      }, { status: 403 });
    }

    if (!isCreate && !perms.allowEditDoc) {
      return NextResponse.json({ 
        success: false, 
        error: 'forbidden_edit_doc', 
        message: '您的局域网云文档编写与同步权限已被超级管理员禁用。' 
      }, { status: 403 });
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
