'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMdnsPeers } from '@/hooks/useMdnsPeers';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { SocketClient } from '@/lib/socketClient';
import PeerList from '@/components/features/peers/PeerList';
import Transfer from '@/components/features/transfer/Transfer';
import SharedFiles from '@/components/features/transfer/SharedFiles';
import RecordCenter from '@/components/features/transfer/RecordCenter';
import KnowledgeBase from '@/components/features/knowledge-base/KnowledgeBase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Radio, RefreshCw, Laptop, Monitor, Smartphone, Edit3, Check, 
  Files, FileText, Settings, ShieldAlert, FolderOpen,
  Info, Cpu, Sun, Moon, ArrowUpDown,
  History,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';

type ActiveTab = 'transfer' | 'share' | 'knowledge' | 'settings' | 'history-transfer' | 'history-share' | 'history-document';

export default function Home() {
  // 1. 初始化局域网在线节点发现逻辑
  const { peers, self, isConnected, updateProfile, refreshPeers } = useMdnsPeers();

  // 侧边导航栏折叠显隐状态 (持久化缓存)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRecordMenuExpanded, setIsRecordMenuExpanded] = useState(false);

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

  // 系统设置局部二级 Tab 导航状态
  const [settingsSubTab, setSettingsSubTab] = useState<'storage' | 'profile' | 'network' | 'guidelines'>('storage');

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
  const isProfileInitialized = useRef(false);

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
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

  // 当 self 数据加载成功后，自动同步初始化本端昵称与头像 (仅在非编辑状态下同步，避免清空昵称时回显的 bug)
  useEffect(() => {
    if (self && !isEditingProfile) {
      if (!isProfileInitialized.current || self.nickname !== newNickname || self.avatar !== newAvatar) {
        setNewNickname(self.nickname);
        setNewAvatar(self.avatar || '💻');
        isProfileInitialized.current = true;
      }
    }
  }, [self, isEditingProfile]);

  // 智能状态同步：当激活路由为记录中心的子分类时，自动展开二级导航菜单
  useEffect(() => {
    if (activeTab.startsWith('history-') && !isSidebarCollapsed) {
      setIsRecordMenuExpanded(true);
    }
  }, [activeTab, isSidebarCollapsed]);

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
  return (
    <div className="app-container">
      
      {/* 1. 左侧大厂极简侧边导航栏 (Sidebar) */}
      <aside className={`sidebar-container ${isSidebarCollapsed ? 'collapsed' : ''} bg-sidebar border-r border-border/40 flex flex-col justify-between flex-shrink-0 z-10 duration-300`}>
        {/* 顶部 Logo & 品牌区 */}
        <div>
          <div className={`sidebar-logo-group flex ${isSidebarCollapsed ? 'flex-col justify-center py-5 px-2 gap-3' : 'flex-row justify-between py-6 px-5 gap-0'} items-center border-b border-border/40 relative`}>
            <div className="flex items-center gap-3 overflow-hidden justify-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm flex-shrink-0">
                <Radio size={16} className="text-primary animate-pulse" />
              </div>
              {!isSidebarCollapsed && (
                <div className="sidebar-title-group animate-in fade-in slide-in-from-left-2 duration-200">
                  <h1 className="text-sm font-bold text-foreground tracking-tight white-space-nowrap">Share Home</h1>
                  <p className="text-[10px] text-muted-foreground tracking-wide white-space-nowrap">局域网协作平台</p>
                </div>
              )}
            </div>

            {/* 折叠切换按钮 */}
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? '展开导航' : '收起导航'}
              className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                isSidebarCollapsed ? 'mt-2 w-8 h-8' : 'w-auto h-auto'
              }`}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* 导航菜单列表 */}
          <nav className="sidebar-nav p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('transfer')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'transfer'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Files size={15} className={`flex-shrink-0 ${activeTab === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">极速文件流</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'share'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <FolderOpen size={15} className={`flex-shrink-0 ${activeTab === 'share' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">共享中心</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'knowledge'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <FileText size={15} className={`flex-shrink-0 ${activeTab === 'knowledge' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">云文档</span>
            </button>

            <div className="flex flex-col w-full">
              <button
                onClick={() => {
                  setIsRecordMenuExpanded(!isRecordMenuExpanded);
                  if (!activeTab.startsWith('history-')) {
                    setActiveTab('history-transfer'); // 点击大类默认切换到第一个子菜单
                  }
                }}
                className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                  activeTab.startsWith('history-')
                    ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                    : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <History size={15} className={`flex-shrink-0 ${activeTab.startsWith('history-') ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="sidebar-nav-text">记录中心</span>
                {!isSidebarCollapsed && (
                  <ChevronDown 
                    size={12} 
                    className={`ml-auto opacity-60 transition-transform duration-300 ${
                      isRecordMenuExpanded ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                )}
              </button>

              {/* 二级侧边导航子菜单 (大厂级莫兰迪缩进美学) */}
              {isRecordMenuExpanded && !isSidebarCollapsed && (
                <div className="flex flex-col gap-1 pl-5 mt-1.5 border-l border-border/40 ml-4 animate-in fade-in duration-200">
                  <button
                    onClick={() => setActiveTab('history-transfer')}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                      activeTab === 'history-transfer'
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${
                      activeTab === 'history-transfer' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                    } inline-block`} />
                    设备互传历史
                  </button>

                  <button
                    onClick={() => setActiveTab('history-share')}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                      activeTab === 'history-share'
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${
                      activeTab === 'history-share' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                    } inline-block`} />
                    共享上传记录
                  </button>

                  <button
                    onClick={() => setActiveTab('history-document')}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                      activeTab === 'history-document'
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full ${
                      activeTab === 'history-document' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                    } inline-block`} />
                    云文档活动日志
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Settings size={15} className={`flex-shrink-0 ${activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">系统配置</span>
            </button>
          </nav>
        </div>

        {/* 侧边栏底部本端身份管理与主题切换区 */}
        <div className="p-4 border-t border-border/40">
          {self && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                {isEditingProfile ? (
                  <div className="flex flex-col gap-2 p-2.5 bg-muted/30 border border-border/40 rounded-lg animate-in fade-in duration-200">
                    <Input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="bg-background border-border/40 text-xs px-2.5 py-1.5 rounded-md w-full h-8"
                      maxLength={10}
                      placeholder="昵称"
                    />
                    <div className="flex gap-2 items-center">
                      <select
                        value={newAvatar}
                        onChange={(e) => setNewAvatar(e.target.value)}
                        className="bg-background text-foreground border border-border/40 rounded-md text-[11px] p-1 h-8 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
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
                      <Button
                        onClick={saveProfile} 
                        size="sm"
                        className="h-8 px-2 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                      >
                        <Check size={11} />
                        存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={startEditProfile}
                    className="sidebar-profile-card flex items-center justify-between cursor-pointer bg-muted/20 border border-border/30 px-2.5 py-2 rounded-lg hover:border-border/60 hover:bg-muted/40 transition-all duration-200 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      {renderSelfAvatar(self.avatar, 13)}
                      <span className="sidebar-profile-details text-xs font-semibold text-foreground overflow-hidden text-ellipsis white-space-nowrap">
                        {self.nickname}
                      </span>
                    </div>
                    <Edit3 size={11} className="sidebar-profile-edit text-muted-foreground flex-shrink-0 opacity-60" />
                  </div>
                )}
              </div>

              {!isEditingProfile && (
                <button
                  onClick={toggleTheme}
                  title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
                  className="w-9 h-9 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center cursor-pointer hover:border-border/60 hover:bg-muted/40 transition-all duration-200 text-foreground flex-shrink-0"
                >
                  {theme === 'dark' ? (
                    <Sun size={15} className="text-amber-500 animate-spin-slow" />
                  ) : (
                    <Moon size={15} className="text-indigo-500" />
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
        <header className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {activeTab === 'transfer' && '文件传输工作台'}
              {activeTab === 'share' && '公共共享中心'}
              {activeTab === 'knowledge' && '知识协作云文档'}
              {activeTab.startsWith('history-') && '操作与协作记录中心'}
              {activeTab === 'settings' && '全局系统配置'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === 'transfer' && '安全、无压缩的局域网零阻碍点对点极速传输'}
              {activeTab === 'share' && '长效、大文件零压缩合并存储的局域网公共共享空间'}
              {activeTab === 'knowledge' && '支持富文本与代码的局域网去中心化物理落盘云文档'}
              {activeTab.startsWith('history-') && '局域网互传历史、共享上传审计以及云协作审计日志'}
              {activeTab === 'settings' && '修改默认存储路径以及查看本端硬件和网络特征'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={isConnected
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-border text-muted-foreground'}
            >
              <span className={`size-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              {isConnected ? '局域网信道在线' : '离线状态'}
            </Badge>

            {/* 传输任务触发按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferDrawerOpen(!isTransferDrawerOpen)}
              className={activeTasksCount > 0 ? 'shadow-[0_0_12px_var(--accent-glow)]' : ''}
            >
              <ArrowUpDown className={activeTasksCount > 0 ? 'text-primary' : 'text-muted-foreground'} />
              <span>传输任务</span>
              {activeTasksCount > 0 && (
                <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[11px]">
                  {activeTasksCount}
                </Badge>
              )}
            </Button>

            <Button variant="secondary" size="sm" onClick={refreshPeers}>
              <RefreshCw />
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

          {/* TAB 4: 大统一记录中心 (Activity Hub) */}
          {activeTab.startsWith('history-') && (
            <div className="fade-in">
              <RecordCenter 
                tasks={tasks} 
                self={self} 
                subTab={
                  activeTab === 'history-share' 
                    ? 'share' 
                    : activeTab === 'history-document' 
                      ? 'document' 
                      : 'transfer'
                }
                onDeleteTask={deleteTask}
                onClearHistory={clearHistory}
                onNavigateToDoc={(docId) => {
                  // 智能缓存待定位文档的 id，并激活 Tab 跳转至云文档模块
                  localStorage.setItem('kb_selected_id', docId);
                  setActiveTab('knowledge');
                  // 延时发送跨组件自定义事件，确保云文档组件有足够时机就绪并执行自动高亮选中
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('kb-select-doc', { detail: docId }));
                  }, 50);
                }}
              />
            </div>
          )}

          {/* TAB 3: 系统配置控制台仪表盘 (完全去卡片化，带二级 Inner Tab 导航与平铺配置直行设计) */}
          {activeTab === 'settings' && (
            <div className="flex flex-col md:flex-row gap-8 w-full items-start fade-in mt-2">
              
              {/* 左侧：shadcn Tabs 二级配置导航 */}
              <Tabs
                value={settingsSubTab}
                onValueChange={(value) => setSettingsSubTab(value as typeof settingsSubTab)}
                orientation="vertical"
                className="w-full shrink-0 border-b border-border/10 pb-4 md:w-[180px] md:border-b-0 md:border-r md:pb-0 md:pr-4"
              >
                <TabsList
                  variant="line"
                  className="flex w-full flex-row justify-start gap-1 md:flex-col md:items-stretch"
                >
                  {(['storage', 'profile', 'network', 'guidelines'] as const).map((sub) => {
                  const label = {
                    storage: '基础存储',
                    profile: '极客头像',
                    network: '网络参数',
                    guidelines: '安全指引'
                  }[sub];
                  const icon = {
                    storage: <FolderOpen size={13} />,
                    profile: <Edit3 size={13} />,
                    network: <Cpu size={13} />,
                    guidelines: <Info size={13} />
                  }[sub];
                  return (
                    <TabsTrigger
                      key={sub}
                      value={sub}
                      className="h-8 justify-start rounded-lg px-3 text-xs data-active:bg-muted/60"
                    >
                      {icon}
                      {label}
                    </TabsTrigger>
                  );
                })}
                </TabsList>
              </Tabs>

              {/* 右侧：扁平去卡片化流式配置项面板 */}
              <div className="flex-1 w-full flex flex-col gap-6">
                
                {/* SUB TAB 1: 基础存储目录配置 */}
                {settingsSubTab === 'storage' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border/20 pb-3">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-bold text-foreground">默认文件及文档存储目录</h3>
                        <p className="text-[11px] text-muted-foreground">收到的文件及创建的同步云文档，均存放在本端此物理目录中</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/15 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        就绪
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-4 py-2">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                        <div className="flex-1 min-w-[200px] pr-4">
                          <h4 className="text-xs font-bold text-foreground">物理落盘绝对路径</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            支持设定绝对路径或以 `./` 开头的根相对路径，请确保系统对其拥有完整的写权限
                          </p>
                        </div>
                        
                        <div className="flex gap-2.5 w-full md:w-auto shrink-0 min-w-[320px]">
                          <div className="relative flex-1 flex items-center">
                            <Input
                              type="text"
                              value={storagePath}
                              onChange={(e) => setStoragePath(e.target.value)}
                              placeholder="例如: ./storage"
                              className="w-full border-border/80 pr-10 focus-visible:ring-2 focus-visible:ring-zinc-500/10 focus-visible:border-border-hover transition-all duration-200"
                            />
                            <button
                              onClick={handleSelectDirectory}
                              disabled={isSelectingDir}
                              title="弹出系统文件浏览器选择物理存储路径"
                              className="absolute right-2 text-muted-foreground hover:text-primary hover:bg-muted p-1.5 rounded-md transition-all duration-200"
                            >
                              {isSelectingDir ? (
                                <RefreshCw size={14} className="animate-spin text-primary" />
                              ) : (
                                <FolderOpen size={14} />
                              )}
                            </button>
                          </div>
                          <Button
                            onClick={() => handleSaveConfig()} 
                            disabled={configStatus === 'saving' || !storagePath.trim() || isSelectingDir}
                            className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm"
                          >
                            {configStatus === 'saving' ? '验证中...' : '保存'}
                          </Button>
                        </div>
                      </div>

                      {/* 状态反馈提示 */}
                      {configStatus === 'success' && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                          <Check size={14} />
                          存储路径校验通过，修改已成功持久化保存！
                        </div>
                      )}
                      {configStatus === 'error' && (
                        <div className="p-3 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                          <ShieldAlert size={14} />
                          修改失败：{configErrorMsg}
                        </div>
                      )}

                      {absolutePath && (
                        <div className="text-[10px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/10 border-dashed word-break font-mono leading-relaxed mt-2">
                          <strong className="text-foreground">当前服务器绝对落盘路径：</strong> {absolutePath}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB TAB 2: 极客头像与本端身份 */}
                {settingsSubTab === 'profile' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">本端设备身份名片</h3>
                      <p className="text-[11px] text-muted-foreground">自定义你在局域网群组中展示给对等体的个人极客档案</p>
                    </div>

                    <div className="flex flex-col gap-5 py-2">
                      
                      {/* 头像选择行 */}
                      <div className="flex flex-col md:flex-row gap-4 items-start justify-between py-4 border-b border-border/10">
                        <div className="flex-1 pr-4">
                          <h4 className="text-xs font-bold text-foreground">快速选择专属极客头像</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            选择一个最贴近您硬件设备特征或个性的拟物化标志
                          </p>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 shrink-0 min-w-[280px]">
                          {['💻', '🚀', '🐱', '🦊', '🤖', '🍎', '🎨', '⚡'].map((emoji) => {
                            const isSelected = newAvatar === emoji;
                            return (
                              <button
                                key={emoji}
                                onClick={() => setNewAvatar(emoji)}
                                className={`text-sm py-2 bg-muted/20 hover:bg-muted border rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-zinc-800 border-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-sm font-bold' 
                                    : 'border-border/60'
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 昵称编辑行 */}
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                        <div className="flex-1 pr-4">
                          <h4 className="text-xs font-bold text-foreground">自定义设备昵称</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            设置好昵称后，同一局域网内的邻居节点将立即看到您的设备档案
                          </p>
                        </div>
                        <div className="flex gap-2.5 w-full md:w-auto shrink-0 min-w-[320px]">
                          <Input
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            placeholder="输入您的专属极客昵称"
                            maxLength={16}
                            className="flex-1 border-border/80 focus-visible:ring-2 focus-visible:ring-zinc-500/10 focus-visible:border-border-hover transition-all duration-200"
                          />
                          <Button
                            onClick={saveProfile} 
                            disabled={!newNickname.trim() || !!(self && self.nickname === newNickname && self.avatar === newAvatar)}
                            className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm"
                          >
                            同步修改
                          </Button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* SUB TAB 3: 本端极客网络及端口参数 */}
                {settingsSubTab === 'network' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">本端局域网硬件与网络参数</h3>
                      <p className="text-[11px] text-muted-foreground">底层去中心化 P2P 协作通信信道的本地运行物理状态</p>
                    </div>

                    {self && (
                      <div className="flex flex-col gap-2.5 py-2 font-mono">
                        {/* 节点唯一 ID */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">设备唯一标识</span>
                            <span className="text-[10px] text-muted-foreground">群组识别特征符</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px] max-w-[200px] truncate" title={self.id}>
                            {self.id}
                          </span>
                        </div>

                        {/* 网络 IP 地址 */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">本端网络 IP 地址</span>
                            <span className="text-[10px] text-muted-foreground">局域网物理信道端点</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px]">
                            {self.ip}
                          </span>
                        </div>

                        {/* 侦听端口 */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">节点侦听端口</span>
                            <span className="text-[10px] text-muted-foreground">数据流套接字物理通道</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px]">
                            {self.port}
                          </span>
                        </div>

                        {/* 去中心化状态 */}
                        <div className="flex flex-col gap-2 py-3.5">
                          <span className="text-xs font-bold text-foreground font-sans">去中心化服务信道物理状态</span>
                          <div className="flex flex-wrap gap-3 mt-1 font-sans">
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              WebSocket 信道
                            </span>
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              mDNS 服务自组网
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB TAB 4: 协同指引与多播提醒 */}
                {settingsSubTab === 'guidelines' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">局域网去中心多播提醒</h3>
                      <p className="text-[11px] text-muted-foreground">快速理解 P2P 协作网络的底层保障机制与常见故障排查</p>
                    </div>

                    <div className="flex gap-4 items-start py-4 border-b border-border/10">
                      <Info size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">去中心化多播发现机制</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Share Home 依赖 mDNS（多播 DNS）广播在局域网内自动寻找其他的协作对等体节点，实现零配置自愈合入网。这需要底层网络支持 IGMP / Multicast，如果您的路由器关闭了这一机制，将无法发现节点。
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start py-4 border-b border-border/10">
                      <Cpu size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">防火墙与套接字信道</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          文件极速直传基于本地套接字数据流信道。请确保本端系统防火墙已开放相应的 WebSocket 侦听端口（默认为 3000 及随机高端口），并在防病毒软件中将 Share Home 标记为受信任的应用。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

      {/* 4. 存储目录迁移确认弹窗 */}
      <Dialog
        open={showMigrationModal && !!migrationPaths}
        onOpenChange={(open) => {
          if (!open && !isMigrating) {
            setShowMigrationModal(false);
            setMigrationPaths(null);
            fetchConfig();
          }
        }}
      >
        <DialogContent
          className="max-w-[540px]"
          showCloseButton={!isMigrating}
          onEscapeKeyDown={(event) => isMigrating && event.preventDefault()}
          onInteractOutside={(event) => isMigrating && event.preventDefault()}
        >
          {migrationPaths && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <FolderOpen className="size-5 text-amber-500" />
                </div>
                <DialogTitle>发现历史存储数据</DialogTitle>
                <DialogDescription>
                  检测到原目录中已有共享文件或协作云文档，请选择是否迁移到新目录。
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 text-sm">
                <div className="space-y-2">
                  <p className="text-muted-foreground">新默认存储路径</p>
                  <div className="break-all rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 font-mono text-xs text-primary">
                    {migrationPaths.newPath}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-muted-foreground">原物理存储目录</p>
                  <div className="break-all rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {migrationPaths.oldPath}
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>推荐执行一键自动迁移，确保历史共享与云文档在新目录中完整可用。</span>
                </div>
              </div>

              {isMigrating ? (
                <div className="space-y-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <RefreshCw className="size-4 animate-spin" />
                    <span>正在合并搬运历史文件</span>
                    <span className="ml-auto font-mono">
                      {migrationProgress ? `${migrationProgress.percentage}%` : '0%'}
                    </span>
                  </div>
                  <Progress value={migrationProgress ? migrationProgress.percentage : 0} className="h-2" />
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex font-mono">
                      <span>文件处理总进度</span>
                      <span className="ml-auto text-foreground">
                        {migrationProgress ? `${migrationProgress.current} / ${migrationProgress.total}` : '0 / 0'}
                      </span>
                    </div>
                    <div
                      className="truncate rounded-lg border border-border bg-background/70 px-3 py-2 font-mono text-foreground"
                      title={migrationProgress?.currentFile || '准备迁移...'}
                    >
                      {migrationProgress ? migrationProgress.currentFile : '建立安全通道...'}
                    </div>
                  </div>
                </div>
              ) : (
                <DialogFooter className="gap-2 sm:justify-stretch">
                  <Button className="flex-1" onClick={() => handleSaveConfig(true)}>
                    <Check />
                    自动迁移并应用
                  </Button>
                  <Button className="flex-1" variant="outline" onClick={() => handleSaveConfig(false)}>
                    仅切换路径
                  </Button>
                  <Button
                    className="flex-1"
                    variant="ghost"
                    onClick={() => {
                      setShowMigrationModal(false);
                      setMigrationPaths(null);
                      fetchConfig();
                    }}
                  >
                    取消修改
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
