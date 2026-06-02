'use client';

import React, { useState, useEffect } from 'react';
import { TransferTask } from '@/types/transfer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Search, Trash2, Laptop, Monitor, Smartphone, 
  CheckCircle2, XCircle, Ban, History, 
  ArrowRightLeft, Sparkles, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';

interface TransferHistoryProps {
  tasks: Record<string, TransferTask>;
  self: any;
  onDeleteTask?: (taskId: string) => void;
  onClearHistory?: () => void;
}

type FilterType = 'all' | 'send' | 'receive' | 'completed' | 'failed';

export default function TransferHistory({ 
  tasks, 
  self, 
  onDeleteTask, 
  onClearHistory 
}: TransferHistoryProps) {
  // 搜索和多维过滤状态
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 当搜索词或过滤条件改变时，重置页码为第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  // 格式化时间
  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  // 格式化大小
  const formatBytesLocal = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 过滤出已结束的历史任务 (已完成、失败、被拒绝)
  const historyTasks = Object.values(tasks).filter(
    t => t.status === 'completed' || t.status === 'failed' || t.status === 'rejected'
  );

  // 统计计算
  const totalCount = historyTasks.length;
  const successCount = historyTasks.filter(t => t.status === 'completed').length;
  const failCount = historyTasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
  const sendCount = historyTasks.filter(t => t.type === 'send' && t.status === 'completed').length;
  const receiveCount = historyTasks.filter(t => t.type === 'receive' && t.status === 'completed').length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

  // 过滤搜索过滤后的任务
  const filteredTasks = historyTasks
    .filter(task => {
      // 1. 搜索过滤
      if (searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase();
        const fileNameMatch = task.fileName.toLowerCase().includes(searchLower);
        const peerNameMatch = task.peerName?.toLowerCase().includes(searchLower) || false;
        if (!fileNameMatch && !peerNameMatch) return false;
      }

      // 2. 状态/分类过滤
      if (activeFilter === 'send') return task.type === 'send';
      if (activeFilter === 'receive') return task.type === 'receive';
      if (activeFilter === 'completed') return task.status === 'completed';
      if (activeFilter === 'failed') return task.status === 'failed' || task.status === 'rejected';

      return true;
    })
    // 降序排序
    .sort((a, b) => b.startedAt - a.startedAt);

  // 分页后的任务列表
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 获取 OS 图标和类型类名
  const getOsInfo = (os: string) => {
    const lower = os.toLowerCase();
    if (lower.includes('win')) {
      return { 
        icon: <Monitor size={12} />, 
        label: 'Windows', 
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30'
      };
    }
    if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple')) {
      return { 
        icon: <Laptop size={12} />, 
        label: 'macOS', 
        className: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-200 border border-neutral-200/50 dark:border-neutral-700/50'
      };
    }
    if (lower.includes('android') || lower.includes('phone') || lower.includes('mobile')) {
      return { 
        icon: <Smartphone size={12} />, 
        label: 'Android', 
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30'
      };
    }
    return { 
      icon: <Laptop size={12} />, 
      label: '未知设备', 
      className: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50'
    };
  };

  // 渲染简写文字圆徽章头像
  const renderAvatar = (name: string, avatar?: string) => {
    // 如果存在自定义头像或 Emoji，则渲染精美的头像背景及符号
    if (avatar && avatar.trim()) {
      const isLaptop = avatar === 'avatar-1' || avatar === '💻';
      const isMonitor = avatar === 'avatar-2' || avatar === '🖥️';
      const isSmartphone = avatar === 'avatar-3' || avatar === '📱';
      
      if (isLaptop || isMonitor || isSmartphone || (!avatar.startsWith('avatar-') && avatar.length <= 4)) {
        return (
          <div className="w-[38px] h-[38px] rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center border border-border shadow-sm flex-shrink-0">
            {isLaptop && <Laptop size={18} />}
            {isMonitor && <Monitor size={18} />}
            {isSmartphone && <Smartphone size={18} />}
            {!isLaptop && !isMonitor && !isSmartphone && (
              <span className="text-[18px] leading-none">{avatar}</span>
            )}
          </div>
        );
      }
    }

    const initial = name.trim().charAt(0).toUpperCase() || 'P';
    const colorHash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5;
    
    // 采用高级柔和莫兰迪色系渐变
    const gradients = [
      'from-indigo-500 to-indigo-600', // 蓝紫
      'from-emerald-500 to-emerald-600', // 翠绿
      'from-amber-500 to-amber-600', // 暖金
      'from-pink-500 to-pink-600', // 柔粉
      'from-cyan-500 to-cyan-600'  // 青碧
    ];

    return (
      <div className={`w-[38px] h-[38px] rounded-full bg-gradient-to-br ${gradients[colorHash]} text-white flex items-center justify-center font-bold text-sm border border-white/10 shadow-sm flex-shrink-0 tracking-wider`}>
        {initial}
      </div>
    );
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push('ellipsis-start');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('ellipsis-end');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages.map((p, idx) => {
      if (typeof p === 'string') {
        return (
          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground text-xs select-none">
            ...
          </span>
        );
      }
      
      const isSelected = p === currentPage;
      return (
        <button
          key={`page-${p}`}
          onClick={() => setCurrentPage(p)}
          className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold border transition-all duration-200 ${
            isSelected 
              ? 'bg-zinc-800 border-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-sm' 
              : 'bg-muted/30 border-border text-foreground hover:bg-muted/80'
          }`}
        >
          {p}
        </button>
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. 大厂风范精细统计仪表盘 (完全裸露、无背景无投影极简平铺设计) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-y-0 py-6 border-b border-border/20 mb-2">
        {/* 指标 1：累计互传 */}
        <div className="md:px-6 flex flex-col gap-2 border-r border-border/15 last:border-r-0">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">累计物理互传</span>
            <History size={14} className="text-muted-foreground opacity-50" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {totalCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold">次</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              成功: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{successCount}</strong>
            </span>
            <span className="flex items-center gap-1">
              异常/拒绝: <strong className="text-destructive font-semibold">{failCount}</strong>
            </span>
          </div>
        </div>

        {/* 指标 2：物理收发结构 */}
        <div className="md:px-6 flex flex-col gap-2 border-r border-border/15 last:border-r-0">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">网络物理流向</span>
            <ArrowRightLeft size={14} className="text-muted-foreground opacity-50" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">{sendCount}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">发</span>
            </div>
            <span className="text-border/60 text-lg font-light mx-1">/</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">{receiveCount}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">收</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-500 animate-pulse" />
            <span>极速高频信道就绪</span>
          </div>
        </div>

        {/* 指标 3：信道质量健康度 */}
        <div className="md:px-6 flex flex-col gap-2 border-r border-border/15 last:border-r-0">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase">物理传输信道质量</span>
            <span className={`w-2 h-2 rounded-full ${
              successRate >= 90 ? 'bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
            }`} />
          </div>
          <div className="flex items-baseline gap-0.5 mt-1">
            <span className={`text-3xl font-extrabold tracking-tight ${
              successRate >= 90 ? 'text-emerald-500' : successRate >= 70 ? 'text-amber-500' : 'text-destructive'
            }`}>{successRate}%</span>
            <span className="text-[10px] text-muted-foreground font-semibold">成功率</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span>信道评级: <strong className={successRate >= 90 ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
              {successRate >= 90 ? '极佳 (Excellent)' : '良好 (Fair)'}
            </strong></span>
          </div>
        </div>
      </div>

      {/* 2. 极简精致搜索与多维过滤工具栏 (彻底去除包裹容器，仅做无框裸露工具行) */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 mt-1">
        {/* 左侧：搜索与 Tab 过滤器 */}
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[280px]">
          
          {/* 大厂极简搜索框 */}
          <div className="relative w-[220px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索文件名 / 对等伙伴..."
              className="w-full bg-muted/30 border border-border/80 rounded-md py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-hover focus:ring-2 focus:ring-zinc-500/10 transition-all duration-200"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* 分类药丸 Tab */}
          <div className="flex bg-muted/20 border border-border/60 rounded-lg p-0.5">
            {(['all', 'send', 'receive', 'completed', 'failed'] as const).map((filter) => {
              const label = {
                all: '全部',
                send: '发送',
                receive: '接收',
                completed: '已落地',
                failed: '异常/拒绝'
              }[filter];

              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`border-none text-[11px] font-semibold px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${
                    isActive 
                      ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm' 
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：一键清空机制 */}
        {onClearHistory && historyTasks.length > 0 && (
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-1 px-2">
                <span className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle size={12} />
                  物理抹除全部？
                </span>
                <button
                  onClick={() => {
                    onClearHistory();
                    setShowClearConfirm(false);
                  }}
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
                className="flex items-center gap-1.5 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200"
              >
                <Trash2 size={13} />
                清空物理记录
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 物理互传记录陈列大列表 (无任何Card外层盒子包裹，纯扁平表格行流) */}
      <div className="flex flex-col mt-2">
        <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            局域网对等体互传历史归档
          </h3>
          <span className="text-xs font-semibold text-muted-foreground/80">
            已过滤出 {filteredTasks.length} 项记录
          </span>
        </div>

        <div className="flex flex-col">
          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center opacity-70 flex flex-col items-center justify-center">
              <History size={30} className="text-muted-foreground mb-3 opacity-40" />
              <p className="text-xs text-muted-foreground font-semibold">
                {searchTerm.trim() !== '' ? '未搜索到匹配的历史物理传输记录' : '当前尚无任何物理传输历史记录'}
              </p>
            </div>
          ) : (
            paginatedTasks.map(task => {
              const isCompleted = task.status === 'completed';
              const isRejected = task.status === 'rejected';
              
              const senderName = task.senderName || '未知发送端';
              const senderIp = task.senderIp || '127.0.0.1';
              const senderOS = task.senderOS || 'Windows';
              
              const receiverName = task.receiverName || '未知接收端';
              const receiverIp = task.receiverIp || '127.0.0.1';
              const receiverOS = task.receiverOS || 'Windows';

              const sOs = getOsInfo(senderOS);
              const rOs = getOsInfo(receiverOS);

              return (
                <div
                  key={task.id}
                  className="group py-5 px-1 hover:px-4 hover:bg-muted/10 border-b border-border/15 last:border-b-0 flex flex-col gap-4 transition-all duration-150 rounded-lg relative overflow-hidden orbit-history-row"
                >
                  {/* 对等互传核心：左中右大厂双翼布局 */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* 左侧：发送端 */}
                    <div className="flex items-center gap-3 min-w-[170px] flex-1 orbit-history-sender">
                      {renderAvatar(senderName, task.senderAvatar)}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{senderName}</span>
                          <span className={`${sOs.className} text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1`}>
                            {sOs.icon}
                            {sOs.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">IP: {senderIp}</span>
                      </div>
                    </div>

                    {/* 中间：SVG 高科技管道流动线 */}
                    <div className="flex flex-col items-center gap-1 flex-2 min-w-[150px] relative orbit-history-pipe">
                      {/* SVG 精细虚线流动管道 */}
                      <svg width="100%" height="8" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2050/svg" className="overflow-visible">
                        <path 
                          d="M0 4H200" 
                          stroke={isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'} 
                          strokeWidth="1.2" 
                          strokeDasharray="5 3"
                          className="opacity-45 animate-[dash_25s_linear_infinite] group-hover:animate-[dash_10s_linear_infinite] transition-all"
                        />
                        {/* 状态波纹 */}
                        <circle cx={isCompleted ? "180" : "100"} cy="4" r="2" fill={isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'} className="opacity-80 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                      </svg>

                      {/* 中间药丸徽章 */}
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        isCompleted 
                          ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                          : isRejected 
                            ? 'bg-amber-500/10 border-amber-500/15 text-amber-600 dark:text-amber-400' 
                            : 'bg-destructive/10 border-destructive/15 text-destructive'
                      }`}>
                        {isCompleted ? (
                          <>
                            <CheckCircle2 size={9} />
                            <span>物理下载落地</span>
                          </>
                        ) : isRejected ? (
                          <>
                            <Ban size={9} />
                            <span>接收端拒绝</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={9} />
                            <span>信道中断/异常</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 右侧：接收端 */}
                    <div className="flex items-center gap-3 min-w-[170px] flex-1 justify-end text-right orbit-history-receiver">
                      <div className="flex flex-col gap-0.5 items-end">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`${rOs.className} text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1`}>
                            {rOs.icon}
                            {rOs.label}
                          </span>
                          <span className="text-xs font-bold text-foreground">{receiverName}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">IP: {receiverIp}</span>
                      </div>
                      {renderAvatar(receiverName, task.receiverAvatar)}
                    </div>
                  </div>

                  {/* 底部：文件描述元数据与具体时间戳，附带物理抹除动作 */}
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground flex-wrap gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{task.fileName}</span>
                      <span className="text-muted-foreground font-mono">({formatBytesLocal(task.fileSize)})</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-muted-foreground font-medium">
                        {formatDateTime(task.startedAt)}
                      </div>

                      {/* 物理单条抹除按钮 */}
                      {onDeleteTask && (
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          title="从本地数据库中彻底抹除此记录"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded transition-all duration-200"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. 精美分页导航组件 (完全扁平无大框分页条) */}
        {filteredTasks.length > 0 && (
          <div className="py-5 flex items-center justify-between flex-wrap gap-3 mt-4 border-t border-border/10">
            {/* 左侧：分页状态 */}
            <span className="text-xs text-muted-foreground font-medium">
              显示第 <strong className="text-foreground">{startIndex + 1}</strong> 至 <strong className="text-foreground">{Math.min(startIndex + ITEMS_PER_PAGE, filteredTasks.length)}</strong> 项，共 <strong className="text-foreground">{filteredTasks.length}</strong> 项记录
            </span>

            {/* 右侧：页码及前/后页按钮 */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={`border border-border rounded-md w-8 h-8 flex items-center justify-center transition-all duration-200 ${
                  currentPage === 1 
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground' 
                    : 'bg-muted/30 text-foreground hover:bg-muted/80'
                }`}
              >
                <ChevronLeft size={15} />
              </button>

              {/* 渲染数字页码 */}
              {renderPageNumbers()}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className={`border border-border rounded-md w-8 h-8 flex items-center justify-center transition-all duration-200 ${
                  currentPage === totalPages 
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground' 
                    : 'bg-muted/30 text-foreground hover:bg-muted/80'
                }`}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SVG 动画 CSS 注入 */}
      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
