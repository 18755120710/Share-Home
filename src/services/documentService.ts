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
   * 运行时存储路径变更自愈：清空旧路径元数据缓存，强制对新路径进行物理冷重扫并完成拓扑重建
   */
  public reloadService(): void {
    this.isInitialized = false;
    this.cacheDocs = [];
    this.initService();
    console.log('[DocumentService] [自愈] 运行时由于存储路径变更，已成功触发元数据冷重扫与合流！');
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
   * 初始化服务：进行无感平滑迁移或直接加载 meta 索引并重建 B+ 树拓扑
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

        // 2. 将数据载入内存并进行首次 B+ 树拓扑重构与排序
        this.cacheDocs = legacyDocs;
        this.rebuildTreeTopology();

        // 3. 落盘生成带 B+ 索引元数据的 meta.json 索引文件
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
                console.log(`[DocumentService] [B+索引迁移] 已成功安全销毁老旧文件夹物理占位文件: ${fileName}`);
              }
            } catch (err) {
              console.error(`[DocumentService] [B+索引迁移] 物理销毁旧文件夹文件失败: ${fileName}`, err);
            }
          }
        });

        console.log('[DocumentService] 历史数据 B+ 树多维哈希索引构建圆满成功！');
      } else {
        // 直接从 meta.json 加载元数据索引，并按需补充读取对应的物理文件内容
        console.log('[DocumentService] meta.json 存在，从 B+ 树多维元数据索引启动极速加载...');
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

        // 预防性自愈：在读入后重新刷新拓扑树，保障双向指针与路径在任何细微配置偏差下都能完美自愈
        this.rebuildTreeTopology();
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[DocumentService] 初始化文档系统失败:', err);
    }
  }

  /**
   * 🌲 极客 B+ 树多维哈希拓扑自愈算法 (Topological Self-Healing & B+ Indexing Rebuild)
   * 重新计算所有节点的 path, depth, sortOrder, 以及兄弟节点的双向链表指针 prevSiblingId / nextSiblingId
   */
  private rebuildTreeTopology() {
    const nodes = this.cacheDocs;
    if (nodes.length === 0) return;

    // 1. 构建主键哈希表 Map，提供全局 O(1) 的检索支持 (类似于 B+ 树聚簇索引)
    const nodesMap = new Map<string, KBDocument>();
    nodes.forEach(node => nodesMap.set(node.id, node));

    // 2. 将所有节点分为“根节点群”和“子节点群”
    const rootNodes: KBDocument[] = [];
    const parentToChildrenMap = new Map<string, KBDocument[]>();

    nodes.forEach(node => {
      const parentId = node.parentId;
      if (!parentId || !nodesMap.has(parentId)) {
        // 判定为根节点（父ID为空，或者父ID对应的节点在系统里根本不存在）
        node.parentId = null; // 纠正非法的悬挂指针为 null
        rootNodes.push(node);
      } else {
        if (!parentToChildrenMap.has(parentId)) {
          parentToChildrenMap.set(parentId, []);
        }
        parentToChildrenMap.get(parentId)!.push(node);
      }
    });

    // 3. 对同级兄弟群体进行有序链表梳理 (按 sortOrder 升序排列，并对双向链表进行闭合缝合)
    const sortAndLinkSiblings = (siblings: KBDocument[], parentPath: string, parentDepth: number) => {
      // 升序排序：优先按 sortOrder 权重；若没有定义，则按 updatedAt/createdAt 时间正序（最旧的在前面，保持稳定性）
      siblings.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

      // 串联双向链表 (B+ 树叶子双向链表核心体现)
      for (let i = 0; i < siblings.length; i++) {
        const current = siblings[i];
        current.sortOrder = i; // 修正有序权重

        // 串联物化路径 (Materialized Path) 与嵌套深度
        current.path = parentPath;
        current.depth = parentDepth;

        // 前驱指针
        current.prevSiblingId = i > 0 ? siblings[i - 1].id : null;
        // 后继指针
        current.nextSiblingId = i < siblings.length - 1 ? siblings[i + 1].id : null;

        // 递归梳理当前节点的子节点列表
        const children = parentToChildrenMap.get(current.id) || [];
        const nextPath = parentPath ? `${parentPath}/${current.id}` : `/${current.id}`;
        sortAndLinkSiblings(children, nextPath, parentDepth + 1);
      }
    };

    // 从根节点群出发，启动级联拓扑大缝合
    sortAndLinkSiblings(rootNodes, '', 0);

    // 4. 重建 cacheDocs，将已完成拓扑化排序的节点按照“深度优先”或“最新更新”归档回缓存
    // 为了跟之前的 UI 习惯兼容，整体 cacheDocs 保持 updatedAt 倒序，因为前端只管获取平铺列表，前端会自己利用 parentId 进行树形渲染。
    // 在这里重新按最近修改时间倒序排列，但不影响每个节点内已经注入的 path/depth/siblingPointer 指针。
    this.cacheDocs = nodes.sort((a, b) => b.updatedAt - a.updatedAt);
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
      updatedAt: doc.updatedAt,
      
      // 保存 B+ 树物化路径与双向指针参数到索引文件中
      path: doc.path,
      depth: doc.depth,
      sortOrder: doc.sortOrder,
      prevSiblingId: doc.prevSiblingId,
      nextSiblingId: doc.nextSiblingId
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
    // 返回缓存副本以确保外部污染不会破坏底层 B+ 索引的结构
    return JSON.parse(JSON.stringify(this.cacheDocs));
  }

  /**
   * 读取单篇文档的详情
   */
  public getDocumentById(id: string): KBDocument | null {
    this.initService();
    const doc = this.cacheDocs.find(item => item.id === id);
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  /**
   * 保存或更新文档落盘
   */
  public saveDocument(doc: KBDocument): boolean {
    this.initService();
    const docsDir = this.getDocsDir();
    try {
      // 1. 防环路移动安全防御 (Move Cycle-Free Validation)
      if (doc.parentId) {
        const parentNode = this.cacheDocs.find(item => item.id === doc.parentId);
        if (parentNode && parentNode.path) {
          const prefixToCheck = `/${doc.id}`;
          if (parentNode.path.includes(prefixToCheck) || parentNode.path.endsWith(doc.id)) {
            throw new Error(`[B+ Tree Error] 检测到非法环路移动：不能将父目录「${doc.title}」移动到其子孙文件夹中！`);
          }
        }
      }

      // 2. 更新内存缓存 (合并元数据)
      const index = this.cacheDocs.findIndex(item => item.id === doc.id);
      if (index !== -1) {
        // 保留原正文以防外部只提交元属性更新
        const oldContent = this.cacheDocs[index].content;
        this.cacheDocs[index] = { ...doc };
        if (doc.content === undefined || doc.content === null) {
          this.cacheDocs[index].content = oldContent;
        }
      } else {
        this.cacheDocs.unshift({ ...doc });
      }

      // 3. 🌲 执行极其鲁棒的 B+ 树自愈算法，完成级联物化路径重算与兄弟双向串联
      this.rebuildTreeTopology();

      // 4. 将元数据落盘到 meta.json 索引文件
      this.saveMetaToDisk();

      // 5. 内容物理落盘
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
        console.log(`[DocumentService] 文件夹类型「${doc.title}」元数据写入 B+ 树索引，无需物理落盘`);
      }

      return true;
    } catch (err: any) {
      console.error(`[DocumentService] 保存云文档或文件夹失败: ${doc.title}`, err);
      // 抛出错误以供上游 API route 捕获，可以给出精准的提示
      throw err;
    }
  }

  /**
   * 删除本地文档 (利用物化路径前缀一次性 O(N) 批量剪枝删除子树，免去多次磁盘 I/O 递归)
   */
  public deleteDocument(id: string): boolean {
    this.initService();
    const docsDir = this.getDocsDir();
    try {
      // 1. 获取对应的内存元数据
      const targetNode = this.cacheDocs.find(item => item.id === id);
      if (!targetNode) {
        console.warn(`[DocumentService] 未找到要删除的文档/文件夹 id: ${id}`);
        return false;
      }

      // 2. 物化路径剪枝扫描：获取要删除的节点本身，以及所有子孙节点
      const prefixToDelete = targetNode.path ? `${targetNode.path}/${targetNode.id}` : `/${targetNode.id}`;
      const toDeleteNodes = this.cacheDocs.filter(node => 
        node.id === id || (node.path && (node.path === prefixToDelete || node.path.startsWith(prefixToDelete + '/')))
      );

      const toDeleteIds = new Set(toDeleteNodes.map(n => n.id));
      console.log(`[DocumentService] [B+ 树范围剪枝] 即将批量删除节点数: ${toDeleteIds.size}`);

      // 3. 从内存缓存中移去这些元数据
      this.cacheDocs = this.cacheDocs.filter(item => !toDeleteIds.has(item.id));

      // 4. 重塑拓扑结构并保存 meta.json
      this.rebuildTreeTopology();
      this.saveMetaToDisk();

      // 5. 批量物理清除磁盘上的文档实体
      toDeleteNodes.forEach(node => {
        if (node.type === 'file') {
          // 尝试删除新格式文件: {id}.md
          const newPath = path.join(docsDir, `${node.id}.md`);
          if (fs.existsSync(newPath)) {
            try {
              fs.unlinkSync(newPath);
              console.log(`[DocumentService] 已物理删除剪枝文档: ${newPath}`);
            } catch (e) {
              console.error(`物理删除 ${newPath} 失败`, e);
            }
          }

          // 尝试删除兼容格式老文件: {id}_*.md
          try {
            const files = fs.readdirSync(docsDir);
            files.forEach(fileName => {
              if (fileName.startsWith(`${node.id}_`) && fileName.endsWith('.md')) {
                fs.unlinkSync(path.join(docsDir, fileName));
                console.log(`[DocumentService] 成功清理并物理删除老格式文档物理文件: ${fileName}`);
              }
            });
          } catch (err) {
            console.error(`[DocumentService] 物理删除老格式文档文件失败`, err);
          }
        }
      });

      return true;
    } catch (err: any) {
      console.error(`[DocumentService] 批量删除文档子树失败: ${id}`, err);
      throw err;
    }
  }
}
