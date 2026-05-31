'use client';

import React, { useState, useEffect } from 'react';
import { TransferTask } from '@/types/transfer';
import TransferHistory from './TransferHistory';
import Card from '@/components/ui/LegacyCard';
import { 
  Search, Trash2, Laptop, Monitor, Smartphone, 
  History, FolderOpen, FileText, RefreshCw, 
  AlertCircle, ExternalLink, User, Clock
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
    setCurrentPage(1);
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
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(128, 128, 128, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>{avatarEmoji}</span>
        </div>
      );
    }

    const initial = name.trim().charAt(0).toUpperCase() || 'P';
    const colorHash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5;
    const gradients = [
      'linear-gradient(135deg, #6366f1, #4f46e5)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #db2777)',
      'linear-gradient(135deg, #06b6d4, #0891b2)'
    ];

    return (
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: gradients[colorHash],
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '0.85rem',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
        flexShrink: 0
      }}>
        {initial}
      </div>
    );
  };

  // 设备标签渲染
  const renderDeviceBadge = (deviceText?: string) => {
    if (!deviceText) return null;
    const lower = deviceText.toLowerCase();
    
    let label = deviceText;
    let className = 'device-badge general';
    let icon = <Laptop size={11} />;

    if (lower.includes('win')) {
      label = 'Windows';
      className = 'device-badge windows';
      icon = <Monitor size={11} />;
    } else if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple')) {
      label = 'macOS';
      className = 'device-badge macos';
      icon = <Laptop size={11} />;
    } else if (lower.includes('android')) {
      label = 'Android';
      className = 'device-badge android';
      icon = <Smartphone size={11} />;
    }

    return (
      <span className={className} style={{
        fontSize: '0.62rem',
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
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

  // 日志列表分页逻辑
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // 渲染分页按钮
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginTop: '20px'
      }}>
        {Array.from({ length: totalPages }).map((_, idx) => {
          const p = idx + 1;
          const isSelected = p === currentPage;
          return (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              style={{
                background: isSelected ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.04)',
                border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.78rem',
                transition: 'all 0.2s'
              }}
            >
              {p}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
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
        // 共享记录 & 云文档记录：渲染大厂高科技集中列表面板 (无重复 Header Tabs)
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 高级极简搜索及清空工具条 */}
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
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={subTab === 'share' ? "搜索共享文件名 / 上传者..." : "搜索云文档名称 / 新建者..."}
                style={{
                  width: '100%',
                  background: 'var(--bg-item)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 12px 8px 34px',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-color)';
                  e.target.style.boxShadow = '0 0 0 2px var(--accent-glow)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
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

            {/* 清空按钮逻辑 */}
            {filteredLogs.length > 0 && (
              <div style={{ position: 'relative' }}>
                {showClearConfirm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />
                      清空此类全部记录？
                    </span>
                    <button
                      onClick={handleClearLogs}
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
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <Trash2 size={13} />
                    清空此类记录
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 列表陈列容器 */}
          <Card style={{ padding: '24px' }}>
            <h3 style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px',
              color: 'var(--text-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                {subTab === 'share' ? '公共共享空间文件投递日志' : '局域网去中心协作审计日志'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                {isLoading ? '加载日志中...' : `已过滤出 ${filteredLogs.length} 条记录`}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {isLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <RefreshCw size={24} style={{ color: 'var(--text-muted)', animation: 'spin 1.2s linear infinite', margin: '0 auto 12px auto' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>正在同步局域网日志数据库...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', opacity: 0.7 }}>
                  <AlertCircle size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
                      style={{
                        padding: '12px 18px',
                        background: 'rgba(0, 0, 0, 0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        transition: 'all 0.2s ease',
                        cursor: (subTab === 'document' && docId) ? 'pointer' : 'default',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                        e.currentTarget.style.background = 'rgba(128, 128, 128, 0.02)';
                        if (subTab === 'document' && docId) {
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.01)';
                        if (subTab === 'document' && docId) {
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      {/* 左侧：详细信息 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        {renderAvatar(log.operator, log.avatar)}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.title}
                            </span>
                            {/* 仅在共享文件上传显示文件大小 */}
                            {log.type === 'share' && log.details?.fileSize && (
                              <span style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                background: 'rgba(128, 128, 128, 0.06)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 500
                              }}>
                                {formatBytes(log.details.fileSize)}
                              </span>
                            )}
                          </div>
                          
                          {/* 底部副元信息 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                              <User size={11} style={{ opacity: 0.6 }} />
                              操作人: {log.operator}
                            </span>
                            <span>•</span>
                            {renderDeviceBadge(log.details?.deviceInfo)}
                            {log.type === 'document' && (
                              <span style={{
                                fontSize: '0.62rem',
                                background: isFolder ? 'rgba(234, 179, 8, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                color: isFolder ? '#EAB308' : 'var(--accent-color)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                {isFolder ? '文件夹' : '富文本文档'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 右侧：操作时间戳及高能跳转提示 */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '4px',
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} style={{ opacity: 0.6 }} />
                          {formatDateTime(log.timestamp)}
                        </span>
                        
                        {subTab === 'document' && docId && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: 'var(--accent-color)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            opacity: 0.8
                          }}>
                            立即前往
                            <ExternalLink size={10} />
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* 分页控制 */}
            {renderPagination()}
          </Card>
        </div>
      )}

    </div>
  );
}
