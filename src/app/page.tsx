'use client';

import React, { useState, useEffect } from 'react';
import { useMdnsPeers } from '@/hooks/useMdnsPeers';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import PeerList from '@/components/features/peers/PeerList';
import Transfer from '@/components/features/transfer/Transfer';
import SharedFiles from '@/components/features/transfer/SharedFiles';
import KnowledgeBase from '@/components/features/knowledge-base/KnowledgeBase';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { 
  Radio, RefreshCw, Laptop, Edit3, Check, 
  Files, FileText, Settings, ShieldAlert, FolderOpen,
  Info, Cpu, Link, Server, Sun, Moon, ArrowUpDown, X,
  History, ArrowRight, CheckCircle2, XCircle, Ban
} from 'lucide-react';

type ActiveTab = 'transfer' | 'share' | 'knowledge' | 'settings' | 'history';

export default function Home() {
  // 1. 初始化局域网在线节点发现逻辑
  const { peers, self, isConnected, updateProfile, refreshPeers } = useMdnsPeers();

  // 2. 初始化局域网极速传输引擎逻辑
  const { tasks, incomingRequest, sendFile, acceptRequest, rejectRequest, uploadPublicFile } = useFileTransfer(
    self
  );

  // 页面当前激活的大 Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('transfer');

  // 主题颜色状态
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 文件传输中心抽屉显隐状态
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false);
  const [prevTasksLength, setPrevTasksLength] = useState(0);

  // 个人资料编辑状态
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newAvatar, setNewAvatar] = useState('avatar-1');

  // 3. 系统参数配置相关状态
  const [storagePath, setStoragePath] = useState('');
  const [absolutePath, setAbsolutePath] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [configErrorMsg, setConfigErrorMsg] = useState('');

  // 初始化拉取主题设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  // 监听任务长度变化：当新文件传输任务加入时，自动滑出传输抽屉 3 秒
  useEffect(() => {
    const currentTasks = Object.values(tasks);
    if (currentTasks.length > prevTasksLength) {
      setIsTransferDrawerOpen(true);
      const timer = setTimeout(() => {
        setIsTransferDrawerOpen(false);
      }, 3000);
      setPrevTasksLength(currentTasks.length);
      return () => clearTimeout(timer);
    } else if (currentTasks.length !== prevTasksLength) {
      setPrevTasksLength(currentTasks.length);
    }
  }, [tasks, prevTasksLength]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // 初始化拉取系统配置
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        setStoragePath(data.storagePath);
        setAbsolutePath(data.absolutePath);
      }
    } catch (err) {
      console.error('[Settings] 获取存储路径配置失败:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const startEditProfile = () => {
    if (self) {
      setNewNickname(self.nickname);
      setNewAvatar(self.avatar);
      setIsEditingProfile(true);
    }
  };

  const saveProfile = async () => {
    if (newNickname.trim()) {
      const ok = await updateProfile(newNickname.trim(), newAvatar);
      if (ok) {
        setIsEditingProfile(false);
      }
    }
  };

  const handleSaveConfig = async () => {
    if (!storagePath.trim()) return;
    setConfigStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: storagePath.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setStoragePath(data.storagePath);
        setAbsolutePath(data.absolutePath);
        setConfigStatus('success');
        setTimeout(() => setConfigStatus('idle'), 3000);
      } else {
        setConfigStatus('error');
        setConfigErrorMsg(data.error || '路径无效或系统没有对该路径的写权限');
      }
    } catch (err: any) {
      setConfigStatus('error');
      setConfigErrorMsg(err.message || '配置提交异常');
    }
  };

  // 统计互传任务数
  const activeTasksCount = Object.values(tasks).filter(
    t => t.status === 'transferring' || t.status === 'pending'
  ).length;
  const totalTasksCount = Object.values(tasks).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      
      {/* 1. 左侧大厂极简侧边导航栏 (Sidebar) */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10
      }}>
        {/* 顶部 Logo & 品牌区 */}
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '24px 20px',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <Radio size={16} style={{ color: 'var(--accent-color)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Share Home</h1>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>局域网协作平台</p>
            </div>
          </div>

          {/* 导航菜单列表 */}
          <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('transfer')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                background: activeTab === 'transfer' ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                border: activeTab === 'transfer' ? '1px solid var(--border-color-hover)' : '1px solid transparent',
                color: activeTab === 'transfer' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'transfer' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'transfer') e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'transfer') e.currentTarget.style.background = 'transparent';
              }}
            >
              <Files size={15} style={{ color: activeTab === 'transfer' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              极速文件流
            </button>

            <button
              onClick={() => setActiveTab('share')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                background: activeTab === 'share' ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                border: activeTab === 'share' ? '1px solid var(--border-color-hover)' : '1px solid transparent',
                color: activeTab === 'share' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'share' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'share') e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'share') e.currentTarget.style.background = 'transparent';
              }}
            >
              <FolderOpen size={15} style={{ color: activeTab === 'share' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              共享中心
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                background: activeTab === 'knowledge' ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                border: activeTab === 'knowledge' ? '1px solid var(--border-color-hover)' : '1px solid transparent',
                color: activeTab === 'knowledge' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'knowledge' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'knowledge') e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'knowledge') e.currentTarget.style.background = 'transparent';
              }}
            >
              <FileText size={15} style={{ color: activeTab === 'knowledge' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              飞书云文档
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                background: activeTab === 'history' ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                border: activeTab === 'history' ? '1px solid var(--border-color-hover)' : '1px solid transparent',
                color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'history' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'history') e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'history') e.currentTarget.style.background = 'transparent';
              }}
            >
              <History size={15} style={{ color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              传输记录
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 14px',
                background: activeTab === 'settings' ? 'rgba(128, 128, 128, 0.08)' : 'transparent',
                border: activeTab === 'settings' ? '1px solid var(--border-color-hover)' : '1px solid transparent',
                color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'settings' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'settings') e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'settings') e.currentTarget.style.background = 'transparent';
              }}
            >
              <Settings size={15} style={{ color: activeTab === 'settings' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
              系统配置
            </button>
          </nav>
        </div>

        {/* 侧边栏底部本端身份管理与主题切换区 */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          {self && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditingProfile ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'rgba(128, 128, 128, 0.04)',
                    border: '1px solid var(--border-color)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      style={{
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        outline: 'none',
                        width: '100%'
                      }}
                      maxLength={10}
                      placeholder="昵称"
                    />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={newAvatar}
                        onChange={(e) => setNewAvatar(e.target.value)}
                        style={{
                          background: 'var(--bg-app)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          outline: 'none',
                          padding: '3px',
                          flex: 1
                        }}
                      >
                        <option value="avatar-1">笔记本</option>
                        <option value="avatar-2">显示器</option>
                        <option value="avatar-3">手机</option>
                      </select>
                      <button onClick={saveProfile} style={{ 
                        background: 'var(--accent-color)', 
                        border: 'none', 
                        color: '#ffffff', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <Check size={12} />
                        存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={startEditProfile}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: 'rgba(128, 128, 128, 0.04)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.2s',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-color-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                      <Laptop size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {self.nickname}
                      </span>
                    </div>
                    <Edit3 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                )}
              </div>

              {!isEditingProfile && (
                <button
                  onClick={toggleTheme}
                  title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(128, 128, 128, 0.04)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    color: 'var(--text-primary)',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
                  }}
                >
                  {theme === 'dark' ? (
                    <Sun size={15} style={{ color: '#f59e0b' }} />
                  ) : (
                    <Moon size={15} style={{ color: '#6366f1' }} />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 2. 右侧主工作面板工作区 (Workspace) */}
      <main style={{
        flex: 1,
        padding: '24px 32px',
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        background: 'transparent'
      }} className="fade-in">
        
        {/* 顶部自发现网络拉取与刷新状态栏 */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {activeTab === 'transfer' && '文件传输工作台'}
              {activeTab === 'share' && '公共共享中心'}
              {activeTab === 'knowledge' && '知识协作云文档'}
              {activeTab === 'settings' && '全局系统配置'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {activeTab === 'transfer' && '安全、无压缩的局域网零阻碍点对点极速传输'}
              {activeTab === 'share' && '长效、大文件零压缩合并存储的局域网公共共享空间'}
              {activeTab === 'knowledge' && '支持富文本与代码的局域网去中心化物理落盘云文档'}
              {activeTab === 'settings' && '修改默认存储路径以及查看本端硬件和网络特征'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '0.7rem',
              color: isConnected ? 'var(--success-color)' : 'var(--text-muted)',
              background: isConnected ? 'var(--success-glow)' : 'transparent',
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)'}`,
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isConnected ? 'var(--success-color)' : 'var(--text-muted)',
                display: 'inline-block'
              }} />
              {isConnected ? '局域网信道在线' : '离线状态'}
            </span>

            {/* 传输任务触发按钮 */}
            <button
              onClick={() => setIsTransferDrawerOpen(!isTransferDrawerOpen)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: 'rgba(128, 128, 128, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeTasksCount > 0 ? '0 0 12px var(--accent-glow)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                e.currentTarget.style.borderColor = 'var(--border-color-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <ArrowUpDown 
                size={14} 
                style={{ 
                  color: activeTasksCount > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                }} 
              />
              <span>传输任务</span>
              
              {/* 任务徽标 (Badge) */}
              {totalTasksCount > 0 && (
                <span style={{
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  background: activeTasksCount > 0 ? 'var(--accent-color)' : 'var(--text-muted)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}>
                  {totalTasksCount}
                </span>
              )}
            </button>

            <Button variant="secondary" onClick={refreshPeers} style={{ padding: '8px 12px' }}>
              <RefreshCw size={14} />
              刷新雷达
            </Button>
          </div>
        </header>

        {/* 动态内容工作区渲染 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* TAB 1: 极速文件传输工作台 */}
          {activeTab === 'transfer' && (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }} className="fade-in">
              <PeerList 
                peers={peers} 
                self={self}
                onSendFile={(peer, file) => {
                  sendFile(peer, file);
                }} 
              />
            </div>
          )}

          {/* TAB 2: 公共共享中心 */}
          {activeTab === 'share' && (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }} className="fade-in">
              <SharedFiles uploadPublicFile={uploadPublicFile} />
            </div>
          )}

          {/* TAB 2: 去中心化知识库云文档 */}
          {activeTab === 'knowledge' && (
            <div className="fade-in">
              <KnowledgeBase peers={peers} self={self} />
            </div>
          )}

          {/* TAB 4: 局域网物理传输历史记录 */}
          {activeTab === 'history' && (() => {
            const formatDateTime = (timestamp: number) => {
              const d = new Date(timestamp);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            };
            
            const formatBytesLocal = (bytes: number) => {
              if (bytes === 0) return '0 Bytes';
              const k = 1024;
              const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };

            const historyTasks = Object.values(tasks).filter(
              t => t.status === 'completed' || t.status === 'failed' || t.status === 'rejected'
            );
            const successCount = historyTasks.filter(t => t.status === 'completed').length;
            const failCount = historyTasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
            const sendCount = historyTasks.filter(t => t.type === 'send' && t.status === 'completed').length;
            const receiveCount = historyTasks.filter(t => t.type === 'receive' && t.status === 'completed').length;
            const successRate = historyTasks.length > 0 ? Math.round((successCount / historyTasks.length) * 100) : 100;
            const sortedHistory = [...historyTasks].sort((a, b) => b.startedAt - a.startedAt);

            // 辅助：获取 OS 的徽标样式和文字
            const getOsBadge = (os: string) => {
              const lower = os.toLowerCase();
              if (lower.includes('win')) return { label: 'WIN', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' };
              if (lower.includes('mac') || lower.includes('ios')) return { label: 'MAC', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' };
              if (lower.includes('linux')) return { label: 'LINUX', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
              return { label: 'PEER', bg: 'rgba(128, 128, 128, 0.15)', color: 'var(--text-secondary)' };
            };

            // 辅助：渲染头像 Icon（拼装极简文字圆徽章）
            const renderAvatarBadge = (name: string, avatar: string) => {
              const initial = name.trim().charAt(0).toUpperCase() || 'P';
              const colorHash = name.charCodeAt(0) % 5;
              const gradients = [
                'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                'linear-gradient(135deg, #10b981, #047857)',
                'linear-gradient(135deg, #a855f7, #7e22ce)',
                'linear-gradient(135deg, #f59e0b, #b45309)',
                'linear-gradient(135deg, #ec4899, #be185d)'
              ];
              return (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: gradients[colorHash],
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}>
                  {initial}
                </div>
              );
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="fade-in">
                {/* 1. 统计卡片面板 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '16px'
                }}>
                  {/* 卡片 1 */}
                  <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>累计物理互传</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{historyTasks.length}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>次</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                      <span>成功: <strong style={{ color: 'var(--success-color)' }}>{successCount}</strong></span>
                      <span>异常/拒绝: <strong style={{ color: 'var(--error-color)' }}>{failCount}</strong></span>
                    </div>
                  </Card>
                  {/* 卡片 2 */}
                  <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>物理收发结构</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)' }}>{sendCount}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>发 / </span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a855f7' }}>{receiveCount}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>收</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                      <span>活跃局域网交互带宽已最大化</span>
                    </div>
                  </Card>
                  {/* 卡片 3 */}
                  <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>物理信道质量</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: successRate >= 90 ? 'var(--success-color)' : 'var(--warning-color)' }}>{successRate}%</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>成功率</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                      <span>信道状态: <strong style={{ color: 'var(--success-color)' }}>极佳</strong></span>
                    </div>
                  </Card>
                </div>

                {/* 2. 物理互传记录陈列大列表 */}
                <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', color: 'var(--text-primary)' }}>
                    局域网对等体互传历史归档
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sortedHistory.length === 0 ? (
                      <div style={{ padding: '80px 0', textAlign: 'center', opacity: 0.5 }}>
                        <History size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto' }} />
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>当前尚无任何物理传输历史记录</p>
                      </div>
                    ) : (
                      sortedHistory.map(task => {
                        const isCompleted = task.status === 'completed';
                        const isRejected = task.status === 'rejected';
                        
                        const senderName = task.senderName || '未知发送端';
                        const senderIp = task.senderIp || '127.0.0.1';
                        const senderOS = task.senderOS || 'Windows';
                        const senderAvatar = task.senderAvatar || 'avatar-1';

                        const receiverName = task.receiverName || '未知接收端';
                        const receiverIp = task.receiverIp || '127.0.0.1';
                        const receiverOS = task.receiverOS || 'Windows';
                        const receiverAvatar = task.receiverAvatar || 'avatar-1';

                        const sOs = getOsBadge(senderOS);
                        const rOs = getOsBadge(receiverOS);

                        return (
                          <div
                            key={task.id}
                            style={{
                              padding: '16px 20px',
                              background: 'rgba(128, 128, 128, 0.02)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '14px',
                              transition: 'border-color 0.2s',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-color-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                          >
                            {/* 顶部: 双翼流向图 */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              gap: '16px',
                              flexWrap: 'wrap'
                            }}>
                              {/* 左翼: 发送端 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px', flex: 1 }}>
                                {renderAvatarBadge(senderName, senderAvatar)}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{senderName}</span>
                                    <span style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      background: sOs.bg,
                                      color: sOs.color
                                    }}>{sOs.label}</span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>IP: {senderIp}</span>
                                </div>
                              </div>

                              {/* 中间: 物理传输信道流动线 */}
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: '6px',
                                flex: 2,
                                minWidth: '140px',
                                position: 'relative'
                              }}>
                                {/* 信道发光线 */}
                                <div style={{
                                  width: '100%',
                                  height: '2px',
                                  background: 'repeating-linear-gradient(90deg, var(--border-color), var(--border-color) 4px, transparent 4px, transparent 8px)',
                                  position: 'relative'
                                }}>
                                  <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: '100%',
                                    background: isCompleted ? 'linear-gradient(90deg, transparent, var(--success-color), transparent)' : 'linear-gradient(90deg, transparent, var(--error-color), transparent)',
                                    animation: 'pulse-line 2s infinite linear'
                                  }} />
                                </div>

                                {/* 状态徽章 */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  background: isCompleted ? 'var(--success-glow)' : isRejected ? 'rgba(245, 158, 11, 0.08)' : 'var(--error-glow)',
                                  border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.2)' : isRejected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                  color: isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'
                                }}>
                                  {isCompleted ? (
                                    <>
                                      <CheckCircle2 size={11} />
                                      <span>已下载落地</span>
                                    </>
                                  ) : isRejected ? (
                                    <>
                                      <Ban size={11} />
                                      <span>接收端拒绝</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle size={11} />
                                      <span>网络异常</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* 右翼: 接收端 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px', flex: 1, justifyContent: 'flex-end', textAlign: 'right' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      background: rOs.bg,
                                      color: rOs.color
                                    }}>{rOs.label}</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{receiverName}</span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>IP: {receiverIp}</span>
                                </div>
                                {renderAvatarBadge(receiverName, receiverAvatar)}
                              </div>
                            </div>

                            {/* 底部分隔线 */}
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

                            {/* 底部: 文件元数据与时间戳 */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              flexWrap: 'wrap',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.fileName}</span>
                                <span style={{ color: 'var(--text-muted)' }}>({formatBytesLocal(task.fileSize)})</span>
                              </div>
                              <div style={{ color: 'var(--text-muted)' }}>
                                {formatDateTime(task.startedAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>

                {/* 滚动动画 CSS 定义 */}
                <style jsx>{`
                  @keyframes pulse-line {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                `}</style>
              </div>
            );
          })()}

          {/* TAB 3: 系统配置控制台 */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }} className="fade-in">
              
              {/* 核心配置：动态存储路径修改 */}
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(37, 99, 235, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FolderOpen size={14} style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>默认文件及文档存储目录</h3>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    局域网中收到的所有大文件、文本文件，以及你创建/同步的飞书知识库 Markdown 云文档，都会实时存放于此物理目录中。支持绝对路径或以 `./` 开头的根相对路径。
                  </p>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <input
                      type="text"
                      value={storagePath}
                      onChange={(e) => setStoragePath(e.target.value)}
                      placeholder="例如: ./storage"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 16px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                    <Button onClick={handleSaveConfig} disabled={configStatus === 'saving' || !storagePath.trim()}>
                      {configStatus === 'saving' ? '正在校验保存...' : '应用修改'}
                    </Button>
                  </div>

                  {/* 状态反馈 */}
                  {configStatus === 'success' && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--success-glow)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: 'var(--success-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Check size={14} />
                      存储路径校验通过，修改已成功持久化保存！
                    </div>
                  )}

                  {configStatus === 'error' && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: '#f87171',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldAlert size={14} />
                      修改失败：{configErrorMsg}
                    </div>
                  )}

                  {absolutePath && (
                    <div style={{ 
                      fontSize: '0.72rem', 
                      color: 'var(--text-muted)', 
                      background: 'rgba(255, 255, 255, 0.01)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-color)',
                      wordBreak: 'break-all'
                    }}>
                      <strong>当前服务器绝对落盘路径：</strong> {absolutePath}
                    </div>
                  )}
                </div>
              </Card>

              {/* 本端设备的高端硬件及网络参数 */}
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(37, 99, 235, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Cpu size={14} style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>本端局域网硬件参数</h3>
                  </div>

                  {self && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', width: '120px' }}>设备标识 (ID)</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{self.id}</span>
                      </div>
                      <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', width: '120px' }}>局域网 IP 地址</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{self.ip}</span>
                      </div>
                      <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', width: '120px' }}>节点监听端口</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{self.port}</span>
                      </div>
                      <div style={{ display: 'flex', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)', width: '120px' }}>系统默认服务</span>
                        <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Server size={12} style={{ color: 'var(--accent-color)' }} />
                          Next.js Web 服务 (Active) · WebSocket 信道 (Active)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* 局域网协同办公安全指引 */}
              <Card>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <Info size={16} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>去中心化网络提醒</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Share Home 依赖 mDNS 多播及去中心化点对点网络工作。请确保所有协作节点设备均连入同一局域网（或 Wi-Fi），且本端防火墙已开放相应的 WebSocket 及 HTTP 端口信道，即可获得最佳体验。
                    </p>
                  </div>
                </div>
              </Card>

            </div>
          )}

        </div>
      </main>

      {/* 全局局域网极速文件传输中心抽屉 (Drawer) */}
      <Transfer 
        tasks={tasks} 
        incomingRequest={incomingRequest} 
        onAccept={acceptRequest} 
        onReject={rejectRequest} 
        isOpen={isTransferDrawerOpen}
        onClose={() => setIsTransferDrawerOpen(false)}
      />

    </div>
  );
}
