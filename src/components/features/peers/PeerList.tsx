import React, { useState } from 'react';
import { Peer } from '@/types/peer';
import Card from '../../ui/Card';
import { Monitor, Smartphone, Laptop, ShieldAlert } from 'lucide-react';

interface PeerListProps {
  peers: Peer[];
  onSendFile: (peer: Peer, file: File) => void;
}

export const PeerList: React.FC<PeerListProps> = ({ peers, onSendFile }) => {
  // 维护每台设备的拖拽状态
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);

  // 辅助函数：根据头像代号渲染对应的几何科技感图标
  const renderAvatarIcon = (avatar: string, size = 20) => {
    switch (avatar) {
      case 'avatar-1':
        return <Laptop size={size} className="text-blue-400" style={{ color: '#60a5fa' }} />;
      case 'avatar-2':
        return <Monitor size={size} className="text-purple-400" style={{ color: '#c084fc' }} />;
      case 'avatar-3':
        return <Smartphone size={size} className="text-emerald-400" style={{ color: '#34d399' }} />;
      default:
        return <Laptop size={size} className="text-zinc-400" style={{ color: '#a1a1aa' }} />;
    }
  };

  const handleDragOver = (e: React.DragEvent, peerId: string) => {
    e.preventDefault();
    setDragOverPeerId(peerId);
  };

  const handleDragLeave = () => {
    setDragOverPeerId(null);
  };

  const handleDrop = (e: React.DragEvent, peer: Peer) => {
    e.preventDefault();
    setDragOverPeerId(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log(`[Drop] 检测到文件释放: ${file.name} 扔给了 ${peer.nickname}`);
      onSendFile(peer, file);
    }
  };

  return (
    <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
      {/* 头部标题与雷达指示灯 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>在线设备</h2>
          <span style={{ 
            fontSize: '0.75rem', 
            background: 'rgba(59, 130, 246, 0.1)', 
            color: 'var(--accent-color)', 
            padding: '2px 8px', 
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: 'var(--accent-color)',
              boxShadow: '0 0 8px var(--accent-color)',
              animation: 'sonar-pulse 2s infinite'
            }} />
            mDNS 组播发现中
          </span>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          在线: {peers.length} 台
        </span>
      </div>

      {/* 设备列表渲染 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        overflowY: 'auto',
        maxHeight: '450px',
        paddingRight: '4px'
      }}>
        {peers.length === 0 ? (
          // 精美空状态雷达波纹动效
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '24px',
            opacity: 0.85,
            padding: '40px 0'
          }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* 雷达扫描圈 */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1px solid rgba(59, 130, 246, 0.1)',
                animation: 'radar-beam 3s linear infinite'
              }} />
              <div style={{
                position: 'absolute',
                width: '70%',
                height: '70%',
                borderRadius: '50%',
                border: '1px dashed rgba(59, 130, 246, 0.15)',
              }} />
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                <Laptop size={18} style={{ color: 'var(--accent-color)' }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>正在寻道中...</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '220px', lineHeight: 1.4 }}>
                确保其他电脑或手机连接到了同一个 Wi-Fi 或局域网，并打开了此页面。
              </p>
            </div>
          </div>
        ) : (
          peers.map(peer => {
            const isDragOver = dragOverPeerId === peer.id;
            return (
              <div
                key={peer.id}
                onDragOver={(e) => handleDragOver(e, peer.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, peer)}
                className="peer-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  transform: isDragOver ? 'scale(1.02)' : 'translateY(0)',
                  boxShadow: isDragOver ? 'var(--shadow-glow)' : 'none',
                  border: isDragOver ? '1px dashed var(--accent-color)' : '1px solid var(--border-color)'
                }}
              >
                {/* 左侧头像与基本信息 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'var(--bg-app)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)',
                    position: 'relative'
                  }}>
                    {renderAvatarIcon(peer.avatar)}
                    {/* 在线指示灯 */}
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--success-color)',
                      border: '2px solid var(--bg-card)'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{peer.nickname}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {peer.ip}
                    </span>
                  </div>
                </div>

                {/* 右侧拖拽操作提示 */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: isDragOver ? 'var(--accent-color)' : 'var(--text-muted)',
                    fontWeight: isDragOver ? 600 : 400,
                    transition: 'color 0.2s'
                  }}>
                    {isDragOver ? '松开以极速发送' : '拖拽文件至此互传'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 雷达心跳脉冲与旋转扫射动画定义 */}
      <style jsx global>{`
        .peer-card {
          background: var(--bg-item);
        }
        .peer-card:hover {
          background: var(--bg-item-hover) !important;
          border-color: var(--border-color-hover) !important;
          transform: translateY(-2px) !important;
          box-shadow: var(--shadow-md) !important;
        }
        @keyframes sonar-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        @keyframes radar-beam {
          0% {
            transform: rotate(0deg);
            border-color: rgba(59, 130, 246, 0.2) transparent transparent transparent;
          }
          100% {
            transform: rotate(360deg);
            border-color: rgba(59, 130, 246, 0.2) transparent transparent transparent;
          }
        }
      `}</style>
    </Card>
  );
};
export default PeerList;
