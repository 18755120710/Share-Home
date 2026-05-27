'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMdnsPeers } from '@/hooks/useMdnsPeers';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { SocketClient } from '@/lib/socketClient';
import PeerList from '@/components/features/peers/PeerList';
import Transfer from '@/components/features/transfer/Transfer';
import SharedFiles from '@/components/features/transfer/SharedFiles';
import TransferHistory from '@/components/features/transfer/TransferHistory';
import KnowledgeBase from '@/components/features/knowledge-base/KnowledgeBase';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { 
  Radio, RefreshCw, Laptop, Monitor, Smartphone, Edit3, Check, 
  Files, FileText, Settings, ShieldAlert, FolderOpen,
  Info, Cpu, Link, Server, Sun, Moon, ArrowUpDown, X,
  History, ArrowRight, CheckCircle2, XCircle, Ban,
  ChevronLeft, ChevronRight
} from 'lucide-react';

type ActiveTab = 'transfer' | 'share' | 'knowledge' | 'settings' | 'history';

export default function Home() {
  // 1. 初始化局域网在线节点发现逻辑
  const { peers, self, isConnected, updateProfile, refreshPeers } = useMdnsPeers();

  // 侧边导航栏折叠显隐状态 (持久化缓存)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed') === 'true';
      setIsSidebarCollapsed(saved);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  // 2. 初始化局域网极速传输引擎逻辑
  const { 
    tasks, 
    incomingRequest, 
    sendFile, 
    acceptRequest, 
    rejectRequest, 
    cancelTransfer, 
    uploadPublicFile,
    deleteTask,
    clearHistory
  } = useFileTransfer(self);

  // 页面当前激活的大 Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('transfer');

  // 主题颜色状态
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 文件传输中心抽屉显隐状态
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false);
  const [prevTasksLength, setPrevTasksLength] = useState(0);

  // 标志是否为首次加载，在 1 秒后强制置为 false
  const isInitialLoad = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 个人资料编辑状态
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newAvatar, setNewAvatar] = useState('avatar-1');

  // 3. 系统参数配置相关状态
  const [storagePath, setStoragePath] = useState('');
  const [absolutePath, setAbsolutePath] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [configErrorMsg, setConfigErrorMsg] = useState('');
  const [isSelectingDir, setIsSelectingDir] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationPaths, setMigrationPaths] = useState<{ oldPath: string; newPath: string } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
    currentFile: string;
  } | null>(null);

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
    if (isInitialLoad.current) {
      setPrevTasksLength(currentTasks.length);
      return;
    }

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

    // 订阅物理文件迁移进度 WebSocket 事件
    const socket = SocketClient.getInstance();
    const unsubMigrationProgress = socket.subscribe('migration:progress', (progress: any) => {
      console.log('[Settings] 物理数据迁移实时进度:', progress);
      setMigrationProgress(progress);
    });

    return () => {
      unsubMigrationProgress();
    };
  }, []);

  // 当 self 数据加载成功后，自动同步初始化本端昵称与头像
  useEffect(() => {
    if (self && !newNickname) {
      setNewNickname(self.nickname);
      setNewAvatar(self.avatar || '💻');
    }
  }, [self, newNickname]);

  const renderSelfAvatar = (avatar: string, size = 13) => {
    switch (avatar) {
      case 'avatar-1':
        return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      case 'avatar-2':
        return <Monitor size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      case 'avatar-3':
        return <Smartphone size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      default:
        if (avatar && avatar.trim()) {
          if (avatar === '💻') {
            return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          if (avatar === '🖥️') {
            return <Monitor size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          if (avatar === '📱') {
            return <Smartphone size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar}</span>;
        }
        return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
    }
  };

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

  const handleSaveConfig = async (migrate?: boolean) => {
    if (!storagePath.trim()) return;
    
    // 强制防御性检查：若因为 React 事件绑定错误导致将 Event 传入，则安全过滤为 undefined
    const realMigrate = typeof migrate === 'boolean' ? migrate : undefined;
    
    if (realMigrate === true) {
      setIsMigrating(true);
      setMigrationProgress({
        total: 0,
        current: 0,
        percentage: 0,
        currentFile: '准备建立局域网数据合流信道...'
      });
    }
    setConfigStatus('saving');
    
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storagePath: storagePath.trim(),
          migrate: realMigrate
        })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.requireMigration) {
          // 触发迁移确认模态框
          setMigrationPaths({ oldPath: data.oldPath, newPath: data.newPath });
          setShowMigrationModal(true);
          setConfigStatus('idle');
        } else {
          // 配置正式应用成功
          setShowMigrationModal(false);
          setMigrationProgress(null);
          setStoragePath(data.storagePath);
          setAbsolutePath(data.absolutePath);
          setConfigStatus('success');
          setTimeout(() => setConfigStatus('idle'), 3000);
          
          // 获取最新绝对路径
          fetchConfig();
          
          // 派发自定义全局更改事件，让共享文件和知识库模块能感知变化并立即刷新重载
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('storage-path-changed'));
          }
        }
      } else {
        setShowMigrationModal(false);
        setMigrationProgress(null);
        setConfigStatus('error');
        setConfigErrorMsg(data.error || '路径无效或系统没有对该路径的写权限');
      }
    } catch (err: any) {
      setShowMigrationModal(false);
      setMigrationProgress(null);
      setConfigStatus('error');
      setConfigErrorMsg(err.message || '配置提交异常');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSelectDirectory = async () => {
    setIsSelectingDir(true);
    try {
      const res = await fetch('/api/config/select-directory', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        if (!data.canceled && data.path) {
          setStoragePath(data.path);
        }
      } else {
        setConfigStatus('error');
        setConfigErrorMsg(data.error || '系统弹窗调用异常，请手动输入路径');
      }
    } catch (err: any) {
      setConfigStatus('error');
      setConfigErrorMsg(err.message || '调用系统资源管理器失败，请手动输入路径');
    } finally {
      setIsSelectingDir(false);
    }
  };

  // 统计互传任务数
  const activeTasksCount = Object.values(tasks).filter(
    t => t.status === 'transferring' || t.status === 'pending'
  ).length;
  const totalTasksCount = Object.values(tasks).length;

  return (
    <div className="app-container">
      
      {/* 1. 左侧大厂极简侧边导航栏 (Sidebar) */}
      <aside className={`sidebar-container ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* 顶部 Logo & 品牌区 */}
        <div>
          <div className="sidebar-logo-group" style={{ 
            display: 'flex', 
            flexDirection: isSidebarCollapsed ? 'column' : 'row',
            alignItems: 'center', 
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            gap: isSidebarCollapsed ? '12px' : '0px',
            padding: isSidebarCollapsed ? '20px 8px' : '24px 20px',
            borderBottom: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', justifyContent: 'center' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
              }}>
                <Radio size={16} style={{ color: 'var(--accent-color)' }} />
              </div>
              {!isSidebarCollapsed && (
                <div className="sidebar-title-group" style={{
                  animation: 'fadeIn 0.15s ease-out forwards'
                }}>
                  <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Share Home</h1>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>局域网协作平台</p>
                </div>
              )}
            </div>

            {/* 折叠切换按钮 */}
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? '展开导航' : '收起导航'}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                marginTop: isSidebarCollapsed ? '8px' : '0px',
                width: isSidebarCollapsed ? '32px' : 'auto',
                height: isSidebarCollapsed ? '32px' : 'auto',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* 导航菜单列表 */}
          <nav className="sidebar-nav" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('transfer')}
              className="sidebar-nav-btn"
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
              <Files size={15} style={{ color: activeTab === 'transfer' ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span className="sidebar-nav-text">极速文件流</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className="sidebar-nav-btn"
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
              <FolderOpen size={15} style={{ color: activeTab === 'share' ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span className="sidebar-nav-text">共享中心</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className="sidebar-nav-btn"
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
              <FileText size={15} style={{ color: activeTab === 'knowledge' ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span className="sidebar-nav-text">云文档</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className="sidebar-nav-btn"
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
              <History size={15} style={{ color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span className="sidebar-nav-text">传输记录</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="sidebar-nav-btn"
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
              <Settings size={15} style={{ color: activeTab === 'settings' ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span className="sidebar-nav-text">系统配置</span>
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
                        <option value="avatar-1">💻 笔记本</option>
                        <option value="avatar-2">🖥️ 显示器</option>
                        <option value="avatar-3">📱 手机</option>
                        <option value="🚀">🚀 火箭</option>
                        <option value="🐱">🐱 猫咪</option>
                        <option value="🦊">🦊 狐狸</option>
                        <option value="🤖">🤖 机器人</option>
                        <option value="🍎">🍎 苹果</option>
                        <option value="🎨">🎨 调色板</option>
                        <option value="⚡">⚡ 闪电</option>
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
                    className="sidebar-profile-card"
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
                      {renderSelfAvatar(self.avatar, 13)}
                      <span className="sidebar-profile-details" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {self.nickname}
                      </span>
                    </div>
                    <Edit3 size={11} className="sidebar-profile-edit" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
      <main className="workspace-container fade-in">
        
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
              {activeTasksCount > 0 && (
                <span style={{
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}>
                  {activeTasksCount}
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
          {activeTab === 'history' && (
            <div className="fade-in">
              <TransferHistory 
                tasks={tasks} 
                self={self} 
                onDeleteTask={deleteTask}
                onClearHistory={clearHistory}
              />
            </div>
          )}

          {/* TAB 3: 系统配置控制台仪表盘 */}
          {activeTab === 'settings' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '24px',
              width: '100%',
              alignItems: 'start'
            }} className="fade-in">
              
              {/* ===================== 左侧分栏：核心存储与网络服务控制器 ===================== */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 核心配置：动态存储路径修改 */}
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 头部标题与存储徽章 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'rgba(37, 99, 235, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <FolderOpen size={14} style={{ color: 'var(--accent-color)' }} />
                        </div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>默认文件及文档存储目录</h3>
                      </div>
                      
                      {/* 物理路径健康微光指示灯 */}
                      <span style={{
                        fontSize: '0.68rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: 'var(--success-color)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '99px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: 'var(--success-color)',
                          display: 'inline-block',
                          boxShadow: '0 0 6px var(--success-color)'
                        }} />
                        存储就绪
                      </span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      收到的局域网传输文件，以及您创建同步的云文档，均会实时存放于此物理目录中。支持绝对路径或以 `./` 开头的根相对路径。
                    </p>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={storagePath}
                          onChange={(e) => setStoragePath(e.target.value)}
                          placeholder="例如: ./storage"
                          style={{
                            width: '100%',
                            background: 'rgba(0, 0, 0, 0.15)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '10px 16px',
                            paddingRight: '45px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            transition: 'all 0.2s',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--accent-color)';
                            e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.12)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--border-color)';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                        <button
                          onClick={handleSelectDirectory}
                          disabled={isSelectingDir}
                          title="弹出系统文件浏览器选择物理存储路径"
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-color)';
                            e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {isSelectingDir ? (
                            <RefreshCw size={15} style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }} />
                          ) : (
                            <FolderOpen size={15} />
                          )}
                        </button>
                      </div>
                      <Button onClick={() => handleSaveConfig()} disabled={configStatus === 'saving' || !storagePath.trim() || isSelectingDir}>
                        {configStatus === 'saving' ? '正在校验保存...' : '应用修改'}
                      </Button>
                    </div>

                    {/* 状态反馈 */}
                    {configStatus === 'success' && (
                      <div style={{
                        padding: '10px 14px',
                        background: 'var(--success-glow)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        borderRadius: '10px',
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
                        borderRadius: '10px',
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
                        background: 'rgba(128, 128, 128, 0.03)',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px dashed var(--border-color)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace'
                      }}>
                        <strong>当前服务器绝对落盘路径：</strong> {absolutePath}
                      </div>
                    )}
                  </div>
                </Card>

                {/* 局域网协同办公安全指引 */}
                <Card style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.02) 0%, rgba(59, 130, 246, 0.02) 100%)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <Info size={16} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>去中心化局域网多播提醒</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                        Share Home 依赖 mDNS 多播及去中心化点对点网络工作。请确保所有协作节点设备均连入同一局域网（或 Wi-Fi），且本端防火墙已开放相应的 WebSocket 及 HTTP 端口信道，即可获得最佳体验。
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* ===================== 右侧分栏：本端极客身份个性化与网络探测 ===================== */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 新增：设备身份档案舱卡片 */}
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'rgba(99, 102, 241, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Edit3 size={14} style={{ color: 'var(--accent-color)' }} />
                      </div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>本端设备身份名片</h3>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      个性化您在局域网中的展现身份，设置后邻居节点将立即看到您的更改。
                    </p>

                    {/* 头像展示与拟物化键盘选择 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>快速选择专属极客头像</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                        {['💻', '🚀', '🐱', '🦊', '🤖', '🍎', '🎨', '⚡'].map((emoji) => {
                          const isSelected = newAvatar === emoji;
                          return (
                            <button
                              key={emoji}
                              onClick={() => setNewAvatar(emoji)}
                              style={{
                                fontSize: '1.3rem',
                                padding: '8px 0',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(128, 128, 128, 0.02)',
                                border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.15)' : 'none',
                                transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(128, 128, 128, 0.06)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(128, 128, 128, 0.02)';
                              }}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 昵称编辑输入框及一键同步按钮 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>自定义设备昵称</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                          type="text"
                          value={newNickname}
                          onChange={(e) => setNewNickname(e.target.value)}
                          placeholder="输入您的专属极客昵称"
                          maxLength={16}
                          style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.15)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            transition: 'all 0.2s'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--accent-color)';
                            e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.12)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--border-color)';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                        <Button 
                          onClick={saveProfile} 
                          disabled={!newNickname.trim() || !!(self && self.nickname === newNickname && self.avatar === newAvatar)}
                        >
                          同步修改档案
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 本端设备的高端硬件及网络参数 */}
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'rgba(37, 99, 235, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Cpu size={14} style={{ color: 'var(--accent-color)' }} />
                      </div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>本端局域网硬件参数</h3>
                    </div>

                    {self && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)', width: '120px', flexShrink: 0 }}>设备唯一标识</span>
                          <span style={{ 
                            color: 'var(--text-primary)', 
                            fontFamily: 'monospace', 
                            background: 'rgba(128, 128, 128, 0.05)', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            wordBreak: 'break-all'
                          }}>{self.id}</span>
                        </div>
                        <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)', width: '120px', flexShrink: 0 }}>本端网络 IP 地址</span>
                          <span style={{ 
                            color: 'var(--text-primary)', 
                            fontFamily: 'monospace', 
                            background: 'rgba(128, 128, 128, 0.05)', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            fontSize: '0.72rem'
                          }}>{self.ip}</span>
                        </div>
                        <div style={{ display: 'flex', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)', width: '120px', flexShrink: 0 }}>节点侦听端口</span>
                          <span style={{ 
                            color: 'var(--text-primary)', 
                            fontFamily: 'monospace', 
                            background: 'rgba(128, 128, 128, 0.05)', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            fontSize: '0.72rem'
                          }}>{self.port}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.76rem', marginTop: '4px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>去中心化服务信道状态</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '2px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)', fontWeight: 600 }}>
                              <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: 'var(--success-color)', 
                                display: 'inline-block', 
                                boxShadow: '0 0 8px var(--success-color)',
                                animation: 'pulse 2s infinite'
                              }} />
                              WebSocket 信道 (Active)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)', fontWeight: 600 }}>
                              <span style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                background: 'var(--success-color)', 
                                display: 'inline-block', 
                                boxShadow: '0 0 8px var(--success-color)',
                                animation: 'pulse 2s infinite'
                              }} />
                              mDNS 发现 (Active)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

              </div>

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
        onCancel={cancelTransfer}
        isOpen={isTransferDrawerOpen}
        onClose={() => setIsTransferDrawerOpen(false)}
      />

      {/* 4. 高端数据安全合并迁移确认弹窗 */}
      {showMigrationModal && migrationPaths && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          background: theme === 'dark' ? 'rgba(9, 9, 11, 0.75)' : 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px) saturate(190%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, rgba(128, 128, 128, 0.15))',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: theme === 'dark' 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.08)' 
              : '0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 0 20px rgba(99, 102, 241, 0.04)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative',
          }}>
            {/* 头部区域 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FolderOpen size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>发现历史存储数据</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>检测到您的原有目录中存有数据文件</p>
              </div>
            </div>

            {/* 警示说明框 */}
            <div style={{
              background: 'rgba(128, 128, 128, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '16px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div>
                您即将将默认存储路径更换为：
                <div style={{
                  background: 'rgba(99, 102, 241, 0.05)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--accent-color)',
                  wordBreak: 'break-all',
                  border: '1px solid rgba(99, 102, 241, 0.15)'
                }}>
                  {migrationPaths.newPath}
                </div>
              </div>

              <div>
                原物理存储目录中存有共享文件及协作云文档：
                <div style={{
                  background: 'rgba(128, 128, 128, 0.05)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-muted)',
                  wordBreak: 'break-all',
                  border: '1px solid var(--border-color)'
                }}>
                  {migrationPaths.oldPath}
                </div>
              </div>

              <div style={{ color: '#fbbf24', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', marginTop: '4px' }}>
                <ShieldAlert size={13} style={{ flexShrink: 0, color: '#fbbf24' }} />
                <span>推荐执行“一键自动迁移”，确保历史共享与云文档在新目录中无缝重现。</span>
              </div>
            </div>

            {/* 行为决策按钮区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {isMigrating ? (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}>
                  {/* 第一行：状态标题 + 实时百分比数值 */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', fontSize: '0.82rem', fontWeight: 600 }}>
                      <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                      <span>正在全速合并搬运历史文件...</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-color)', marginLeft: 'auto' }}>
                      {migrationProgress ? `${migrationProgress.percentage}%` : '0%'}
                    </span>
                  </div>

                  {/* 物理进度条轨道 */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(128, 128, 128, 0.08)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${migrationProgress ? migrationProgress.percentage : 0}%`,
                      background: 'linear-gradient(90deg, var(--accent-color, #2563eb) 0%, rgba(99, 102, 241, 0.8) 100%)',
                      borderRadius: '99px',
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)'
                    }} />
                  </div>

                  {/* 底部详细文件名展示 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{
                      display: 'flex',
                      width: '100%',
                      fontFamily: 'monospace'
                    }}>
                      <span>文件处理总进度:</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>
                        {migrationProgress ? `${migrationProgress.current} / ${migrationProgress.total}` : '0 / 0'}
                      </span>
                    </div>
                    
                    <div style={{
                      background: 'rgba(128, 128, 128, 0.05)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }} title={migrationProgress?.currentFile || '准备迁移...'}>
                      <span style={{ color: 'var(--accent-color)', flexShrink: 0 }}>📂</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {migrationProgress ? migrationProgress.currentFile : '建立安全通道...'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleSaveConfig(true)}
                    style={{
                      background: 'var(--accent-color, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    <Check size={15} />
                    一键自动迁移并应用
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleSaveConfig(false)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(128, 128, 128, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      仅切换路径 (保留现状)
                    </button>
                    <button
                      onClick={() => {
                        setShowMigrationModal(false);
                        setMigrationPaths(null);
                        // 恢复为原配置路径
                        fetchConfig();
                      }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid transparent',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      取消修改
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
