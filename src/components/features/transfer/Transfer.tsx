import React from 'react';
import { TransferTask } from '@/types/transfer';
import { IncomingRequest } from '@/hooks/useFileTransfer';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { formatBytes, formatSpeed, formatTime } from '@/lib/format';
import { Download, Upload, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface TransferProps {
  tasks: Record<string, TransferTask>;
  incomingRequest: IncomingRequest | null;
  onAccept: () => void;
  onReject: () => void;
}

export const Transfer: React.FC<TransferProps> = ({ 
  tasks, 
  incomingRequest, 
  onAccept, 
  onReject 
}) => {
  const taskList = Object.values(tasks).sort((a, b) => b.startedAt - a.startedAt);

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

  return (
    <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>文件传输中心</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          已载入任务: {taskList.length} 个
        </span>
      </div>

      {/* 传输卡片列表 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        overflowY: 'auto',
        maxHeight: '400px',
        paddingRight: '4px'
      }}>
        {taskList.length === 0 ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px 0',
            opacity: 0.5 
          }}>
            <Download size={28} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '0.85rem', marginTop: '12px' }}>当前没有任何传输任务</p>
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
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.015)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* 任务元数据栏 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '75%' }}>
                    {renderStatusBadge(task)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {task.fileName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        大小: {formatBytes(task.fileSize)} | {task.type === 'send' ? `发给 ${task.peerName}` : `来自 ${task.peerName}`}
                      </span>
                    </div>
                  </div>
                  
                  {/* 速度与ETA */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      color: isCompleted ? 'var(--success-color)' : 'var(--text-primary)' 
                    }}>
                      {isCompleted ? '已完成' : isFailed ? '失败' : isPending ? '待接收' : formatSpeed(task.speed)}
                    </span>
                    {!isCompleted && !isFailed && !isPending && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        <Clock size={10} />
                        剩余: {getETA(task)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 极窄科技发光进度条 */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '4px', 
                    background: 'rgba(255, 255, 255, 0.05)', 
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{task.progress}%</span>
                    <span>{formatBytes(task.transferredBytes)} / {formatBytes(task.fileSize)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 接收大文件弹窗 (Dialog) - Frosted Glass 遮罩询问器 */}
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
          zIndex: 9999,
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
              <span style={{ fontSize: '0.95rem', fontWeight: 600, wordBreak: 'break-all' }}>
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
    </Card>
  );
};
export default Transfer;
