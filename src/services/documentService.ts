import fs from 'fs';
import path from 'path';
import { KBDocument } from '@/types/document';
import { ConfigService } from './configService';

export class DocumentService {
  private cacheDocs: KBDocument[] = [];
  private isInitialized = false;

  private constructor() {
    this.initService();
  }

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
   * 获取 meta.json 索引文件路径
   */
  private getMetaPath(): string {
    return path.join(this.getDocsDir(), 'meta.json');
  }

  /**
   * 初始化服务：进行无感平滑迁移或直接加载 meta 索引
   */
  private initService() {
    if (this.isInitialized) return;
    const docsDir = this.getDocsDir();
    const metaPath = this.getMetaPath();

    try {
      if (!fs.existsSync(metaPath)) {
        console.log('[DocumentService] 索引文件 meta.json 不存在，启动历史数据智能迁移...');
        const legacyDocs: KBDocument[] = [];
        const files = fs.readdirSync(docsDir);

        // 1. 全量扫描并解析旧的带 Frontmatter 的 .md 文件
        files.forEach(fileName => {
          if (fileName.endsWith('.md')) {
            const filePath = path.join(docsDir, fileName);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const doc = this.deserializeLegacy(fileContent);
            if (doc) {
              legacyDocs.push(doc);
            }
          }
        });

        // 2. 将数据归档存入内存缓存
        this.cacheDocs = legacyDocs.sort((a, b) => b.updatedAt - a.updatedAt);

        // 3. 落盘生成 meta.json 索引文件 (仅存元数据，不存 content 以实现轻量化)
        this.saveMetaToDisk();

        // 4. 清理旧时代遗留物：自动物理销毁所有代表文件夹的旧 .md 物理文件
        files.forEach(fileName => {
          if (fileName.endsWith('.md')) {
            const filePath = path.join(docsDir, fileName);
            try {
              const fileContent = fs.readFileSync(filePath, 'utf-8');
              const doc = this.deserializeLegacy(fileContent);
              if (doc && doc.type === 'folder') {
                fs.unlinkSync(filePath);
                console.log(`[DocumentService] [智能迁移] 已成功安全销毁老旧文件夹物理占位文件: ${fileName}`);
              }
            } catch (err) {
              console.error(`[DocumentService] [智能迁移] 物理销毁旧文件夹文件失败: ${fileName}`, err);
            }
          }
        });

        console.log('[DocumentService] 历史数据智能平滑迁移圆满成功！');
      } else {
        // 直接从 meta.json 加载元数据索引，并按需补充读取对应的物理文件内容
        console.log('[DocumentService] meta.json 存在，从元数据索引启动极速加载...');
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const metaData = JSON.parse(metaContent);
        const metaDocs: KBDocument[] = metaData.documents || [];

        // 全量将元数据载入缓存，并依次补充读取 file 的 content 内容进内存
        this.cacheDocs = metaDocs.map(doc => {
          if (doc.type === 'file') {
            doc.content = this.readPhysicalContent(doc.id, doc.title);
          } else {
            doc.content = '';
          }
          return doc;
        });
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[DocumentService] 初始化文档系统失败:', err);
    }
  }

  /**
   * 按需读取具体的物理文件正文内容 (向前兼容，支持新旧两种文件名格式)
   */
  private readPhysicalContent(id: string, title: string): string {
    const docsDir = this.getDocsDir();
    
    // 1. 优先尝试最简洁的新格式: {id}.md
    const newPath = path.join(docsDir, `${id}.md`);
    if (fs.existsSync(newPath)) {
      const content = fs.readFileSync(newPath, 'utf-8');
      return this.stripFrontMatter(content);
    }

    // 2. 向前兼容老格式: {id}_{safeTitle}.md
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    const oldPath = path.join(docsDir, `${id}_${safeTitle}.md`);
    if (fs.existsSync(oldPath)) {
      const content = fs.readFileSync(oldPath, 'utf-8');
      return this.stripFrontMatter(content);
    }

    // 3. 兜底策略：如果因为改名等原因没有严格匹配，则前缀扫描
    try {
      const files = fs.readdirSync(docsDir);
      for (const file of files) {
        if (file.startsWith(`${id}_`) && file.endsWith('.md')) {
          const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
          return this.stripFrontMatter(content);
        }
      }
    } catch (err) {
      console.error(`[DocumentService] 兜底扫描匹配文档正文失败 id: ${id}`, err);
    }

    return '';
  }

  /**
   * 剥离可能存在的老格式 Frontmatter
   */
  private stripFrontMatter(content: string): string {
    const lines = content.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') return content;

    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) return content;
    return lines.slice(endIdx + 1).join('\n');
  }

  /**
   * 将内存缓存的元数据落盘到 meta.json
   */
  private saveMetaToDisk() {
    const metaPath = this.getMetaPath();
    const metaDocs = this.cacheDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      parentId: doc.parentId,
      senderId: doc.senderId,
      senderName: doc.senderName,
      senderAvatar: doc.senderAvatar,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    fs.writeFileSync(
      metaPath,
      JSON.stringify({ version: 1, documents: metaDocs }, null, 2),
      'utf-8'
    );
  }

