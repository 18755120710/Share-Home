import React, { useState, useEffect, useRef } from 'react';
import { Peer } from '@/types/peer';
import { BoardMessage, BoardMessageType } from '@/types/board';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { Clipboard, Code, Send, ClipboardCopy, Check } from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import Prism from 'prismjs';
import { SocketClient } from '@/lib/socketClient';
// 导入常用的 Prism 语法高亮主题样式
import 'prismjs/themes/prism-tomorrow.css';

interface BoardProps {
  peers: Peer[];
  self: Peer | null;
}

export const Board: React.FC<BoardProps> = ({ peers, self }) => {
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [activeTab, setActiveTab] = useState<BoardMessageType>('text');
  const [inputText, setInputText] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. 建立 WebSocket 监听，捕获由局域网其他设备投递来的公告更新
  useEffect(() => {
    const socket = SocketClient.getInstance();

    const unsub = socket.subscribe('board:message', (data: BoardMessage) => {
      setMessages(prev => [data, ...prev].slice(0, 100)); // 缓存最近 100 条
    });

    return () => {
      unsub();
    };
  }, []);

  // 每次消息变更，重新高亮代码
  useEffect(() => {
    Prism.highlightAll();
  }, [messages]);

  /**
   * 发布公告消息并将其并发广播投递到局域网中所有 Peers 节点
   */
  const handlePublish = async () => {
    if (!inputText.trim() || !self) return;

    const messageId = generateUUID();
    const newMessage: BoardMessage = {
      id: messageId,
      senderId: self.id,
      senderName: self.nickname,
      senderAvatar: self.avatar,
      type: activeTab,
      content: inputText,
      ...(activeTab === 'gist' && { gistLanguage: codeLanguage }),
      timestamp: Date.now()
    };

    // 1. 先推给本端自己的前端页面展示
    setMessages(prev => [newMessage, ...prev]);
    setInputText('');

    // 2. 双向大闭环广播：并发投递给局域网其他所有在线设备后端
    console.log(`[Board] 正在向局域网广播新公告消息. 在线接收端数: ${peers.length}`);
    
    peers.forEach(async (peer) => {
      try {
        // 向其他节点的后端的 sync API 投递
        await fetch(`http://${peer.ip}:${peer.port}/api/board/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMessage)
        });
      } catch (err) {
        console.error(`[Board] 向节点 ${peer.nickname} (${peer.ip}) 投递公告同步失败:`, err);
      }
    });
  };

  /**
   * 获取并自动载入本机剪贴板的内容，实现一键同步
   */
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        // 如果文字包含代码特征，自动切到 Gist Tab
        if (text.includes('function') || text.includes('import') || text.includes('const') || text.includes('def ')) {
          setActiveTab('gist');
        }
      }
    } catch (err) {
      alert('无法读取剪贴板，请允许浏览器读取权限。');
    }
  };

  /**
   * 一键复制公告板上的内容并提示 Toast 态
   */
  const handleCopy = async (message: BoardMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
      {/* 头部标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>局域网公告栏</h2>
        <Button variant="secondary" onClick={handlePasteClipboard} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
          <Clipboard size={14} />
          读取剪贴板
        </Button>
      </div>

      {/* 发表输入区 */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.01)'
      }}>
        {/* Tab 栏切换与语言选择 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setActiveTab('text')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 500,
                border: 'none',
                background: activeTab === 'text' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: activeTab === 'text' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              富文本 / 笔记
            </button>
            <button
              onClick={() => setActiveTab('gist')}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 500,
                border: 'none',
                background: activeTab === 'gist' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: activeTab === 'gist' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              代码 Gist
            </button>
          </div>

          {activeTab === 'gist' && (
            <select
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value)}
              style={{
                background: '#09090b',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="css">CSS</option>
              <option value="html">HTML</option>
            </select>
          )}
        </div>

        {/* 内容输入域 */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={activeTab === 'text' ? '在局域网的“公告栏”发布一条通知或笔记...' : '在这里粘贴需要分享的代码段...'}
          style={{
            width: '100%',
            height: '100px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: activeTab === 'gist' ? 'var(--font-mono)' : 'var(--font-sans)',
            fontSize: '0.875rem',
            resize: 'none',
            outline: 'none'
          }}
        />

        {/* 发布按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handlePublish} disabled={!inputText.trim()}>
            <Send size={14} />
            发布
          </Button>
        </div>
      </div>

      {/* 公告流消息列表 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        overflowY: 'auto',
        maxHeight: '400px',
        paddingRight: '4px'
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px 0',
            opacity: 0.5 
          }}>
            <ClipboardCopy size={28} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '0.85rem', marginTop: '12px' }}>当前没有任何公告，开始发布第一条消息吧！</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                position: 'relative'
              }}
            >
              {/* 头部发送人与时间 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                    {msg.senderName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* 一键复制按钮 */}
                <button
                  onClick={() => handleCopy(msg)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedId === msg.id ? 'var(--success-color)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                >
                  {copiedId === msg.id ? <Check size={14} /> : <ClipboardCopy size={14} />}
                </button>
              </div>

              {/* 核心内容渲染 */}
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {msg.type === 'text' ? (
                  msg.content
                ) : (
                  <pre style={{ margin: 0, padding: '12px', background: '#121214', borderRadius: '6px', overflowX: 'auto' }}>
                    <code className={`language-${msg.gistLanguage || 'javascript'}`}>
                      {msg.content}
                    </code>
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
export default Board;
