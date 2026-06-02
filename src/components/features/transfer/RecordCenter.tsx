'use client';

import React, { useState, useEffect } from 'react';
import { TransferTask } from '@/types/transfer';
import TransferHistory from './TransferHistory';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Search, Trash2, Laptop, Monitor, Smartphone, 
  RefreshCw, AlertCircle, ExternalLink, User, Clock
} from 'lucide-react';

interface RecordCenterProps {
  tasks: Record<string, TransferTask>;
  self: any;
  subTab: 'transfer' | 'share' | 'document'; // 受控属性，指示当前要显示的日志子分类
  onDeleteTask?: (taskId: string) => void;
  onClearHistory?: () => void;
  onNavigateToDoc?: (docId: string) => void; // 点击文档日志时的智能跳转回调
}

interface ActivityLog {
  id: string;
  type: 'share' | 'document';
  action: string;
  title: string;
  operator: string;
  avatar: string;
  details: {
    fileName?: string;
    fileSize?: number;
    docId?: string;
    isFolder?: boolean;
    deviceInfo?: string;
  };
  timestamp: number;
}

export default function RecordCenter({
  tasks,
  self,
  subTab,
  onDeleteTask,
  onClearHistory,
  onNavigateToDoc
}: RecordCenterProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const ITEMS_PER_PAGE = 10;

  // 定期或在受控子页签改变时从后端拉取操作日志
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('[RecordCenter] 获取审计日志失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'share' || subTab === 'document') {
      fetchLogs();
    }
    setSearchTerm('');
    currentPage !== 1 && setCurrentPage(1);
  }, [subTab]);

  // 当搜索内容改变时重置页码为首页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // 格式化时间戳为本地格式
  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  // 格式化文件大小
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 分类清空后端的特定日志
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          type: subTab // 仅清空当前处于激活态的大类 ('share' 或 'document')
        })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => prev.filter(l => l.type !== subTab));
        setShowClearConfirm(false);
      }
    } catch (e) {
      console.error('[RecordCenter] 清空审计日志发生异常:', e);
    }
  };

  // 渲染莫兰迪圆头像徽章
  const renderAvatar = (name: string, avatarEmoji?: string) => {
    if (avatarEmoji && !avatarEmoji.startsWith('avatar-') && avatarEmoji.length <= 4) {
      return (
        <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center border border-border shadow-sm flex-shrink-0">
          <span className="text-base leading-none">{avatarEmoji}</span>
        </div>
      );
    }

    const initial = name.trim().charAt(0).toUpperCase() || 'P';
    const colorHash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5;
    const gradients = [
      'from-indigo-500 to-indigo-600',
      'from-emerald-500 to-emerald-600',
      'from-amber-500 to-amber-600',
      'from-pink-500 to-pink-600',
      'from-cyan-500 to-cyan-600'
    ];

    return (
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradients[colorHash]} text-white flex items-center justify-center font-semibold text-xs border border-white/10 shadow-sm flex-shrink-0`}>
        {initial}
      </div>
    );
  };

  // 设备标签渲染
  const renderDeviceBadge = (deviceText?: string) => {
    if (!deviceText) return null;
    const lower = deviceText.toLowerCase();
    
    let label = deviceText;
    let className = 'bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50';
    let icon = <Laptop size={11} />;

    if (lower.includes('win')) {
      label = 'Windows';
      className = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30';
      icon = <Monitor size={11} />;
    } else if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple')) {
      label = 'macOS';
      className = 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/50';
      icon = <Laptop size={11} />;
    } else if (lower.includes('android')) {
      label = 'Android';
      className = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30';
      icon = <Smartphone size={11} />;
    }

    return (
      <span className={`${className} text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1`}>
        {icon}
        {label}
      </span>
    );
  };

  // 按类型过滤和搜索关键字过滤的日志列表
  const filteredLogs = logs
    .filter(log => {
      // 1. 类型大类过滤
      if (log.type !== subTab) return false;
      // 2. 搜索框内容过滤
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const titleMatch = log.title.toLowerCase().includes(query);
        const operatorMatch = log.operator.toLowerCase().includes(query);
        if (!titleMatch && !operatorMatch) return false;
      }
      return true;
    });

  // 日志列表分页 logic
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 渲染分页按钮
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-2">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const p = idx + 1;
          const isSelected = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-8 h-8 rounded-md text-xs font-semibold border transition-all duration-200 ${
                isSelected 
                  ? 'bg-zinc-800 border-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-sm' 
                  : 'bg-muted/30 border-border text-foreground hover:bg-muted/80'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 受控渲染分发 */}
      {subTab === 'transfer' ? (
        // 互传记录：直接嵌套渲染原本精巧炫酷的 TransferHistory 物理记录面板，保留大厂风范
        <TransferHistory 
          tasks={tasks}
          self={self}
          onDeleteTask={onDeleteTask}
          onClearHistory={onClearHistory}
        />
      ) : (
        // 共享记录 & 云文档记录：渲染大厂高科技集中列表面板 (完全去卡片化平铺直行)
        <div className="flex flex-col gap-4">
          
          {/* 高级极简搜索及清空工具条 (彻底去除包裹容器，仅做无框裸露工具行) */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 mt-1">
            <div className="relative w-60">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={subTab === 'share' ? "搜索共享文件名 / 上传者..." : "搜索云文档名称 / 新建者..."}
                className="w-full bg-muted/30 border border-border/80 rounded-md py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-hover focus:ring-2 focus:ring-zinc-500/10 transition-all duration-200"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            {/* 清空按钮逻辑 */}
            {filteredLogs.length > 0 && (
              <div className="relative">
                {showClearConfirm ? (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-1 px-2">
                    <span className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                      <AlertCircle size={12} />
                      确认清空此类全部记录？
                    </span>
                    <button
                      onClick={handleClearLogs}
                      className="bg-destructive text-destructive-foreground rounded px-2 py-0.5 text-[10px] font-semibold hover:bg-destructive/90 transition-colors"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="bg-muted text-muted-foreground border border-border rounded px-2 py-0.5 text-[10px] hover:bg-muted/80 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors text-xs font-medium"
                  >
                    <Trash2 size={13} />
                    清空此类记录
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 列表陈列容器 (无任何Card大包装，一体化平铺直行) */}
          <div className="flex flex-col mt-2">
            <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {subTab === 'share' ? '公共共享空间文件投递日志' : '局域网去中心协作审计日志'}
              </h3>
              <span className="text-xs font-semibold text-muted-foreground/80">
                {isLoading ? '加载日志中...' : `已过滤出 ${filteredLogs.length} 条记录`}
              </span>
            </div>

            <div className="flex flex-col">
              {isLoading ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <RefreshCw size={22} className="text-muted-foreground/60 animate-spin mb-3" />
                  <p className="text-xs text-muted-foreground">正在同步局域网日志数据库...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-12 text-center opacity-70 flex flex-col items-center justify-center">
                  <AlertCircle size={26} className="text-muted-foreground mb-3 opacity-40" />
                  <p className="text-xs text-muted-foreground font-semibold">
                    当前尚无匹配的操作活动记录
                  </p>
                </div>
              ) : (
                paginatedLogs.map(log => {
                  const isFolder = log.details?.isFolder === true;
                  const docId = log.details?.docId;
                  
                  return (
                    <div
                      key={log.id}
                      onClick={() => {
                        // 🌟 云协作日志的高能智能跳转机制
                        if (subTab === 'document' && docId && onNavigateToDoc) {
                          onNavigateToDoc(docId);
                        }
                      }}
                      className={`group py-5 px-1 hover:px-4 hover:bg-muted/10 border-b border-border/15 last:border-b-0 flex items-center justify-between gap-4 transition-all duration-150 rounded-lg orbit-log-row ${
                        subTab === 'document' && docId ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {/* 左侧：详细信息 */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {renderAvatar(log.operator, log.avatar)}
                        
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate max-w-[280px]">
                              {log.title}
                            </span>
                            {/* 仅在共享文件上传显示文件大小 */}
                            {log.type === 'share' && log.details?.fileSize && (
                              <span className="text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-semibold">
                                {formatBytes(log.details.fileSize)}
                              </span>
                            )}
                          </div>
                          
                          {/* 底部副元信息 */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1 font-medium">
                              <User size={10} className="opacity-75" />
                              操作人: {log.operator}
                            </span>
                            <span>•</span>
                            {renderDeviceBadge(log.details?.deviceInfo)}
                            {log.type === 'document' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isFolder 
                                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' 
                                  : 'bg-zinc-800/10 dark:bg-zinc-100/10 text-muted-foreground'
                              }`}>
                                {isFolder ? '文件夹' : '富文本文档'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 右侧：操作时间戳及高能跳转提示 */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 orbit-log-time-shell">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                          <Clock size={10} className="opacity-75" />
                          {formatDateTime(log.timestamp)}
                        </span>
                        
                        {subTab === 'document' && docId && (
                          <span className="text-[9px] text-muted-foreground font-semibold flex items-center gap-0.5 opacity-75 group-hover:opacity-100 group-hover:text-foreground transition-all duration-150">
                            立即前往
                            <ExternalLink size={9} />
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* 分页控制 */}
            {filteredLogs.length > 0 && (
              <div className="py-5 flex items-center justify-center gap-2 mt-4 border-t border-border/10">
                {renderPagination()}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
