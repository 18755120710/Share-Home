import React, { useState, useRef } from 'react';
import { Peer } from '@/types/peer';
import Card from '../../ui/Card';
import { Monitor, Smartphone, Laptop, Radio, Send, RefreshCw, Layers } from 'lucide-react';

interface PeerListProps {
  peers: Peer[];
  self: Peer | null; // 新增本端属性以支持显示当前设备
  onSendFile: (peer: Peer, file: File) => void;
}

export const PeerList: React.FC<PeerListProps> = ({ peers, self, onSendFile }) => {
  // 维护每台设备的拖拽状态
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);
  // 当前鼠标 hover 悬浮在雷达上的 peer ID，用来显示 Tooltip 悬浮卡片
  const [hoveredPeerId, setHoveredPeerId] = useState<string | null>(null);
  
  // 用于点击雷达节点直接选择文件发送
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSelectPeer, setActiveSelectPeer] = useState<Peer | null>(null);

  // 辅助函数：根据头像代号渲染对应的几何科技感图标
  const renderAvatarIcon = (avatar: string, size = 18) => {
    switch (avatar) {
      case 'avatar-1':
        return <Laptop size={size} />;
      case 'avatar-2':
        return <Monitor size={size} />;
      case 'avatar-3':
        return <Smartphone size={size} />;
      default:
        return <Laptop size={size} />;
    }
  };

  // 辅助函数：标准化并获取系统类型文本
  const getOSName = (os?: string) => {
    if (!os) return 'Unknown';
    const lower = os.toLowerCase();
    if (lower.includes('win')) return 'Windows';
    if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple') || lower.includes('os x') || lower.includes('darwin')) return 'macOS';
    if (lower.includes('android')) return 'Android';
    if (lower.includes('linux')) return 'Linux';
    return os;
  };

  // 辅助函数：渲染极具质感的操作系统微型胶囊 Badge
  const renderOSBadge = (os?: string) => {
    const osType = getOSName(os);
    let bg = 'rgba(128, 128, 128, 0.08)';
    let color = 'var(--text-secondary)';
    let border = '1px solid var(--border-color)';
    
    if (osType === 'Windows') {
      bg = 'rgba(14, 165, 233, 0.08)';
      color = '#0ea5e9';
      border = '1px solid rgba(14, 165, 233, 0.2)';
    } else if (osType === 'macOS') {
      bg = 'rgba(236, 72, 153, 0.08)';
      color = '#ec4899';
      border = '1px solid rgba(236, 72, 153, 0.2)';
    } else if (osType === 'Android') {
      bg = 'rgba(34, 197, 94, 0.08)';
      color = '#22c55e';
      border = '1px solid rgba(34, 197, 94, 0.2)';
    } else if (osType === 'Linux') {
      bg = 'rgba(249, 115, 22, 0.08)';
      color = '#f97316';
      border = '1px solid rgba(249, 115, 22, 0.2)';
    }
    
    return (
      <span style={{
        fontSize: '0.62rem',
        padding: '2px 6px',
        borderRadius: '4px',
        background: bg,
        color: color,
        border: border,
        fontWeight: 600,
        letterSpacing: '0.02em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        lineHeight: 1
      }}>
        {osType}
      </span>
    );
  };

  const handleDragOver = (e: React.DragEvent, peerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeerId(peerId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPeerId(null);
  };

  const handleDrop = (e: React.DragEvent, peer: Peer) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPeerId(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log(`[Radar Drop] 精准捕获拖拽文件: ${file.name} -> ${peer.nickname}`);
      onSendFile(peer, file);
    }
  };

  // 点击雷达节点，拉起文件选择器
  const handlePeerClick = (peer: Peer) => {
    setActiveSelectPeer(peer);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && activeSelectPeer) {
      const file = e.target.files[0];
      console.log(`[Radar Click] 选中本地文件投递: ${file.name} -> ${activeSelectPeer.nickname}`);
      onSendFile(activeSelectPeer, file);
      e.target.value = ''; // 释放选择器
    }
  };

  // 极坐标一致性哈希分布算法：保证相同 IP/ID 的设备在雷达图上的物理定位稳固，防止抖动跳闪
  const getPeerCoordinates = (peer: Peer) => {
    let hash = 0;
    const key = peer.id + peer.ip;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // 映射出 0 - 360 度的角度
    const angle = Math.abs(hash % 360);
    // 映射出 38% - 82% 之间的同心圆半径，防止节点重叠，且完美留在雷达盘内
    const radius = 38 + (Math.abs(hash >> 8) % 44);
    
    // 转换为直角坐标系中的百分比位置 (以 50%, 50% 作为中心原点)
    const rad = (angle * Math.PI) / 180;
    const left = 50 + radius * Math.cos(rad);
    const top = 50 + radius * Math.sin(rad);
    
    return { 
      left: `${left}%`, 
      top: `${top}%`, 
      angle, 
      radius 
    };
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '620px', padding: '24px', overflow: 'hidden' }}>
      
      {/* 隐藏的文件输入框，支持点击设备即可选文件发送 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* 头部标题与雷达指示灯 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-color)' }} />
            超视距雷达协作台
          </h2>
          <span style={{ 
            fontSize: '0.7rem', 
            background: 'rgba(202, 138, 4, 0.08)', 
            color: 'var(--accent-color)', 
            padding: '3px 10px', 
            borderRadius: '20px',
            border: '1px solid rgba(202, 138, 4, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600
          }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: 'var(--accent-color)',
              boxShadow: '0 0 10px var(--accent-color)',
              animation: 'sonar-pulse-accent 2s infinite'
            }} />
            智能组播与虚拟多播自发现
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            局域网在线: <strong style={{ color: 'var(--accent-color)', fontSize: '1rem' }}>{peers.length + (self ? 1 : 0)}</strong> 台
          </span>
        </div>
      </div>

      {/* 双栏布局容器 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '28px', flexWrap: 'wrap' }}>
        
        {/* 左侧：3D/2D 动效雷达扫描视窗 */}
        <div style={{ 
          flex: '1.2', 
          minWidth: '320px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'rgba(0, 0, 0, 0.12)', 
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '24px',
          position: 'relative',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.15)',
          minHeight: '380px'
        }}>
          {/* 雷达大圆盘容器 */}
          <div style={{ 
            width: '320px', 
            height: '320px', 
            borderRadius: '50%', 
            position: 'relative', 
            background: 'radial-gradient(circle, rgba(20, 20, 30, 0.4) 0%, rgba(10, 10, 15, 0.8) 100%)',
            border: '2px solid rgba(202, 138, 4, 0.25)',
            boxShadow: '0 0 35px rgba(202, 138, 4, 0.08)',
            overflow: 'hidden'
          }}>
            {/* 雷达科技背景网格线及十字轴 */}
            <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, pointerEvents: 'none' }}>
              {/* 同心圆 */}
              <circle cx="50%" cy="50%" r="20%" fill="none" stroke="rgba(202, 138, 4, 0.12)" strokeWidth="1" />
              <circle cx="50%" cy="50%" r="40%" fill="none" stroke="rgba(202, 138, 4, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="50%" cy="50%" r="60%" fill="none" stroke="rgba(202, 138, 4, 0.12)" strokeWidth="1" />
              <circle cx="50%" cy="50%" r="80%" fill="none" stroke="rgba(202, 138, 4, 0.18)" strokeWidth="1.5" strokeDasharray="5 5" />
              
              {/* 十字网格轴线 */}
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(202, 138, 4, 0.15)" strokeWidth="1" />
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(202, 138, 4, 0.15)" strokeWidth="1" />
              
              {/* 斜向虚线网格轴线 */}
              <line x1="15%" y1="15%" x2="85%" y2="85%" stroke="rgba(202, 138, 4, 0.08)" strokeWidth="1" strokeDasharray="2 4" />
              <line x1="85%" y1="15%" x2="15%" y2="85%" stroke="rgba(202, 138, 4, 0.08)" strokeWidth="1" strokeDasharray="2 4" />
            </svg>

            {/* 360°旋转扫描扇形射线层 */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              top: 0,
              left: 0,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, rgba(202, 138, 4, 0.18) 0deg, rgba(202, 138, 4, 0.03) 90deg, transparent 180deg, transparent 360deg)',
              animation: 'radar-sweep-animation 4s linear infinite',
              transformOrigin: '50% 50%',
              pointerEvents: 'none'
            }} />

            {/* 雷达中心点：本端发射基站 (代表“我”本机) */}
            <div 
              onMouseEnter={() => self && setHoveredPeerId('self_node')}
              onMouseLeave={() => setHoveredPeerId(null)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(202, 138, 4, 0.25)',
                border: '2.5px solid var(--accent-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px var(--accent-color)',
                zIndex: 15,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <Radio size={16} style={{ color: '#ffffff' }} className="animate-pulse" />
              {/* 核心向外扩散脉冲圈圈 */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1px solid var(--accent-color)',
                animation: 'radar-pulse-out 2.5s cubic-bezier(0.1, 0.8, 0.3, 1) infinite',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1px solid var(--accent-color)',
                animation: 'radar-pulse-out 2.5s cubic-bezier(0.1, 0.8, 0.3, 1) infinite',
                animationDelay: '1.25s',
                pointerEvents: 'none'
              }} />
            </div>

            {/* 本机 HUD 悬浮提示面板 */}
            {self && (hoveredPeerId === 'self_node') && (
              <div style={{
                position: 'absolute',
                top: '58%',
                left: '50%',
                transform: 'translateX(-50%) translateY(0)',
                background: 'rgba(15, 15, 25, 0.95)',
                border: '1px solid var(--accent-color)',
                padding: '10px 14px',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: 'center',
                zIndex: 100
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                  本机当前终端 (发射源)
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                  {self.nickname}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
                  {self.ip}
                </span>
                <div style={{ marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {renderOSBadge(self.os)}
                </div>
              </div>
            )}

            {/* 设备节点渲染区 */}
            {peers.length === 0 ? (
              // 空状态：雷达中显示寻找波纹提示
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <span style={{ 
                  color: 'rgba(202, 138, 4, 0.5)', 
                  fontSize: '0.78rem', 
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono)',
                  animation: 'radar-blink 2s ease-in-out infinite',
                  marginTop: '100px'
                }}>
                  SCANNING FOR HOSTS...
                </span>
              </div>
            ) : (
              peers.map((peer) => {
                const { left, top } = getPeerCoordinates(peer);
                const isDragOver = dragOverPeerId === peer.id;
                const isHovered = hoveredPeerId === peer.id;
                
                return (
                  <div
                    key={peer.id}
                    onDragOver={(e) => handleDragOver(e, peer.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, peer)}
                    onMouseEnter={() => setHoveredPeerId(peer.id)}
                    onMouseLeave={() => setHoveredPeerId(null)}
                    onClick={() => handlePeerClick(peer)}
                    style={{
                      position: 'absolute',
                      left,
                      top,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isHovered || isDragOver ? 10 : 3,
                      cursor: 'pointer',
                      transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                  >
                    {/* 节点外发光呼吸及拖拽高亮圈 */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isDragOver 
                        ? 'rgba(202, 138, 4, 0.35)' 
                        : isHovered 
                          ? 'rgba(202, 138, 4, 0.25)' 
                          : 'rgba(202, 138, 4, 0.1)',
                      border: isDragOver 
                        ? '2px dashed var(--accent-color)' 
                        : isHovered 
                          ? '2px solid var(--accent-color)' 
                          : '1px solid rgba(202, 138, 4, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isHovered || isDragOver 
                        ? '0 0 18px var(--accent-color)' 
                        : '0 0 8px rgba(202, 138, 4, 0.2)',
                      transform: isHovered || isDragOver ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.25s ease',
                      position: 'relative'
                    }}>
                      {/* 设备分类实体图标 */}
                      <span style={{ 
                        color: isHovered || isDragOver ? '#ffffff' : 'var(--accent-color)',
                        transition: 'color 0.2s' 
                      }}>
                        {renderAvatarIcon(peer.avatar, 18)}
                      </span>

                      {/* 在线微标灯 */}
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: 'var(--success-color)',
                        boxShadow: '0 0 6px var(--success-color)'
                      }} />
                    </div>

                    {/* HUD 弹出面板：仅在 Hover 或 拖拽悬停时精致呈现 */}
                    <div style={{
                      position: 'absolute',
                      top: '48px',
                      left: '50%',
                      transform: isHovered || isDragOver 
                        ? 'translateX(-50%) translateY(0)' 
                        : 'translateX(-50%) translateY(5px)',
                      opacity: isHovered || isDragOver ? 1 : 0,
                      visibility: isHovered || isDragOver ? 'visible' : 'hidden',
                      transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
                      background: 'rgba(15, 15, 25, 0.92)',
                      border: '1px solid rgba(202, 138, 4, 0.5)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      alignItems: 'center',
                      zIndex: 100
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>
                        {peer.nickname}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(202, 138, 4, 0.8)', fontFamily: 'var(--font-mono)' }}>
                        {peer.ip}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {renderOSBadge(peer.os)}
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                        {isDragOver ? '松开即投递文件' : '点击选择文件/拖拽互传'}
                      </span>
                    </div>

                  </div>
                );
              })
            )}

          </div>

          {/* 雷达外环发光装饰角标 */}
          <div style={{ position: 'absolute', top: '12px', left: '12px', width: '12px', height: '12px', borderTop: '2px solid rgba(202,138,4,0.4)', borderLeft: '2px solid rgba(202,138,4,0.4)' }} />
          <div style={{ position: 'absolute', top: '12px', right: '12px', width: '12px', height: '12px', borderTop: '2px solid rgba(202,138,4,0.4)', borderRight: '2px solid rgba(202,138,4,0.4)' }} />
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', width: '12px', height: '12px', borderBottom: '2px solid rgba(202,138,4,0.4)', borderLeft: '2px solid rgba(202,138,4,0.4)' }} />
          <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '12px', height: '12px', borderBottom: '2px solid rgba(202,138,4,0.4)', borderRight: '2px solid rgba(202,138,4,0.4)' }} />

        </div>

        {/* 右侧：高度密集型数据卡片列表 */}
        <div style={{ 
          flex: '1', 
          minWidth: '280px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          maxHeight: '400px',
          overflowY: 'auto',
          paddingRight: '6px'
        }} className="radar-dense-list">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>设备属性细节</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(202, 138, 4, 0.7)', fontFamily: 'var(--font-mono)' }}>mDNS P2P NODE</span>
          </div>

          {/* 1. 顶置高亮显示本机设备卡片 */}
          {self && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(202, 138, 4, 0.05)',
                border: '1px solid rgba(202, 138, 4, 0.25)',
                boxShadow: '0 0 10px rgba(202, 138, 4, 0.03)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'rgba(202, 138, 4, 0.12)',
                  border: '1.5px solid var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-color)',
                  flexShrink: 0
                }}>
                  {renderAvatarIcon(self.avatar, 15)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {self.nickname}
                    </span>
                    <span style={{
                      fontSize: '0.58rem',
                      background: 'var(--accent-color)',
                      color: '#ffffff',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontWeight: 700,
                      transform: 'scale(0.9)',
                      transformOrigin: 'left center'
                    }}>
                      本机
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {self.ip}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {renderOSBadge(self.os)}
              </div>
            </div>
          )}

          {/* 2. 其它局域网在线设备列表 */}
          {peers.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '40px 16px',
              background: 'rgba(128,128,128,0.02)'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(202,138,4,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'radar-blink 2s ease-in-out infinite'
              }}>
                <RefreshCw size={14} style={{ color: 'var(--accent-color)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>正在寻道协作终端...</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '200px', lineHeight: 1.4 }}>
                  打开手机或另一台电脑的浏览器，访问上方提示的局域网 IP 地址，即可在此雷达上直接捕捉到它！
                </p>
              </div>
            </div>
          ) : (
            peers.map((peer) => {
              const isDragOver = dragOverPeerId === peer.id;
              
              return (
                <div
                  key={peer.id}
                  onDragOver={(e) => handleDragOver(e, peer.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, peer)}
                  onClick={() => handlePeerClick(peer)}
                  className="dense-peer-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: isDragOver ? 'rgba(202, 138, 4, 0.08)' : 'var(--bg-item)',
                    border: isDragOver ? '1px dashed var(--accent-color)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isDragOver ? 'var(--shadow-glow)' : 'none',
                    transform: isDragOver ? 'translateY(-1px)' : 'translateY(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'rgba(202, 138, 4, 0.08)',
                      border: '1px solid rgba(202, 138, 4, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-color)',
                      flexShrink: 0
                    }}>
                      {renderAvatarIcon(peer.avatar, 15)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {peer.nickname}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {peer.ip}
                        </span>
                        {renderOSBadge(peer.os)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ 
                      fontSize: '0.68rem', 
                      color: isDragOver ? 'var(--accent-color)' : 'var(--text-muted)',
                      transition: 'color 0.2s',
                      display: 'none' // 在窄屏下隐藏
                    }} className="dense-tips">
                      {isDragOver ? '释发送' : '拖放至此'}
                    </span>
                    <button style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(202, 138, 4, 0.1)',
                      color: 'var(--accent-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }} onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-color)';
                      e.currentTarget.style.color = '#ffffff';
                    }} onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(202, 138, 4, 0.1)';
                      e.currentTarget.style.color = 'var(--accent-color)';
                    }}>
                      <Send size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 科技雷达动效定义及响应式增强 */}
      <style jsx global>{`
        .dense-peer-card:hover {
          background: var(--bg-item-hover) !important;
          border-color: rgba(202, 138, 4, 0.4) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        
        .dense-peer-card:hover .dense-tips {
          display: inline !important;
        }

        /* 滚动条定制 */
        .radar-dense-list::-webkit-scrollbar {
          width: 5px;
        }
        .radar-dense-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .radar-dense-list::-webkit-scrollbar-thumb {
          background: rgba(202, 138, 4, 0.2);
          border-radius: 10px;
        }
        .radar-dense-list::-webkit-scrollbar-thumb:hover {
          background: rgba(202, 138, 4, 0.4);
        }

        @keyframes sonar-pulse-accent {
          0% {
            box-shadow: 0 0 0 0 rgba(202, 138, 4, 0.5);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(202, 138, 4, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(202, 138, 4, 0);
          }
        }

        @keyframes radar-sweep-animation {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes radar-pulse-out {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(3.5);
            opacity: 0;
          }
        }

        @keyframes radar-blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </Card>
  );
};

export default PeerList;
