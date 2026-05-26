import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Peer } from '@/types/peer';
import { KBDocument } from '@/types/document';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { 
  Plus, FileText, Trash2, Edit2, Check, X, Eye, Edit3, 
  Bold, Italic, Heading, Quote, List, Code, Copy, 
  CheckSquare, Globe, Save, Columns, ChevronsLeft, ChevronsRight,
  Folder, FolderOpen, FolderPlus, ChevronDown, ChevronRight, CornerDownRight, Move
} from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import { SocketClient } from '@/lib/socketClient';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// 导入常用的 Prism 语法高亮语言组件
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';

interface KnowledgeBaseProps {
  peers: Peer[];
  self: Peer | null;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ peers, self }) => {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'write' | 'read'>('split');

  // 知识库目录栏折叠状态 (持久化偏好缓存)
  const [isKbSidebarCollapsed, setIsKbSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kb_sidebar_collapsed') === 'true';
      setIsKbSidebarCollapsed(saved);
    }
  }, []);

  const toggleKbSidebar = () => {
    const next = !isKbSidebarCollapsed;
    setIsKbSidebarCollapsed(next);
    localStorage.setItem('kb_sidebar_collapsed', String(next));
  };
  
  // 编辑中的临时状态
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  // 300ms 智能防抖预览内容状态，用来解脱打字全量重渲染，极大优化性能！
  const [contentPreview, setContentPreview] = useState('');
  
  // 大纲目录面板 (TOC) 展开折叠状态 (持久化偏好缓存)
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kb_outline_open') !== 'false';
      setIsOutlineOpen(saved);
    }
  }, []);

  const toggleOutline = () => {
    const next = !isOutlineOpen;
    setIsOutlineOpen(next);
    localStorage.setItem('kb_outline_open', String(next));
    
    // 联动逻辑：一旦开启右侧大纲，左侧文档树侧边栏立刻自动收缩折叠，腾出核心创作视野！
    if (next) {
      setIsKbSidebarCollapsed(true);
      localStorage.setItem('kb_sidebar_collapsed', 'true');
    }
  };
  
  // 重命名文档状态
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // 云文件夹折叠与展开状态 Set (保存已展开的 folder.id)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  // 正在进行归属移动 (移动到...) 的 KBDocument.id
  const [movingDocId, setMovingDocId] = useState<string | null>(null);

  // 文件夹展开/折叠开关
  const toggleFolderExpand = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  /**
   * 移动文档归属文件夹 (快捷切换 parentId 属性)
   */
  const handleMoveDocument = async (docId: string, targetParentId: string | null) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc || !self) return;

    const updatedDoc: KBDocument = {
      ...doc,
      parentId: targetParentId,
      senderId: self.id,
      senderName: self.nickname,
      senderAvatar: self.avatar,
      updatedAt: Date.now()
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDoc)
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
        // 如果当前正处于选中状态，更新本地 preview 状态以保证最新
        if (selectedId === docId) {
          setContentPreview(updatedDoc.content);
        }
        setMovingDocId(null);
        broadcastSync(updatedDoc);
      }
    } catch (err) {
      console.error('[KB] 移动文档位置落盘失败:', err);
    }
  };

  /**
   * 根目录或指定文件夹下新建云文件夹 (type: 'folder')
   */
  const handleCreateFolder = async (targetParentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!self) return;

    const folderId = generateUUID();
    const newFolder: KBDocument = {
      id: folderId,
      title: '未命名云文件夹',
      content: '', // 文件夹正文为空即可
      type: 'folder',
      parentId: targetParentId,
      senderId: self.id,
      senderName: self.nickname,
      senderAvatar: self.avatar,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFolder)
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => [newFolder, ...prev]);
        // 自动将父级文件夹设为展开状态，方便用户瞬间看到新建项
        if (targetParentId) {
          setExpandedFolderIds(prev => {
            const next = new Set(prev);
            next.add(targetParentId);
            return next;
          });
        }
        broadcastSync(newFolder);
      }
    } catch (err) {
      console.error('[KB] 创建文件夹物理写入失败:', err);
    }
  };

  // 状态指示
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // 引用 textarea 元素，供工具栏插入字符使用
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 用来做预览和大纲计算的防抖定时器
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedDoc = documents.find(d => d.id === selectedId) || null;

  // 用一个 ref 存放最新的 titleInput，使 Tiptap 在 onUpdate 里读取到的 titleInput 始终是最新值
  const titleInputRef = useRef(titleInput);
  useEffect(() => {
    titleInputRef.current = titleInput;
  }, [titleInput]);

  // 初始化 Tiptap 富文本离线编辑器 (整合 tiptap-markdown 做到飞书般的实时输入预览)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false, // 禁用 HTML 输出，保障完全是纯 Markdown 互转
        linkify: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder: '在这里开始书写飞书般的文档协作体验，输入 Markdown 标识符即时渲染...',
        emptyEditorClass: 'is-editor-empty',
      })
    ],
    content: selectedDoc ? selectedDoc.content : '',
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;

        // 启发式判断：如果行首包含标题(# )、无序列表(- /* )、引用(> )或加粗(**)或代码块(```)，就当作 Markdown 粘贴
        const isMarkdown = /^\s*(?:#+\s|-+\s|\*+\s|>+\s|```)/m.test(text) || text.includes('**') || text.includes('`');
        const parser = (view as any).editor?.storage?.markdown?.parser;

        if (isMarkdown && parser) {
          try {
            // 调用 tiptap-markdown 的 parser 将其转换为 HTML
            const html = parser.parse(text);

            // 转化为 ProseMirror slice 并安全插入
            const element = document.createElement('div');
            element.innerHTML = html;

            const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(element, {
              preserveWhitespace: true,
            });

            const transaction = view.state.tr.replaceSelection(slice);
            view.dispatch(transaction);
            return true; // 拦截默认粘贴
          } catch (e) {
            console.error('[KB] 自定义 Markdown 粘贴拦截解析失败:', e);
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      // 提取编辑器中的 Markdown 并更新状态，触发防抖自动落盘与 WebSocket 同步
      const markdown = (editor.storage as any).markdown.getMarkdown();
      setContentInput(markdown);
      
      // 1. 防抖保存落盘与广播（1秒防抖）
      triggerAutoSave(titleInputRef.current, markdown);

      // 2. 预览与目录提取防抖（300ms防抖更新，彻底解放打字卡顿！）
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = setTimeout(() => {
        setContentPreview(markdown);
      }, 300);
    }
  });

  // 当选择文档改变或物理落盘更新时，将内容双向填充到富文本编辑器
  useEffect(() => {
    if (editor && selectedDoc) {
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      if (currentMarkdown !== selectedDoc.content) {
        editor.commands.setContent(selectedDoc.content);
      }
    }
  }, [selectedDoc?.content, editor]);

  // 1. 初始化拉取本地文档列表
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.success && data.documents) {
        setDocuments(data.documents);
        // 默认选中第一篇
        if (data.documents.length > 0 && !selectedId) {
          selectDocument(data.documents[0]);
        }
      }
    } catch (err) {
      console.error('[KB] 载入文档列表失败:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // 2. 订阅 WebSocket，实现局域网同步
    const socket = SocketClient.getInstance();

    // 监听文档更新（新建或修改）
    const unsubUpdate = socket.subscribe('documents:update', (updatedDoc: KBDocument) => {
      setDocuments(prev => {
        // 铁壁去重：先彻底剔除原先已存在相同 ID 的项，然后再塞入 updatedDoc 并排序，物理断绝 Key 重复！
        const filtered = prev.filter(d => d.id !== updatedDoc.id);
        const next = [updatedDoc, ...filtered];
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });

      // 如果当前正选中的就是被更新的这篇文档，且不是由自己修改的，就同步更新编辑框
      if (selectedId === updatedDoc.id) {
        // 使用一个 ref 或判断修改者，避免自己在编辑时被覆盖。
        // 如果是别人改的，覆盖我们的输入。
        if (updatedDoc.senderId !== self?.id) {
          setTitleInput(updatedDoc.title);
          setContentInput(updatedDoc.content);
          setContentPreview(updatedDoc.content);
          setSaveStatus('saved');
        }
      }
    });

    // 监听文档删除
    const unsubDelete = socket.subscribe('documents:delete', (data: { id: string }) => {
      setDocuments(prev => prev.filter(d => d.id !== data.id));
      if (selectedId === data.id) {
        setSelectedId(null);
        setTitleInput('');
        setContentInput('');
        setContentPreview('');
      }
    });

    return () => {
      unsubUpdate();
      unsubDelete();
    };
  }, [selectedId, self]);

  // 渲染时高亮代码块
  useEffect(() => {
    if (viewMode === 'split' || viewMode === 'read') {
      // 延迟确保 DOM 已经渲染完毕
      setTimeout(() => Prism.highlightAll(), 50);
    }
  }, [viewMode, selectedId, contentPreview]);

  const selectDocument = (doc: KBDocument) => {
    setSelectedId(doc.id);
    setTitleInput(doc.title);
    setContentInput(doc.content);
    setContentPreview(doc.content);
    setSaveStatus('saved');
    setViewMode('split'); // 默认选中后进入极致直观的实时分栏对照模式！
  };

  interface TOCItem {
    id: string;
    text: string;
    level: number;
  }

  /**
   * 精致实时 Markdown 大纲提取算法 (飞书大厂设计，智能避开代码块注释)
   */
  const extractOutline = (text: string): TOCItem[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const outline: TOCItem[] = [];
    let inCode = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // 避开代码块中 # 符号干扰
      if (trimmed.startsWith('```')) {
        inCode = !inCode;
        return;
      }
      if (inCode) return;

      if (trimmed.startsWith('# ')) {
        outline.push({ id: `toc-${index}`, text: trimmed.substring(2).trim(), level: 1 });
      } else if (trimmed.startsWith('## ')) {
        outline.push({ id: `toc-${index}`, text: trimmed.substring(3).trim(), level: 2 });
      } else if (trimmed.startsWith('### ')) {
        outline.push({ id: `toc-${index}`, text: trimmed.substring(4).trim(), level: 3 });
      } else if (trimmed.startsWith('#### ')) {
        outline.push({ id: `toc-${index}`, text: trimmed.substring(5).trim(), level: 4 });
      }
    });

    return outline;
  };

  /**
   * 大纲点击锚点丝滑跳转定位
   */
  const handleScrollToHeading = (anchorId: string, headingText: string) => {
    // 1. 若当前处于 split 或 read (预览) 模式下，直接定位预览 DOM 锚点
    const previewEl = document.getElementById(anchorId);
    if (previewEl) {
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 2. 若纯编辑模式下没有预览区，去所见即所得 Tiptap Editor (ProseMirror) 内部寻得该标题内容并定位
    const editorEl = document.querySelector('.ProseMirror');
    if (editorEl) {
      const headings = Array.from(editorEl.querySelectorAll('h1, h2, h3, h4, h5'));
      const target = headings.find(h => h.textContent?.trim() === headingText);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  /**
   * 使用 useMemo 细粒度拦截渲染，彻底解除打字时左侧树重绘卡顿，实现飞书级多级文件夹嵌套渲染！
   */
  const memoizedDocList = useMemo(() => {
    if (documents.length === 0) {
      return (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          无任何知识库文档
        </div>
      );
    }

    interface TreeNode {
      doc: KBDocument;
      children: TreeNode[];
    }

    // 1. 构建树状多级目录结构
    const buildTree = (): TreeNode[] => {
      const nodesMap: { [id: string]: TreeNode } = {};
      documents.forEach(doc => {
        nodesMap[doc.id] = { doc, children: [] };
      });

      const roots: TreeNode[] = [];
      documents.forEach(doc => {
        const node = nodesMap[doc.id];
        if (doc.parentId && nodesMap[doc.parentId]) {
          nodesMap[doc.parentId].children.push(node);
        } else {
          roots.push(node);
        }
      });

      // 排序规则：文件夹排在最顶层，品类内部按照最近修改时间倒序排列
      const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
          const aType = a.doc.type || 'file';
          const bType = b.doc.type || 'file';
          if (aType === 'folder' && bType !== 'folder') return -1;
          if (aType !== 'folder' && bType === 'folder') return 1;
          return b.doc.updatedAt - a.doc.updatedAt;
        });
        nodes.forEach(n => {
          if (n.children.length > 0) {
            sortNodes(n.children);
          }
        });
      };

      sortNodes(roots);
      return roots;
    };

    const treeData = buildTree();

    // 2. 备选移动目标列表：排除当前文档以及其子文件夹（防止循环归属）
    const getAvailableFolders = (currentDocId: string): KBDocument[] => {
      const currentDoc = documents.find(d => d.id === currentDocId);
      if (!currentDoc) return [];

      const getFolderDescendantIds = (folderId: string): string[] => {
        const children = documents.filter(d => d.parentId === folderId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
          if (c.type === 'folder') {
            ids = [...ids, ...getFolderDescendantIds(c.id)];
          }
        });
        return ids;
      };

      const invalidIds = [currentDocId, ...getFolderDescendantIds(currentDocId)];
      return documents.filter(d => d.type === 'folder' && !invalidIds.includes(d.id));
    };

    // 3. 递归树节点渲染函数
    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
      const { doc, children } = node;
      const isSelected = doc.id === selectedId;
      const isRenaming = doc.id === renamingId;
      const isFolder = doc.type === 'folder';
      const isExpanded = expandedFolderIds.has(doc.id);
      const isMoving = movingDocId === doc.id;

      const indentPadding = depth * 12; // 每一层缩进 12px

      return (
        <div key={doc.id} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 单个节点条目 */}
          <div
            onClick={() => {
              if (isRenaming) return;
              if (isFolder) {
                toggleFolderExpand(doc.id);
              } else {
                selectDocument(doc);
              }
            }}
            style={{
              padding: '6px 8px 6px 12px',
              marginLeft: `${indentPadding}px`,
              borderRadius: 'var(--radius-sm)',
              background: isSelected ? 'var(--kb-item-selected-bg)' : 'transparent',
              cursor: isRenaming ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s',
              position: 'relative',
              border: isSelected ? '1px solid var(--kb-item-selected-border)' : '1px solid transparent',
              marginTop: '2px',
              minHeight: '34px'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'var(--kb-item-hover-bg)';
              const actions = e.currentTarget.querySelector('.doc-actions');
              if (actions) (actions as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'transparent';
              const actions = e.currentTarget.querySelector('.doc-actions');
              if (actions) (actions as HTMLElement).style.opacity = '0';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
              {/* 展开/折叠三角小图标 */}
              {isFolder ? (
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  width: '14px',
                  height: '14px',
                  borderRadius: '2px',
                  transition: 'background 0.1s'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpand(doc.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              ) : (
                // 普通文档没有三角，用一个 14px 空位占位对齐
                <span style={{ width: '14px', display: 'inline-block' }} />
              )}

              {/* 核心类别图标 */}
              {isFolder ? (
                isExpanded ? (
                  <FolderOpen size={14} style={{ color: '#EAB308', flexShrink: 0 }} />
                ) : (
                  <Folder size={14} style={{ color: '#CA8A04', flexShrink: 0 }} />
                )
              ) : (
                <FileText size={14} style={{ color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              )}
              
              {isRenaming ? (
                <input
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  onBlur={() => saveRename(doc)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRename(doc)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--accent-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              ) : (
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  <span style={{ 
                    fontSize: '0.825rem', 
                    fontWeight: isSelected || (isFolder && isExpanded) ? 600 : 400,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}>
                    {doc.title}
                  </span>
                </div>
              )}
            </div>

            {/* 操作小按钮（新建子文档/新建子文件夹/移动归属/重命名/删除） */}
            {!isRenaming && (
              <div className="doc-actions" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                opacity: 0,
                transition: 'opacity 0.15s',
                marginLeft: '6px',
                flexShrink: 0
              }}>
                {/* 文件夹下特有的快捷新建子项功能 */}
                {isFolder && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateDocument(doc.id);
                      }}
                      title="新建子文档"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', borderRadius: '2px' }}
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFolder(doc.id, e);
                      }}
                      title="新建子文件夹"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', borderRadius: '2px' }}
                    >
                      <FolderPlus size={11} />
                    </button>
                  </>
                )}

                {/* 统一的“移动归属”小图标 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovingDocId(isMoving ? null : doc.id);
                  }}
                  title="移动归属..."
                  style={{ background: 'transparent', border: 'none', color: isMoving ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                >
                  <Move size={11} />
                </button>

                <button
                  onClick={(e) => startRename(doc, e)}
                  title="重命名"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                >
                  <Edit2 size={11} />
                </button>
                <button
                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                  title="删除"
                  style={{ background: 'transparent', border: 'none', color: 'var(--error-color)', cursor: 'pointer', padding: '2px' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>

          {/* 移动归属下拉浮动选择面板 */}
          {isMoving && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px',
              margin: '4px 8px 6px',
              marginLeft: `${indentPadding + 12}px`,
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, padding: '2px 4px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>移动至文件夹:</span>
                <button onClick={() => setMovingDocId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.65rem' }}>取消</button>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                {/* 移到根目录选项 */}
                {doc.parentId !== null && (
                  <button
                    onClick={() => handleMoveDocument(doc.id, null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-color)',
                      textAlign: 'left',
                      padding: '4px 6px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Globe size={11} />
                    [ 根目录 ]
                  </button>
                )}

                {getAvailableFolders(doc.id).map(f => {
                  const isCurrentParent = doc.parentId === f.id;
                  return (
                    <button
                      key={f.id}
                      disabled={isCurrentParent}
                      onClick={() => handleMoveDocument(doc.id, f.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isCurrentParent ? 'var(--text-muted)' : 'var(--text-primary)',
                        textAlign: 'left',
                        padding: '4px 6px',
                        fontSize: '0.72rem',
                        cursor: isCurrentParent ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: isCurrentParent ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentParent) e.currentTarget.style.background = 'var(--kb-item-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentParent) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Folder size={11} style={{ color: '#CA8A04' }} />
                      {f.title}
                    </button>
                  );
                })}

                {getAvailableFolders(doc.id).length === 0 && doc.parentId === null && (
                  <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    暂无其他备选文件夹
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 递归渲染子项 (仅当文件夹处于展开状态展开时才渲染) */}
          {isFolder && isExpanded && children.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {children.map(childNode => renderNode(childNode, depth + 1))}
            </div>
          )}

          {/* 展开文件夹但没有子文档时的空状态微型提示 */}
          {isFolder && isExpanded && children.length === 0 && (
            <div style={{ 
              padding: '6px 8px 6px 12px',
              marginLeft: `${indentPadding + 28}px`,
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CornerDownRight size={10} style={{ opacity: 0.5 }} />
              此文件夹为空
            </div>
          )}
        </div>
      );
    };

    return treeData.map(node => renderNode(node, 0));
  }, [documents, selectedId, renamingId, renameTitle, expandedFolderIds, movingDocId]);

  /**
   * 创建一篇新文档
   */
  const handleCreateDocument = async (targetParentId: string | null = null) => {
    if (!self) return;

    const docId = generateUUID();
    const newDoc: KBDocument = {
      id: docId,
      title: '未命名云文档',
      content: '# 未命名云文档\n\n在这里开始书写飞书般的文档协作体验...\n\n你可以通过上方工具栏插入代码块。',
      type: 'file',
      parentId: targetParentId,
      senderId: self.id,
      senderName: self.nickname,
      senderAvatar: self.avatar,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 本端落盘
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => [newDoc, ...prev]);
        // 自动展开父级文件夹
        if (targetParentId) {
          setExpandedFolderIds(prev => {
            const next = new Set(prev);
            next.add(targetParentId);
            return next;
          });
        }
        selectDocument(newDoc);
        setViewMode('split'); // 新建后直接进入分栏态

        // 局域网广播广播：并发投递给局域网其他所有在线设备后端
        broadcastSync(newDoc);
      }
    } catch (err) {
      console.error('[KB] 创建文档物理写入失败:', err);
    }
  };

  /**
   * 文档删除 (物理递归删除，完美支持文件夹与子项)
   */
  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发选中
    
    const targetDoc = documents.find(d => d.id === id);
    if (!targetDoc) return;

    let idsToDelete = [id];
    let confirmMsg = '确定要删除这篇云文档吗？物理文件也将被一并清理！';

    if (targetDoc.type === 'folder') {
      const getChildIds = (pId: string): string[] => {
        const children = documents.filter(d => d.parentId === pId);
        let cIds = children.map(c => c.id);
        children.forEach(c => {
          if (c.type === 'folder') {
            cIds = [...cIds, ...getChildIds(c.id)];
          }
        });
        return cIds;
      };

      const childIds = getChildIds(id);
      idsToDelete = [id, ...childIds];
      confirmMsg = `确定要删除此文件夹《${targetDoc.title}》吗？其内部包含的 ${childIds.length} 个子文档/文件夹都将被一并物理删除！`;
    }

    if (!confirm(confirmMsg)) return;

    try {
      // 循环删除所有物理文件
      let allSuccess = true;
      for (const delId of idsToDelete) {
        const res = await fetch(`/api/documents?id=${delId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!data.success) {
          allSuccess = false;
        }
      }

      if (allSuccess) {
        setDocuments(prev => prev.filter(d => !idsToDelete.includes(d.id)));
        if (idsToDelete.includes(selectedId || '')) {
          setSelectedId(null);
          setTitleInput('');
          setContentInput('');
          setContentPreview('');
        }
        
        // 局域网广播批量删除通知
        idsToDelete.forEach(delId => {
          peers.forEach(async (peer) => {
            try {
              await fetch(`http://${peer.ip}:${peer.port}/api/documents?id=${delId}`, {
                method: 'DELETE'
              });
            } catch (err) {
              console.error(`[KB] 向节点 ${peer.nickname} 发起同步删除失败:`, err);
            }
          });
        });
      }
    } catch (err) {
      console.error('[KB] 删除文档物理操作失败:', err);
    }
  };

  /**
   * 触发重命名输入
   */
  const startRename = (doc: KBDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(doc.id);
    setRenameTitle(doc.title);
  };

  /**
   * 保存重命名标题
   */
  const saveRename = async (doc: KBDocument) => {
    if (!renameTitle.trim() || !self) {
      setRenamingId(null);
      return;
    }

    const updatedDoc: KBDocument = {
      ...doc,
      title: renameTitle.trim(),
      senderId: self.id,
      senderName: self.nickname,
      senderAvatar: self.avatar,
      updatedAt: Date.now()
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDoc)
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
        if (selectedId === doc.id) {
          setTitleInput(updatedDoc.title);
        }
        setRenamingId(null);
        broadcastSync(updatedDoc);
      }
    } catch (err) {
      console.error('[KB] 重命名文档落盘失败:', err);
    }
  };

  /**
   * 局域网广播同步函数
   */
  const broadcastSync = (doc: KBDocument) => {
    console.log(`[KB] 正在向局域网广播同步文档《${doc.title}》. 接收端数: ${peers.length}`);
    peers.forEach(async (peer) => {
      try {
        await fetch(`http://${peer.ip}:${peer.port}/api/documents/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc)
        });
      } catch (err) {
        console.warn(`[KB] 向节点 ${peer.nickname} (${peer.ip}) 投递文档同步失败:`, err);
      }
    });
  };

  /**
   * 实现 Debounce 自动保存和广播
   */
  const triggerAutoSave = (newTitle: string, newContent: string) => {
    if (!selectedId || !self) return;
    
    // 防御：如果是云文件夹，绝对不进行任何正文内容自动保存落盘，防篡改
    if (selectedDoc?.type === 'folder') return;

    setSaveStatus('dirty');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const updatedDoc: KBDocument = {
        ...selectedDoc, // 铁壁防丢：继承原文件夹/文档的元属性（如 type, parentId）
        id: selectedId,
        title: newTitle.trim() || '无标题文档',
        content: newContent,
        senderId: self.id,
        senderName: self.nickname,
        senderAvatar: self.avatar,
        createdAt: selectedDoc?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDoc)
        });
        const data = await res.json();
        if (data.success) {
          setSaveStatus('saved');
          // 更新本地文档列表中本项的值
          setDocuments(prev => prev.map(d => d.id === selectedId ? updatedDoc : d));
          // 局域网广播
          broadcastSync(updatedDoc);
        }
      } catch (err) {
        console.error('[KB] 自动保存出错:', err);
        setSaveStatus('dirty');
      }
    }, 1000); // 1秒无输入防抖自动落盘与广播
  };

  // 销毁时清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitleInput(val);
    const currentMarkdown = editor ? (editor.storage as any).markdown.getMarkdown() : contentInput;
    triggerAutoSave(val, currentMarkdown);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContentInput(val);
    triggerAutoSave(titleInput, val);
  };

  /**
   * 编辑器工具栏快捷插入
   */
  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = before + selected + after;
    const nextContent = text.substring(0, start) + replacement + text.substring(end);
    
    setContentInput(nextContent);
    triggerAutoSave(titleInput, nextContent);

    // 重新聚焦并重设选择区域
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  /**
   * 代码一键复制
   */
  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  /**
   * 自定义 Markdown 预览解析器（大厂大格局，极佳的可读性）
   */
  const renderMarkdown = (text: string) => {
    if (!text) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>空内容</p>;
    
    const parts = [];
    let currentBlock = '';
    let inCode = false;
    let codeLang = 'javascript';
    
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检测代码块边界: ```javascript
      if (line.trim().startsWith('```')) {
        if (inCode) {
          // 退出代码块
          const codeText = currentBlock;
          const currentLang = codeLang;
          const blockId = `code_${i}`;
          parts.push(
            <div key={blockId} style={{ position: 'relative', margin: '16px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--code-border)' }}>
              <div style={{
                background: 'var(--code-header-bg)',
                padding: '6px 12px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--code-border)'
              }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{currentLang.toUpperCase()}</span>
                <button
                  onClick={() => handleCopyCode(codeText, blockId)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedCodeId === blockId ? 'var(--success-color)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Copy size={12} />
                  {copiedCodeId === blockId ? '已复制' : '复制'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: '16px', background: 'var(--code-pre-bg)', overflowX: 'auto' }}>
                <code className={`language-${currentLang}`}>
                  {codeText}
                </code>
              </pre>
            </div>
          );
          currentBlock = '';
          inCode = false;
        } else {
          // 进入代码块
          inCode = true;
          codeLang = line.trim().substring(3).trim() || 'javascript';
        }
        continue;
      }

      if (inCode) {
        currentBlock += (currentBlock ? '\n' : '') + line;
      } else {
        // 智能处理行尾的转义反斜杠 \ （通常表示硬换行，在此处剔除以保证预览区不出现裸露的斜杠，且保留其语义）
        let cleanLine = line;
        let hasHardBreak = false;
        if (cleanLine.endsWith('\\')) {
          cleanLine = cleanLine.slice(0, -1);
          hasHardBreak = true;
        }

        const cleanTrimmed = cleanLine.trim();

        if (cleanTrimmed.startsWith('# ')) {
          parts.push(<h2 key={i} id={`toc-${i}`} style={{ fontSize: '1.6rem', fontWeight: 700, margin: '24px 0 12px', letterSpacing: '-0.02em', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>{cleanTrimmed.substring(2)}</h2>);
        } else if (cleanTrimmed.startsWith('## ')) {
          parts.push(<h3 key={i} id={`toc-${i}`} style={{ fontSize: '1.3rem', fontWeight: 600, margin: '20px 0 10px', letterSpacing: '-0.015em' }}>{cleanTrimmed.substring(3)}</h3>);
        } else if (cleanTrimmed.startsWith('### ')) {
          parts.push(<h4 key={i} id={`toc-${i}`} style={{ fontSize: '1.1rem', fontWeight: 600, margin: '16px 0 8px' }}>{cleanTrimmed.substring(4)}</h4>);
        } else if (cleanTrimmed.startsWith('#### ')) {
          parts.push(<h5 key={i} id={`toc-${i}`} style={{ fontSize: '0.95rem', fontWeight: 600, margin: '14px 0 6px' }}>{cleanTrimmed.substring(5)}</h5>);
        } else if (cleanTrimmed.startsWith('> ')) {
          parts.push(
            <blockquote key={i} style={{
              borderLeft: '4px style var(--accent-color)',
              borderLeftStyle: 'solid',
              background: 'rgba(59, 130, 246, 0.05)',
              padding: '12px 16px',
              borderRadius: '0 8px 8px 0',
              color: 'var(--text-primary)',
              margin: '16px 0',
              fontStyle: 'italic'
            }}>
              {cleanTrimmed.substring(2)}
            </blockquote>
          );
        } else if (cleanTrimmed.startsWith('- ') || cleanTrimmed.startsWith('* ')) {
          parts.push(
            <li key={i} style={{ marginLeft: '24px', listStyleType: 'disc', marginTop: '4px', marginBottom: '4px', fontSize: '0.95rem' }}>
              {cleanTrimmed.substring(2)}
              {hasHardBreak && <br />}
            </li>
          );
        } else if (cleanLine === '') {
          parts.push(<div key={i} style={{ height: '8px' }} />);
        } else {
          // 渲染加粗/斜体基本替换
          let formattedText: React.ReactNode = cleanLine;
          
          // 对 ** 进行简单粗暴且优雅的加粗渲染
          if (cleanLine.includes('**')) {
            const regex = /\*\*(.*?)\*\*/g;
            const segments = [];
            let lastIndex = 0;
            let match;
            let keyIdx = 0;
            
            while ((match = regex.exec(cleanLine)) !== null) {
              if (match.index > lastIndex) {
                segments.push(cleanLine.substring(lastIndex, match.index));
              }
              segments.push(<strong key={keyIdx++} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{match[1]}</strong>);
              lastIndex = regex.lastIndex;
            }
            if (lastIndex < cleanLine.length) {
              segments.push(cleanLine.substring(lastIndex));
            }
            formattedText = segments.length > 0 ? segments : formattedText;
          }

          parts.push(
            <p key={i} style={{ lineHeight: 1.7, fontSize: '0.95rem', margin: '8px 0', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {formattedText}
              {hasHardBreak && <br />}
            </p>
          );
        }
      }
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{parts}</div>;
  };

  return (
    <Card style={{ 
      display: 'flex', 
      flexDirection: 'row', 
      gap: '0px', 
      padding: '0px',
      overflow: 'hidden', 
      height: 'calc(100vh - 120px)',
      background: 'var(--bg-card)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)'
    }}>
      
      {/* 1. 云文档知识库左侧目录列表栏 */}
      <div style={{
        width: isKbSidebarCollapsed ? '0px' : '280px',
        borderRight: isKbSidebarCollapsed ? 'none' : '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--kb-sidebar-bg)',
        height: '100%',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out, border-color 0.3s',
        opacity: isKbSidebarCollapsed ? 0 : 1,
        pointerEvents: isKbSidebarCollapsed ? 'none' : 'auto',
        overflow: 'hidden'
      }}>
        {/* 文档库列表顶部按钮 */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <Globe size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            共享知识库 ({documents.length})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <Button variant="primary" onClick={() => handleCreateDocument(null)} style={{ padding: '6px 10px', fontSize: '0.75rem', height: '28px' }}>
              <Plus size={14} />
              新建
            </Button>
            
            {/* 新建根文件夹按钮 */}
            <button
              onClick={(e) => handleCreateFolder(null, e)}
              title="新建根目录云文件夹"
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: 'var(--accent-color)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                height: '28px',
                width: '28px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
              }}
            >
              <FolderPlus size={14} />
            </button>
            
            {/* 收起侧边栏按钮 */}
            <button
              onClick={toggleKbSidebar}
              title="收起知识库目录"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <ChevronsLeft size={15} />
            </button>
          </div>
        </div>

        {/* 文档库目录项列表 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {memoizedDocList}
        </div>
      </div>

      {/* 2. 云文档右侧内容编辑与预览大格局工作台 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'transparent'
      }}>
        {selectedId && selectedDoc ? (
          <>
            {/* 编辑工作台控制栏 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.05)'
            }}>
              {/* 保存状态提示与侧边栏唤出按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isKbSidebarCollapsed && (
                  <button
                    onClick={toggleKbSidebar}
                    title="展开共享知识库目录"
                    style={{
                      background: 'rgba(128, 128, 128, 0.06)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      animation: 'fadeIn 0.2s ease-out forwards',
                      marginRight: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(128, 128, 128, 0.12)';
                      e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(128, 128, 128, 0.06)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <ChevronsRight size={15} />
                  </button>
                )}

                {/* 保存状态提示 */}
                {saveStatus === 'saved' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckSquare size={13} />
                    已自动保存落盘并同步局域网
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="saving-spinner" style={{
                      width: '10px',
                      height: '10px',
                      border: '2px solid var(--accent-color)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 1s linear infinite'
                    }} />
                    正在极速落盘同步...
                  </span>
                )}
                {saveStatus === 'dirty' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Save size={13} />
                    有未保存改动...
                  </span>
                )}
              </div>

              {/* 模式切换胶囊按钮 (Split / Write / Read) */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '2px', borderRadius: '6px' }}>
                <button
                  onClick={() => setViewMode('split')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: 'none',
                    background: viewMode === 'split' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Columns size={12} />
                  实时分栏
                </button>
                <button
                  onClick={() => setViewMode('write')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: 'none',
                    background: viewMode === 'write' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    color: viewMode === 'write' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit3 size={12} />
                  纯编辑
                </button>
                <button
                  onClick={() => setViewMode('read')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: 'none',
                    background: viewMode === 'read' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    color: viewMode === 'read' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={12} />
                  纯预览
                </button>
                <span style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 8px' }} />
                <button
                  onClick={toggleOutline}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: 'none',
                    background: isOutlineOpen ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: isOutlineOpen ? 'var(--accent-color)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Columns size={12} style={{ transform: 'rotate(90deg)' }} />
                  {isOutlineOpen ? '隐藏大纲' : '显示大纲'}
                </button>
              </div>
            </div>

            {/* 一体化大字标题 */}
            <div style={{ padding: '20px 32px 0 32px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                value={titleInput}
                onChange={handleTitleChange}
                disabled={viewMode === 'read'}
                placeholder="请输入文档标题..."
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  width: '100%',
                  outline: 'none',
                  letterSpacing: '-0.02em'
                }}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>创建时间: {new Date(selectedDoc.createdAt).toLocaleString()}</span>
                <span>·</span>
                <span>最后修改者: {selectedDoc.senderName} ({new Date(selectedDoc.updatedAt).toLocaleTimeString()})</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color)', marginTop: '8px' }} />
            </div>

            {/* 主体视窗联动区 */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'row' }}>
              
              {/* 左侧：编辑编辑区 (在 read 模式下隐藏) */}
              {viewMode !== 'read' && (
                <div style={{ 
                  flex: 1, 
                  borderRight: viewMode === 'split' ? '1px solid var(--border-color)' : 'none', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}>
                  {/* 格式工具栏 (Markdown Toolbar) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 20px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderBottom: '1px solid var(--border-color)',
                    overflowX: 'auto'
                  }}>
                    <button 
                      onClick={() => editor?.chain().focus().toggleBold().run()} 
                      title="加粗" 
                      style={{ 
                        background: editor?.isActive('bold') ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                        border: 'none', 
                        padding: '6px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: editor?.isActive('bold') ? 'var(--accent-color)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Bold size={13} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleItalic().run()} 
                      title="斜体" 
                      style={{ 
                        background: editor?.isActive('italic') ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                        border: 'none', 
                        padding: '6px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: editor?.isActive('italic') ? 'var(--accent-color)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Italic size={13} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} 
                      title="二级标题" 
                      style={{ 
                        background: editor?.isActive('heading', { level: 2 }) ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                        border: 'none', 
                        padding: '6px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: editor?.isActive('heading', { level: 2 }) ? 'var(--accent-color)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Heading size={13} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleBlockquote().run()} 
                      title="引用块" 
                      style={{ 
                        background: editor?.isActive('blockquote') ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                        border: 'none', 
                        padding: '6px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: editor?.isActive('blockquote') ? 'var(--accent-color)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Quote size={13} />
                    </button>
                    <button 
                      onClick={() => editor?.chain().focus().toggleBulletList().run()} 
                      title="无序列表" 
                      style={{ 
                        background: editor?.isActive('bulletList') ? 'rgba(59, 130, 246, 0.1)' : 'transparent', 
                        border: 'none', 
                        padding: '6px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: editor?.isActive('bulletList') ? 'var(--accent-color)' : 'var(--text-secondary)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <List size={13} />
                    </button>
                    <span style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 4px' }} />
                    <button 
                      onClick={() => editor?.chain().focus().toggleCodeBlock().run()} 
                      title="插入/取消 代码块"
                      style={{ 
                        background: editor?.isActive('codeBlock') ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: 'var(--accent-color)',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Code size={12} />
                      代码块
                    </button>
                  </div>

                  {/* 编辑 Tiptap 富文本 Content Area */}
                  <div style={{
                    flex: 1,
                    width: '100%',
                    padding: '12px 32px',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    overflowY: 'auto'
                  }}>
                    <EditorContent editor={editor} />
                  </div>
                </div>
              )}

              {/* 右侧：实时渲染预览区 (在 write 模式下隐藏) */}
              {viewMode !== 'write' && (
                <div style={{ 
                  flex: 1, 
                  padding: '24px 32px', 
                  overflowY: 'auto',
                  background: 'transparent',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {renderMarkdown(contentPreview)}
                  </div>
                </div>
              )}

              {/* 最右侧：TOC 大纲目录面板 */}
              <div className={`kb-toc-container ${isOutlineOpen ? '' : 'collapsed'}`}>
                <div className="kb-toc-header">
                  <span>文档大纲</span>
                  <button 
                    onClick={toggleOutline}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
                <div className="kb-toc-list">
                  {extractOutline(contentPreview).length === 0 ? (
                    <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                      暂无标题大纲
                    </div>
                  ) : (
                    extractOutline(contentPreview).map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleScrollToHeading(item.id, item.text)}
                        className={`kb-toc-item level-${item.level}`}
                        title={item.text}
                      >
                        {item.text}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </>
        ) : (
          /* 未选中状态 */
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--text-muted)',
            padding: '40px',
            opacity: 0.6
          }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>欢迎来到局域网知识协作文档</h3>
            <p style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: '300px', lineHeight: 1.5 }}>
              点击左侧的“新建”按钮，或者选择已有文档，即可实现类似飞书的去中心化局域网协作。
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
};
export default KnowledgeBase;
