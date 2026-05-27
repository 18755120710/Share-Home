'use client';

import React, { useState, useEffect } from 'react';
import { TransferTask } from '@/types/transfer';
import Card from '@/components/ui/Card';
import { 
  Search, Trash2, Laptop, Monitor, Smartphone, 
  CheckCircle2, XCircle, Ban, History, ShieldAlert, 
  ArrowRightLeft, Check, Sparkles, AlertCircle,
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
        className: 'device-badge windows'
      };
    }
    if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple')) {
      return { 
        icon: <Laptop size={12} />, 
        label: 'macOS', 
        className: 'device-badge macos'
      };
    }
    if (lower.includes('android') || lower.includes('phone') || lower.includes('mobile')) {
      return { 
        icon: <Smartphone size={12} />, 
        label: 'Android', 
        className: 'device-badge android'
      };
    }
    return { 
      icon: <Laptop size={12} />, 
      label: '未知设备', 
      className: 'device-badge general'
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
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(128, 128, 128, 0.05)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            flexShrink: 0
          }}>
            {isLaptop && <Laptop size={18} />}
            {isMonitor && <Monitor size={18} />}
            {isSmartphone && <Smartphone size={18} />}
            {!isLaptop && !isMonitor && !isSmartphone && (
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{avatar}</span>
            )}
          </div>
        );
      }
    }

    const initial = name.trim().charAt(0).toUpperCase() || 'P';
    const colorHash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5;
    
    // 采用高级柔和莫兰迪色系渐变
    const gradients = [
      'linear-gradient(135deg, #6366f1, #4f46e5)', // 蓝紫
      'linear-gradient(135deg, #10b981, #059669)', // 翠绿
      'linear-gradient(135deg, #f59e0b, #d97706)', // 暖金
      'linear-gradient(135deg, #ec4899, #db2777)', // 柔粉
      'linear-gradient(135deg, #06b6d4, #0891b2)'  // 青碧
    ];

    return (
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        background: gradients[colorHash],
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '0.9rem',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        flexShrink: 0,
        letterSpacing: '0.02em'
      }}>
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
          <span key={`ellipsis-${idx}`} style={{ 
            padding: '0 8px', 
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            userSelect: 'none'
          }}>
            ...
          </span>
        );
      }
      
      const isSelected = p === currentPage;
      return (
        <button
          key={`page-${p}`}
          onClick={() => setCurrentPage(p)}
          style={{
            background: isSelected ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.04)',
            border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
            color: isSelected ? '#ffffff' : 'var(--text-primary)',
            borderRadius: '6px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: isSelected ? 700 : 500,
            fontSize: '0.8rem',
            transition: 'all 0.2s',
            boxShadow: isSelected ? '0 2px 6px var(--accent-glow)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
              e.currentTarget.style.borderColor = 'var(--border-color-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }
          }}
        >
          {p}
        </button>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. 大厂风范精细统计仪表盘 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px'
      }}>
        {/* 卡片 1：累计互传 */}
        <Card style={{ 
          padding: '20px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>累计物理互传</span>
            <History size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {totalCount}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>次</span>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: '10px', 
            marginTop: '4px' 
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              成功: <strong style={{ color: 'var(--success-color)', fontWeight: 600 }}>{successCount}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              异常/拒绝: <strong style={{ color: 'var(--error-color)', fontWeight: 600 }}>{failCount}</strong>
            </span>
          </div>
        </Card>

        {/* 卡片 2：物理收发结构 */}
        <Card style={{ 
          padding: '20px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>网络物理流向</span>
            <ArrowRightLeft size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '-0.02em' }}>{sendCount}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>发</span>
            </div>
            <span style={{ color: 'var(--border-color)', fontSize: '1.2rem', fontWeight: 300 }}>/</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', letterSpacing: '-0.02em' }}>{receiveCount}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>收</span>
            </div>
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: '10px', 
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Sparkles size={12} style={{ color: 'var(--accent-color)' }} />
            <span>点对等极速高频互传信道已连接</span>
          </div>
        </Card>

        {/* 卡片 3：信道质量健康度 */}
        <Card style={{ 
          padding: '20px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>物理传输信道质量</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: successRate >= 90 ? 'var(--success-color)' : 'var(--warning-color)',
              boxShadow: `0 0 8px ${successRate >= 90 ? 'var(--success-color)' : 'var(--warning-color)'}`
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              color: successRate >= 90 ? 'var(--success-color)' : successRate >= 70 ? 'var(--warning-color)' : 'var(--error-color)',
              letterSpacing: '-0.02em' 
            }}>{successRate}%</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>传输成功率</span>
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: '10px', 
            marginTop: '4px' 
          }}>
            <span>信道评级: <strong style={{ color: successRate >= 90 ? 'var(--success-color)' : 'var(--warning-color)' }}>
              {successRate >= 90 ? '极佳 (Excellent)' : '良好 (Fair)'}
            </strong></span>
          </div>
        </Card>
      </div>

      {/* 2. 极简精致搜索与多维过滤工具栏 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px'
      }}>
        {/* 左侧：搜索与 Tab 过滤器 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
          
          {/* 大厂极简搜索框 */}
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索文件名 / 对等伙伴..."
              style={{
                width: '100%',
                background: 'var(--bg-item)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '8px 12px 8px 34px',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-color)';
                e.target.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                e.target.style.background = 'var(--bg-sidebar)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'var(--bg-item)';
              }}
            />
            <Search size={14} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
          </div>

          {/* 分类药丸 Tab */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.03)',
            borderRadius: '6px',
            padding: '2px',
            border: '1px solid var(--border-color)'
          }}>
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
                  style={{
                    border: 'none',
                    background: isActive ? 'var(--bg-app)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：一键清空机制 */}
        {onClearHistory && historyTasks.length > 0 && (
          <div style={{ position: 'relative' }}>
            {showClearConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  物理抹除全部？
                </span>
                <button
                  onClick={() => {
                    onClearHistory();
                    setShowClearConfirm(false);
                  }}
                  style={{
                    background: 'var(--error-color)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  确认
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    background: 'rgba(128, 128, 128, 0.08)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--error-color)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Trash2 size={13} />
                清空物理记录
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 物理互传记录陈列大列表 */}
      <Card style={{ 
        padding: '24px', 
        background: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-md)' 
      }}>
        <h3 style={{ 
          fontSize: '0.92rem', 
          fontWeight: 700, 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '14px', 
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>局域网对等体互传历史归档</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            已过滤出 {filteredTasks.length} 项记录
          </span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center', opacity: 0.7 }}>
              <History size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto', opacity: 0.5 }} />
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
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
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(0, 0, 0, 0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    transition: 'all 0.2s ease-in-out',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="history-row"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.03)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    // 渐显右侧删除按钮
                    const delBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                    if (delBtn) delBtn.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'none';
                    // 隐去右侧删除按钮
                    const delBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                    if (delBtn) delBtn.style.opacity = '0';
                  }}
                >
                  {/* 对等互传核心：左中右大厂双翼布局 */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    {/* 左侧：发送端 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '170px', flex: 1 }}>
                      {renderAvatar(senderName, task.senderAvatar)}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{senderName}</span>
                          <span className={sOs.className} style={{
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {sOs.icon}
                            {sOs.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>IP: {senderIp}</span>
                      </div>
                    </div>

                    {/* 中间：SVG 高科技管道流动线 */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '4px',
                      flex: 2,
                      minWidth: '150px',
                      position: 'relative'
                    }}>
                      {/* SVG 精细虚线流动管道 */}
                      <svg width="100%" height="8" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
                        <path 
                          d="M0 4H200" 
                          stroke={isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'} 
                          strokeWidth="1.5" 
                          strokeDasharray="6 4"
                          style={{
                            opacity: 0.6,
                            animation: 'dash 15s linear infinite'
                          }}
                        />
                        {/* 状态波纹 */}
                        <circle cx={isCompleted ? "180" : "100"} cy="4" r="2.5" fill={isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'} style={{
                          animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                        }} />
                      </svg>

                      {/* 中间药丸徽章 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: isCompleted ? 'var(--success-glow)' : isRejected ? 'rgba(245, 158, 11, 0.08)' : 'var(--error-glow)',
                        border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.2)' : isRejected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        color: isCompleted ? 'var(--success-color)' : isRejected ? 'var(--warning-color)' : 'var(--error-color)'
                      }}>
                        {isCompleted ? (
                          <>
                            <CheckCircle2 size={10} />
                            <span>物理下载落地</span>
                          </>
                        ) : isRejected ? (
                          <>
                            <Ban size={10} />
                            <span>接收端拒绝</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={10} />
                            <span>信道中断/异常</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 右侧：接收端 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '170px', flex: 1, justifyContent: 'flex-end', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={rOs.className} style={{
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {rOs.icon}
                            {rOs.label}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{receiverName}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>IP: {receiverIp}</span>
                      </div>
                      {renderAvatar(receiverName, task.receiverAvatar)}
                    </div>
                  </div>

                  {/* 物理分隔极细实线 */}
                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '2px 0' }} />

                  {/* 底部：文件描述元数据与具体时间戳，附带物理抹除动作 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.fileName}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({formatBytesLocal(task.fileSize)})</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {formatDateTime(task.startedAt)}
                      </div>

                      {/* 物理单条抹除按钮 */}
                      {onDeleteTask && (
                        <button
                          className="delete-btn"
                          onClick={() => onDeleteTask(task.id)}
                          title="从本地数据库中彻底抹除此记录"
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
                            opacity: 0, // 默认不显示，仅在 row hover 时渐显
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            e.currentTarget.style.color = 'var(--error-color)';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. 精美分页导航组件 */}
        {filteredTasks.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* 左侧：分页状态 */}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              显示第 <strong style={{ color: 'var(--text-primary)' }}>{startIndex + 1}</strong> 至 <strong style={{ color: 'var(--text-primary)' }}>{Math.min(startIndex + ITEMS_PER_PAGE, filteredTasks.length)}</strong> 项，共 <strong style={{ color: 'var(--text-primary)' }}>{filteredTasks.length}</strong> 项记录
            </span>

            {/* 右侧：页码及前/后页按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  background: 'rgba(128, 128, 128, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                    e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
              >
                <ChevronLeft size={16} />
              </button>

              {/* 渲染数字页码 */}
              {renderPageNumbers()}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  background: 'rgba(128, 128, 128, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                    e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== totalPages) {
                    e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

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
