import { NextResponse } from 'next/server';
import { DocumentService } from '@/services/documentService';
import { SocketService } from '@/services/socketService';
import { KBDocument } from '@/types/document';
import { AuthService } from '@/services/authService';
import { MdnsService } from '@/services/mdnsService';

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

    // 校验云文档编辑权限防火墙
    const perms = authService.getDevicePermission(clientId);
    if (!perms.allowEditDoc) {
      return NextResponse.json({ 
        success: false, 
        error: 'forbidden_edit_doc', 
        message: '您的局域网云文档编写与修改权限已被超级管理员禁用。' 
      }, { status: 403 });
    }

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

    // 校验云文档编辑与删除权限防火墙
    const perms = authService.getDevicePermission(clientId);
    if (!perms.allowEditDoc) {
      return NextResponse.json({ 
        success: false, 
        error: 'forbidden_edit_doc', 
        message: '您的局域网云文档编写、修改与删除权限已被超级管理员禁用。' 
      }, { status: 403 });
    }

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
