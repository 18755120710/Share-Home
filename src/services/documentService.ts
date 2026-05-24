import fs from 'fs';
import path from 'path';
import { KBDocument } from '@/types/document';
import { ConfigService } from './configService';

export class DocumentService {
  private constructor() {}

  public static getInstance(): DocumentService {
    const globalSymbols = global as any;
    if (!globalSymbols.__document_service_instance__) {
      globalSymbols.__document_service_instance__ = new DocumentService();
    }
    return globalSymbols.__document_service_instance__;
  }

  /**
   * 获取文档保存的 docs 子物理路径
   */
  private getDocsDir(): string {
    const storagePath = ConfigService.getInstance().getStoragePath();
    const docsDir = path.join(storagePath, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    return docsDir;
  }

  /**
   * 将文档对象序列化为带 Front Matter 的标准 Markdown 字符串
   */
  private serialize(doc: KBDocument): string {
    // 过滤掉内容里的 yaml 分割符，确保 Front Matter 解析稳健
    return [
      '---',
      `id: ${doc.id}`,
      `title: ${doc.title.replace(/:/g, ' ')}`,
      `senderId: ${doc.senderId}`,
      `senderName: ${doc.senderName}`,
      `senderAvatar: ${doc.senderAvatar}`,
      `updatedAt: ${doc.updatedAt}`,
      `createdAt: ${doc.createdAt}`,
      '---',
      doc.content
    ].join('\n');
  }

  /**
   * 从带 Front Matter 的 Markdown 文本中解析出 KBDocument
   */
  private deserialize(fileContent: string): KBDocument | null {
    try {
      const lines = fileContent.split(/\r?\n/);
      if (lines[0]?.trim() !== '---') return null;

      let endIdx = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === '---') {
          endIdx = i;
          break;
        }
      }

      if (endIdx === -1) return null;

      const metaLines = lines.slice(1, endIdx);
      const content = lines.slice(endIdx + 1).join('\n');
      
      const meta: any = {};
      metaLines.forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          meta[key] = value;
        }
      });

      return {
        id: meta.id || '',
        title: meta.title || '无标题文档',
        senderId: meta.senderId || 'unknown',
        senderName: meta.senderName || '匿名',
        senderAvatar: meta.senderAvatar || 'avatar-1',
        updatedAt: parseInt(meta.updatedAt || '0', 10) || Date.now(),
        createdAt: parseInt(meta.createdAt || '0', 10) || Date.now(),
        content: content
      };
    } catch (err) {
      console.error('[DocumentService] 反序列化 Markdown 失败:', err);
      return null;
    }
  }

  /**
   * 获取本地所有的文档列表（不包含大体量的 content）
   */
  public getDocuments(): KBDocument[] {
    const docsDir = this.getDocsDir();
    const docs: KBDocument[] = [];

    try {
      const files = fs.readdirSync(docsDir);
      files.forEach(fileName => {
        if (fileName.endsWith('.md')) {
          const filePath = path.join(docsDir, fileName);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const doc = this.deserialize(fileContent);
          if (doc) {
            docs.push(doc);
          }
        }
      });
    } catch (err) {
      console.error('[DocumentService] 读取文档列表异常:', err);
    }

    // 按最近更新时间倒序排列
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 读取单篇文档的详情
   */
  public getDocumentById(id: string): KBDocument | null {
    const docsDir = this.getDocsDir();
    try {
      const files = fs.readdirSync(docsDir);
      for (const fileName of files) {
        if (fileName.endsWith('.md')) {
          const filePath = path.join(docsDir, fileName);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const doc = this.deserialize(fileContent);
          if (doc && doc.id === id) {
            return doc;
          }
        }
      }
    } catch (err) {
      console.error(`[DocumentService] 获取文档详情失败 id: ${id}`, err);
    }
    return null;
  }

  /**
   * 保存或更新文档落盘
   */
  public saveDocument(doc: KBDocument): boolean {
    const docsDir = this.getDocsDir();
    try {
      // 安全的文件名规范：文档ID_标题.md
      const safeTitle = doc.title.replace(/[\\/:*?"<>|]/g, '_');
      
      // 在写入新文件前，若有旧标题同 ID 的 md，先予删除，防止产生垃圾冗余文件
      const files = fs.readdirSync(docsDir);
      for (const fileName of files) {
        if (fileName.endsWith('.md')) {
          const filePath = path.join(docsDir, fileName);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const oldDoc = this.deserialize(fileContent);
          if (oldDoc && oldDoc.id === doc.id) {
            fs.unlinkSync(filePath);
            break;
          }
        }
      }

      // 写入新文件
      const finalFileName = `${doc.id}_${safeTitle}.md`;
      const finalPath = path.join(docsDir, finalFileName);
      const serialized = this.serialize(doc);
      
      fs.writeFileSync(finalPath, serialized, 'utf-8');
      console.log(`[DocumentService] 文档成功写入物理落盘: ${finalPath}`);
      return true;
    } catch (err) {
      console.error(`[DocumentService] 文档落盘失败: ${doc.title}`, err);
      return false;
    }
  }

  /**
   * 删除本地文档
   */
  public deleteDocument(id: string): boolean {
    const docsDir = this.getDocsDir();
    try {
      const files = fs.readdirSync(docsDir);
      for (const fileName of files) {
        if (fileName.endsWith('.md')) {
          const filePath = path.join(docsDir, fileName);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const doc = this.deserialize(fileContent);
          if (doc && doc.id === id) {
            fs.unlinkSync(filePath);
            console.log(`[DocumentService] 文档物理文件已删除: ${filePath}`);
            return true;
          }
        }
      }
    } catch (err) {
      console.error(`[DocumentService] 删除文档失败: ${id}`, err);
    }
    return false;
  }
}