  /**
   * 从带 Front Matter 的老版本 Markdown 文本中解析出 KBDocument (专用于智能迁移)
   */
  private deserializeLegacy(fileContent: string): KBDocument | null {
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
        type: (meta.type as 'file' | 'folder') || 'file',
        parentId: meta.parentId || null,
        content: content
      };
    } catch (err) {
      console.error('[DocumentService] 反序列化老 Markdown 失败:', err);
      return null;
    }
  }

  /**
   * 获取本地所有的文档列表（全内存极速响应）
   */
  public getDocuments(): KBDocument[] {
    this.initService();
    return [...this.cacheDocs];
  }

  /**
   * 读取单篇文档的详情
   */
  public getDocumentById(id: string): KBDocument | null {
    this.initService();
    const doc = this.cacheDocs.find(item => item.id === id);
    if (!doc) return null;
    return { ...doc };
  }

  /**
   * 保存或更新文档落盘
   */
  public saveDocument(doc: KBDocument): boolean {
    this.initService();
    const docsDir = this.getDocsDir();
    try {
      // 1. 更新内存缓存
      const index = this.cacheDocs.findIndex(item => item.id === doc.id);
      if (index !== -1) {
        this.cacheDocs[index] = { ...doc };
      } else {
        this.cacheDocs.unshift({ ...doc });
      }

      // 2. 按最近更新时间倒序重新排列
      this.cacheDocs.sort((a, b) => b.updatedAt - a.updatedAt);

      // 3. 将元数据落盘到 meta.json 索引文件
      this.saveMetaToDisk();

      // 4. 内容物理落盘
      if (doc.type === 'file') {
        const filePath = path.join(docsDir, `${doc.id}.md`);
        // 新时代只写入纯文本，不写入 Frontmatter，极致纯净
        fs.writeFileSync(filePath, doc.content || '', 'utf-8');

        // 安全清理：如果是从老格式升级，或者发生过修改，扫描并物理清理所有的 `${id}_*.md` 历史文件，防止磁盘垃圾
        const files = fs.readdirSync(docsDir);
        files.forEach(fileName => {
          if (fileName.startsWith(`${doc.id}_`) && fileName.endsWith('.md')) {
            try {
              fs.unlinkSync(path.join(docsDir, fileName));
              console.log(`[DocumentService] 成功清理旧格式或多余的物理文件: ${fileName}`);
            } catch (err) {
              console.error(`[DocumentService] 清理旧格式物理文件失败: ${fileName}`, err);
            }
          }
        });
      } else {
        // 文件夹类型在重构后，磁盘上不做任何落盘，只依靠 meta.json 记录
        console.log(`[DocumentService] 文件夹类型「${doc.title}」元数据写入索引，无需物理落盘`);
      }

      return true;
    } catch (err) {
      console.error(`[DocumentService] 保存文档或文件夹失败: ${doc.title}`, err);
      return false;
    }
  }

  /**
   * 删除本地文档
   */
  public deleteDocument(id: string): boolean {
    this.initService();
    const docsDir = this.getDocsDir();
    try {
      // 1. 获取对应的内存元数据，判断是否是文档
      const doc = this.cacheDocs.find(item => item.id === id);
      if (!doc) {
        console.warn(`[DocumentService] 未找到要删除的文档/文件夹 id: ${id}`);
        return false;
      }

      // 2. 从内存缓存中移去该元数据
      this.cacheDocs = this.cacheDocs.filter(item => item.id !== id);

      // 3. 落盘更新索引 meta.json
      this.saveMetaToDisk();

      // 4. 若为文档，物理删除具体的正文文件
      if (doc.type === 'file') {
        // 尝试删除新格式文件: {id}.md
        const newPath = path.join(docsDir, `${id}.md`);
        if (fs.existsSync(newPath)) {
          fs.unlinkSync(newPath);
          console.log(`[DocumentService] 文档物理文件已成功删除: ${newPath}`);
        }

        // 尝试删除兼容格式老文件: {id}_*.md
        const files = fs.readdirSync(docsDir);
        files.forEach(fileName => {
          if (fileName.startsWith(`${id}_`) && fileName.endsWith('.md')) {
            try {
              fs.unlinkSync(path.join(docsDir, fileName));
              console.log(`[DocumentService] 成功清理并物理删除老格式文档物理文件: ${fileName}`);
            } catch (err) {
              console.error(`[DocumentService] 物理删除老格式文档文件失败: ${fileName}`, err);
            }
          }
        });
      } else {
        console.log(`[DocumentService] 文件夹「${doc.title}」已从元数据索引 meta.json 中顺利注销`);
      }

      return true;
    } catch (err) {
      console.error(`[DocumentService] 删除文档失败: ${id}`, err);
    }
    return false;
  }
}
