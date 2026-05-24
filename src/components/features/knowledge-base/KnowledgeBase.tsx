import React, { useState, useEffect, useRef } from 'react';
import { Peer } from '@/types/peer';
import { KBDocument } from '@/types/document';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { 
  Plus, FileText, Trash2, Edit2, Check, X, Eye, Edit3, 
  Bold, Italic, Heading, Quote, List, Code, Copy, 
  CheckSquare, Globe, Save, Columns
} from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import { SocketClient } from '@/lib/socketClient';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

interface KnowledgeBaseProps {
  peers: Peer[];
  self: Peer | null;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ peers, self }) => {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [viewMode, setViewMode] = useState<'split' | 'write' | 'read'>('split');
  
  // 编辑中的临时状态
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  
  // 重命名文档状态
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // 状态指示
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // 引用 textarea 元素，供工具栏插入字符使用
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedDoc = documents.find(d => d.id === selectedId) || null;

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
        const exists = prev.some(d => d.id === updatedDoc.id);
        let next = [];
        if (exists) {
          next = prev.map(d => d.id === updatedDoc.id ? updatedDoc : d);
        } else {
          next = [updatedDoc, ...prev];
        }
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });

      // 如果当前正选中的就是被更新的这篇文档，且不是由自己修改的，就同步更新编辑框
      if (selectedId === updatedDoc.id) {
        // 使用一个 ref 或判断修改者，避免自己在编辑时被覆盖。
        // 如果是别人改的，覆盖我们的输入。
        if (updatedDoc.senderId !== self?.id) {
          setTitleInput(updatedDoc.title);
          setContentInput(updatedDoc.content);
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
  }, [viewMode, selectedId, contentInput]);

  const selectDocument = (doc: KBDocument) => {
    setSelectedId(doc.id);
    setTitleInput(doc.title);
    setContentInput(doc.content);
    setSaveStatus('saved');
    setViewMode('split'); // 默认选中后进入极致直观的实时分栏对照模式！
  };

  /**
   * 创建一篇新文档
   */
  const handleCreateDocument = async () => {
    if (!self) return;

    const docId = generateUUID();
    const newDoc: KBDocument = {
      id: docId,
      title: '未命名云文档',
      content: '# 未命名云文档\n\n在这里开始书写飞书般的文档协作体验...\n\n你可以通过上方工具栏插入代码块。',
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
   * 文档删除
   */
  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发选中
    if (!confirm('确定要删除这篇云文档吗？物理文件也将被一并清理！')) return;

    try {
      const res = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(prev => prev.filter(d => d.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setTitleInput('');
          setContentInput('');
        }
        
        // 局域网广播删除通知
        peers.forEach(async (peer) => {
          try {
            await fetch(`http://${peer.ip}:${peer.port}/api/documents?id=${id}`, {
              method: 'DELETE'
            });
          } catch (err) {
            console.error(`[KB] 向节点 ${peer.nickname} 发起同步删除失败:`, err);
          }
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
    setSaveStatus('dirty');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const updatedDoc: KBDocument = {
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
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitleInput(val);
    triggerAutoSave(val, contentInput);
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
            <div key={blockId} style={{ position: 'relative', margin: '16px 0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{
                background: '#1a1a1e',
                padding: '6px 12px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
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
              <pre style={{ margin: 0, padding: '16px', background: '#0e0e11', overflowX: 'auto' }}>
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
        // 普通 Markdown 解析渲染
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          parts.push(<h2 key={i} style={{ fontSize: '1.6rem', fontWeight: 700, margin: '24px 0 12px', letterSpacing: '-0.02em', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>{trimmed.substring(2)}</h2>);
        } else if (trimmed.startsWith('## ')) {
          parts.push(<h3 key={i} style={{ fontSize: '1.3rem', fontWeight: 600, margin: '20px 0 10px', letterSpacing: '-0.015em' }}>{trimmed.substring(3)}</h3>);
        } else if (trimmed.startsWith('### ')) {
          parts.push(<h4 key={i} style={{ fontSize: '1.1rem', fontWeight: 600, margin: '16px 0 8px' }}>{trimmed.substring(4)}</h4>);
        } else if (trimmed.startsWith('> ')) {
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
              {trimmed.substring(2)}
            </blockquote>
          );
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          parts.push(<li key={i} style={{ marginLeft: '24px', listStyleType: 'disc', marginY: '4px', fontSize: '0.95rem' }}>{trimmed.substring(2)}</li>);
        } else if (line === '') {
          parts.push(<div key={i} style={{ height: '8px' }} />);
        } else {
          // 渲染加粗/斜体基本替换
          let formattedText: React.ReactNode = line;
          
          // 对 ** 进行简单粗暴且优雅的加粗渲染
          if (line.includes('**')) {
            const regex = /\*\*(.*?)\*\*/g;
            const segments = [];
            let lastIndex = 0;
            let match;
            let keyIdx = 0;
            
            while ((match = regex.exec(line)) !== null) {
              if (match.index > lastIndex) {
                segments.push(line.substring(lastIndex, match.index));
              }
              segments.push(<strong key={keyIdx++} style={{ fontWeight: 700, color: '#ffffff' }}>{match[1]}</strong>);
              lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
              segments.push(line.substring(lastIndex));
            }
            formattedText = segments.length > 0 ? segments : formattedText;
          }

          parts.push(<p key={i} style={{ lineHeight: 1.7, fontSize: '0.95rem', margin: '8px 0', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{formattedText}</p>);
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
        width: '280px',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0, 0, 0, 0.15)',
        height: '100%'
      }}>
        {/* 文档库列表顶部按钮 */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} style={{ color: 'var(--accent-color)' }} />
            共享知识库 ({documents.length})
          </span>
          <Button variant="primary" onClick={handleCreateDocument} style={{ padding: '6px 10px', fontSize: '0.75rem', height: '28px' }}>
            <Plus size={14} />
            新建
          </Button>
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
          {documents.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              无任何知识库文档
            </div>
          ) : (
            documents.map(doc => {
              const isSelected = doc.id === selectedId;
              const isRenaming = doc.id === renamingId;
              
              return (
                <div
                  key={doc.id}
                  onClick={() => !isRenaming && selectDocument(doc)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    cursor: isRenaming ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s',
                    position: 'relative',
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    const actions = e.currentTarget.querySelector('.doc-actions');
                    if (actions) (actions as HTMLElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                    const actions = e.currentTarget.querySelector('.doc-actions');
                    if (actions) (actions as HTMLElement).style.opacity = '0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                    <FileText size={15} style={{ color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
                    
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        onBlur={() => saveRename(doc)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(doc)}
                        autoFocus
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
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}>
                          {doc.title}
                        </span>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {doc.senderName} · {new Date(doc.updatedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 操作小按钮（重命名/删除） */}
                  {!isRenaming && (
                    <div className="doc-actions" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      marginLeft: '6px',
                      flexShrink: 0
                    }}>
                      <button
                        onClick={(e) => startRename(doc, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--error-color)', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
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
              {/* 保存状态提示 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    <button onClick={() => insertText('**', '**')} title="加粗" style={{ background: 'transparent', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Bold size={13} />
                    </button>
                    <button onClick={() => insertText('*', '*')} title="斜体" style={{ background: 'transparent', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Italic size={13} />
                    </button>
                    <button onClick={() => insertText('# ', '')} title="一级标题" style={{ background: 'transparent', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Heading size={13} />
                    </button>
                    <button onClick={() => insertText('> ', '')} title="引用块" style={{ background: 'transparent', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Quote size={13} />
                    </button>
                    <button onClick={() => insertText('- ', '')} title="无序列表" style={{ background: 'transparent', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <List size={13} />
                    </button>
                    <span style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 4px' }} />
                    <button 
                      onClick={() => insertText('```javascript\n', '\n```')} 
                      title="插入 JS 代码块"
                      style={{ 
                        background: 'rgba(59, 130, 246, 0.08)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        color: 'var(--accent-color)',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Code size={12} />
                      代码块
                    </button>
                  </div>

                  {/* 编辑 TextArea */}
                  <textarea
                    ref={textareaRef}
                    value={contentInput}
                    onChange={handleContentChange}
                    placeholder="在这里支持使用丰富的 Markdown 语法进行书写，并在文字之间自由插入代码块..."
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '24px 32px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.925rem',
                      lineHeight: 1.7,
                      resize: 'none',
                      outline: 'none',
                      overflowY: 'auto'
                    }}
                  />
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
                    {renderMarkdown(contentInput)}
                  </div>
                </div>
              )}

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
