import React from 'react';
import { TransferTask } from '@/types/transfer';
import { IncomingRequest } from '@/hooks/useFileTransfer';
import Button from '../../ui/LegacyButton';
import Card from '../../ui/LegacyCard';
import { formatBytes, formatSpeed, formatTime } from '@/lib/format';
import { Download, Upload, Clock, CheckCircle2, XCircle, AlertCircle, X, HelpCircle } from 'lucide-react';

interface TransferProps {
  tasks: Record<string, TransferTask>;
  incomingRequest: IncomingRequest | null;
  onAccept: () => void;
  onReject: () => void;
  onCancel: (taskId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Transfer: React.FC<TransferProps> = ({ 
  tasks, 
  incomingRequest, 
  onAccept, 
  onReject,
  onCancel,
  isOpen,
  onClose
}) => {
  const taskList = Object.values(tasks)
    .filter(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'paused')
    .sort((a, b) => b.startedAt - a.startedAt);

  // 辅助函数：渲染任务状态图标
  const renderStatusBadge = (task: TransferTask) => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 size={16} style={{ color: 'var(--success-color)' }} />;
      case 'failed':
        return <XCircle size={16} style={{ color: 'var(--error-color)' }} />;
      case 'paused':
        return <AlertCircle size={16} style={{ color: 'var(--warning-color)' }} />;
      default:
        return task.type === 'send' ? 
          <Upload size={16} className="animate-bounce" style={{ color: 'var(--accent-color)' }} /> : 
          <Download size={16} className="animate-bounce" style={{ color: 'var(--accent-color)' }} />;
    }
  };

  // 辅助计算剩余估算时间 (ETA)
  const getETA = (task: TransferTask) => {
    if (task.status !== 'transferring' || task.speed === 0) return '估算中...';
    const remainingBytes = task.fileSize - task.transferredBytes;
    const remainingSeconds = remainingBytes / task.speed;
    return formatTime(remainingSeconds);
  };

  // 抽屉容器样式
  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '420px',
    height: '100vh',
    background: 'var(--bg-sidebar)',
    borderLeft: '1px solid var(--border-color)',
    boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.45)',
    zIndex: 9999,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };

  // 背景遮罩 Overlay 样式
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 9998,
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? 'auto' : 'none',
    transition: 'opacity 0.3s ease'
  };

  return (
    <>
      {/* 侧边滑动背景遮罩 */}
      <div style={overlayStyle} onClick={onClose} />

      {/* 悬浮传输中心抽屉容器 */}
      <div style={drawerStyle}>
        
        {/* 顶部头部栏 */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>文件传输中心</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              已载入任务: {taskList.length} 个
            </span>
          </div>
          
          <button
            onClick={onClose}
            title="关闭面板"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(128, 128, 128, 0.05)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'rgba(128, 128, 128, 0.1)';
              e.currentTarget.style.borderColor = 'var(--border-color-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'rgba(128, 128, 128, 0.05)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 科技感新手引导看板 */}
        <div style={{
          background: 'var(--accent-glow)',
          border: '1px solid rgba(37, 99, 235, 0.15)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start'
        }}>
          <HelpCircle size={16} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>什么是传输中心？</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              实时展示您在局域网中发送和接收的文件进度。您可以随时通过右上角“传输任务”按钮展开此抽屉，查看任务的速度与剩余时间。
            </span>
          </div>
        </div>

        {/* 传输卡片列表滚动区 */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {taskList.length === 0 ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 0',
              opacity: 0.5 
            }}>
              <Download size={28} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '0.8rem', marginTop: '12px', color: 'var(--text-secondary)' }}>当前没有任何传输任务</p>
            </div>
          ) : (
            taskList.map(task => {
              const isCompleted = task.status === 'completed';
              const isFailed = task.status === 'failed';
              const isPending = task.status === 'pending';
              
              return (
                <div
                  key={task.id}
                  style={{
                    padding: '14px',
                    background: 'rgba(128, 128, 128, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-color-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  {/* 任务元数据栏 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '75%' }}>
                      {renderStatusBadge(task)}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'var(--text-primary)'
                        }} title={task.fileName}>
                          {task.fileName}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          大小: {formatBytes(task.fileSize)} | {task.type === 'send' ? `发给 ${task.peerName}` : `来自 ${task.peerName}`}
                        </span>
                      </div>
                    </div>
                    
                    {/* 速度与ETA */}
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      <span style={{ 
                        fontSize: '0.8rem', 
                        fontWeight: 600, 
                        color: isCompleted ? 'var(--success-color)' : isFailed ? 'var(--error-color)' : 'var(--text-primary)' 
                      }}>
                        {isCompleted ? '已完成' : isFailed ? '失败' : isPending ? '待接收' : formatSpeed(task.speed)}
                      </span>
                      {!isCompleted && !isFailed && !isPending && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          <Clock size={10} />
                          剩余: {getETA(task)}
                        </span>
                      )}
                      
                      {/* 🌟 物理取消按钮 */}
                      {!isCompleted && !isFailed && (
                        <button
                          onClick={() => onCancel(task.id)}
                          title="取消本次传输"
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--error-color)',
                            background: 'rgba(239, 68, 68, 0.04)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            marginTop: '2px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
                          }}
                        >
                          <X size={10} />
                          <span>取消</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 极窄科技发光进度条 */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '4px', 
                      background: 'rgba(128, 128, 128, 0.08)', 
                      borderRadius: '2px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: `${task.progress}%`,
                        height: '100%',
                        background: isCompleted ? 'var(--success-color)' : isFailed ? 'var(--error-color)' : 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
                        borderRadius: '2px',
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isCompleted ? '0 0 6px var(--success-color)' : isFailed ? 'none' : '0 0 6px var(--accent-color)'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span>{task.progress}%</span>
                      <span>{formatBytes(task.transferredBytes)} / {formatBytes(task.fileSize)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 接收大文件弹窗 (Dialog) - Frosted Glass 遮罩询问器 (独立于抽屉全局弹出) */}
      {incomingRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fade-in 0.2s ease-out'
        }}>
          <Card style={{ 
            width: '90%', 
            maxWidth: '440px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                margin: '0 auto 12px auto'
              }}>
                <Download size={22} style={{ color: 'var(--accent-color)' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>收到文件互传请求</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                局域网内的 <strong style={{ color: 'var(--accent-color)' }}>{incomingRequest.senderName}</strong> 想要投递给您一个大文件：
              </p>
            </div>

            {/* 文件细节 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                {incomingRequest.fileName}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                文件大小: {formatBytes(incomingRequest.fileSize)}
              </span>
            </div>

            {/* 控制按钮 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
                拒绝
              </Button>
              <Button variant="primary" onClick={onAccept} style={{ flex: 1 }}>
                接收并极速下载
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 动画定义 */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};

export default Transfer;
