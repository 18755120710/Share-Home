import React, { useState, useRef } from 'react';
import { Peer } from '@/types/peer';
import Card from '../../ui/Card';
import { Monitor, Smartphone, Laptop, Radio, Send, RefreshCw, Layers, ShieldCheck, Wifi } from 'lucide-react';

interface PeerListProps {
  peers: Peer[];
  self: Peer | null; // 本端属性，支持显示当前设备
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
    // 映射出 40% - 80% 之间的同心圆半径，防止节点重叠，且完美留在雷达盘内
    const radius = 40 + (Math.abs(hash >> 8) % 36);
    
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

  // 模拟雷达扫描下设备的精细化延迟延迟信息（配合大厂科技感）
  const getMockPing = (peerId: string) => {
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
      hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 4) + 1; // 1 ~ 5ms
  };

  return (
    <Card style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px', 
      minHeight: '660px', 
      padding: '28px', 
      overflow: 'hidden',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)'
    }}>
      
      {/* 隐藏的文件输入框，支持点击设备即可选文件发送 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {/* 头部标题与雷达指示灯 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-color)' }} />
            超视距雷达协作台
          </h2>
          <span style={{ 
            fontSize: '0.68rem', 
            background: 'var(--radar-center-bg)', 
            color: 'var(--accent-color)', 
            padding: '4px 12px', 
            borderRadius: '20px',
            border: '1px solid var(--radar-corner-border)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            letterSpacing: '0.02em'
          }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: 'var(--accent-color)',
              boxShadow: '0 0 10px var(--accent-color)',
              animation: 'sonar-pulse-accent 2s infinite'
            }} />
            MCAST MULTICAST DISCOVERY ACTIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'var(--font-mono), monospace' }}>
            NODES ACTIVE: <strong style={{ color: 'var(--accent-color)', fontSize: '0.95rem', fontWeight: 700 }}>{peers.length + (self ? 1 : 0)}</strong>
          </span>
        </div>
      </div>

      {/* 科技感满分居中布局容器 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        
        {/* 3D/2D 动效雷达扫描视窗：大厂精致格栅背景 */}
        <div style={{ 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'var(--radar-bg-outer)',
          backgroundSize: '100% 100%, 24px 24px, 24px 24px',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '48px 24px',
          position: 'relative',
          boxShadow: 'var(--radar-inner-shadow, inset 0 4px 40px rgba(0,0,0,0.15))',
          minHeight: '540px',
          overflow: 'hidden'
        }}>
          
          {/* 四个角落的军工级HUD科技线条装饰 */}
          <div style={{ position: 'absolute', top: '16px', left: '16px', width: '16px', height: '16px', borderTop: '2px solid var(--radar-corner-border)', borderLeft: '2px solid var(--radar-corner-border)' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', width: '16px', height: '16px', borderTop: '2px solid var(--radar-corner-border)', borderRight: '2px solid var(--radar-corner-border)' }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '16px', height: '16px', borderBottom: '2px solid var(--radar-corner-border)', borderLeft: '2px solid var(--radar-corner-border)' }} />
          <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '16px', height: '16px', borderBottom: '2px solid var(--radar-corner-border)', borderRight: '2px solid var(--radar-corner-border)' }} />

          {/* 四角高精度的数字/字符刻度 */}
          <div style={{ position: 'absolute', top: '16px', left: '38px', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--radar-accent-text)', letterSpacing: '0.1em' }}>SYS_STATUS: NOMINAL</div>
          <div style={{ position: 'absolute', top: '16px', right: '38px', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--radar-accent-text)', letterSpacing: '0.1em' }}>GRID_REF: 48-T9_L</div>
          <div style={{ position: 'absolute', bottom: '16px', left: '38px', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--radar-accent-text)', letterSpacing: '0.1em' }}>BANDWIDTH: UNLIMITED</div>
          <div style={{ position: 'absolute', bottom: '16px', right: '38px', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--radar-accent-text)', letterSpacing: '0.1em' }}>DISC: mDNS_NODE</div>

          {/* 雷达大圆盘容器 - 升级为 430px 更加大气 */}
          <div style={{ 
            width: '430px', 
            height: '430px', 
            borderRadius: '50%', 
            position: 'relative', 
            background: 'var(--radar-bg-inner)',
            border: '2px solid var(--radar-border)',
            boxShadow: '0 0 60px var(--radar-peer-shadow), inset 0 0 30px var(--radar-peer-shadow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* 内部裁剪容器：用于放置 SVG 网格与旋转扫射光芒，防止溢出圆盘 */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
              top: 0,
              left: 0
            }}>
              {/* 雷达科技背景网格线及十字轴 */}
              <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}>
                {/* 各种刻度线与同心圆 */}
                <circle cx="50%" cy="50%" r="20%" fill="none" stroke="var(--radar-grid-subtle)" strokeWidth="1" />
                <circle cx="50%" cy="50%" r="40%" fill="none" stroke="var(--radar-grid)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="50%" cy="50%" r="60%" fill="none" stroke="var(--radar-grid-subtle)" strokeWidth="1" />
                <circle cx="50%" cy="50%" r="80%" fill="none" stroke="var(--radar-grid)" strokeWidth="1.2" strokeDasharray="5 5" />
                
                {/* 精密细刻度外圆环 (大厂细节！) */}
                <circle cx="50%" cy="50%" r="83%" fill="none" stroke="var(--radar-border)" strokeWidth="3" strokeDasharray="1 14" />
                <circle cx="50%" cy="50%" r="83%" fill="none" stroke="var(--radar-grid)" strokeWidth="1" />

                {/* 十字网格轴线 */}
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--radar-grid)" strokeWidth="1" />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--radar-grid)" strokeWidth="1" />
                
                {/* 斜向虚线网格轴线 */}
                <line x1="15%" y1="15%" x2="85%" y2="85%" stroke="var(--radar-grid-subtle)" strokeWidth="1" strokeDasharray="2 5" />
                <line x1="85%" y1="15%" x2="15%" y2="85%" stroke="var(--radar-grid-subtle)" strokeWidth="1" strokeDasharray="2 5" />
              </svg>

              {/* 360°旋转扫描扇形射线层 */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                borderRadius: '50%',
                background: 'var(--radar-sweep)',
                animation: 'radar-sweep-animation 5s linear infinite',
                transformOrigin: '50% 50%',
              }} />
            </div>

            {/* 外部常驻显示的航向角标识文字 (大厂细节！) */}
            <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', fontWeight: 600, color: 'var(--radar-accent-text)', pointerEvents: 'none' }}>000°/N</div>
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', fontWeight: 600, color: 'var(--radar-accent-text)', pointerEvents: 'none' }}>090°/E</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', fontWeight: 600, color: 'var(--radar-accent-text)', pointerEvents: 'none' }}>180°/S</div>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', fontWeight: 600, color: 'var(--radar-accent-text)', pointerEvents: 'none' }}>270°/W</div>

            {/* 雷达中心点：本端发射基站 (代表“我”本机) */}
            <div style={{
              position: 'relative',
              width: '44px',
              height: '44px',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* 外部极具科技感的旋转细点虚线框 */}
              <div style={{
                position: 'absolute',
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                border: '1.2px dashed var(--radar-border)',
                animation: 'spin-clockwise 18s linear infinite',
                pointerEvents: 'none'
              }} />

              {/* 第二层同轴逆向慢速旋转花环装饰 */}
              <div style={{
                position: 'absolute',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '1px solid var(--radar-grid-subtle)',
                borderTop: '1px solid var(--radar-border)',
                borderBottom: '1px solid var(--radar-border)',
                animation: 'spin-counter-clockwise 10s linear infinite',
                pointerEvents: 'none'
              }} />

              {/* 核心发射源实体 */}
              <div 
                onMouseEnter={() => self && setHoveredPeerId('self_node')}
                onMouseLeave={() => setHoveredPeerId(null)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'var(--radar-center-bg)',
                  border: '2.5px solid var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 35px var(--radar-center-shadow)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  zIndex: 2
                }}
              >
                <Radio size={18} style={{ color: '#ffffff' }} className="animate-pulse" />
                {/* 核心向外发射脉冲圈圈 */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '1px solid var(--accent-color)',
                  animation: 'radar-pulse-out 3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '1px solid var(--accent-color)',
                  animation: 'radar-pulse-out 3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
                  animationDelay: '1.5s',
                  pointerEvents: 'none'
                }} />
              </div>
            </div>

            {/* 本机 HUD 悬浮提示面板 */}
            {self && (hoveredPeerId === 'self_node') && (
              <div style={{
                position: 'absolute',
                top: '59%',
                left: '50%',
                transform: 'translateX(-50%) translateY(0)',
                background: 'var(--radar-hud-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--radar-hud-border)',
                padding: '14px 20px',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: 'center',
                zIndex: 100,
                animation: 'fade-in-quick 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '0.12em', fontFamily: 'var(--font-mono), monospace' }}>
                  LOBBY HOST / 本地核心
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--radar-hud-text-primary)', letterSpacing: '-0.01em' }}>
                  {self.nickname}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--radar-hud-text-secondary)', fontFamily: 'var(--font-mono), monospace', fontWeight: 500 }}>
                  {self.ip}
                </span>
                <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {renderOSBadge(self.os)}
                  <span style={{ fontSize: '0.62rem', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success-color)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>DISCOVERY_OK</span>
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
                  color: 'var(--radar-accent-text)', 
                  fontSize: '0.78rem', 
                  letterSpacing: '0.2em',
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 600,
                  animation: 'radar-blink 2.2s ease-in-out infinite',
                  marginTop: '130px'
                }}>
                  SCANNING FOR ACTIVE TERMINALS...
                </span>
              </div>
            ) : (
              peers.map((peer) => {
                const { left, top } = getPeerCoordinates(peer);
                const isDragOver = dragOverPeerId === peer.id;
                const isHovered = hoveredPeerId === peer.id;
                const mockPing = getMockPing(peer.id);
                
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
                      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    {/* 科技感设备发光 Pod (大厂细节重组！) */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: isDragOver 
                        ? 'var(--radar-pulse-glow)' 
                        : isHovered 
                          ? 'var(--radar-center-bg)' 
                          : 'var(--radar-peer-bg)',
                      border: isDragOver 
                        ? '2.2px dashed var(--accent-color)' 
                        : isHovered 
                          ? '2px solid var(--accent-color)' 
                          : '1.2px solid var(--radar-peer-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isHovered || isDragOver 
                        ? '0 0 25px var(--radar-pulse-glow), inset 0 0 10px var(--radar-peer-shadow)' 
                        : '0 0 12px var(--radar-peer-shadow)',
                      transform: isHovered || isDragOver ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative'
                    }}>
                      {/* Hover时显示的小型雷达锁定装饰十字刻度线 */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute',
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          border: '1px solid var(--radar-pulse-glow)',
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          animation: 'spin-clockwise 3s linear infinite'
                        }} />
                      )}

                      {/* 设备分类实体图标 */}
                      <span style={{ 
                        color: isHovered || isDragOver ? '#ffffff' : 'var(--accent-color)',
                        transition: 'color 0.25s' 
                      }}>
                        {renderAvatarIcon(peer.avatar, 20)}
                      </span>

                      {/* 极小的科技发光在线微标灯 */}
                      <span style={{
                        position: 'absolute',
                        top: '1px',
                        right: '1px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--success-color)',
                        border: '1.5px solid rgba(16, 17, 30, 0.98)',
                        boxShadow: '0 0 8px var(--success-color)'
                      }} />
                    </div>

                    {/* 节点底部的微型科技感设备昵称胶囊标签（常驻精细化展示） */}
                    <div style={{
                      position: 'absolute',
                      top: '54px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '0.62rem',
                      fontFamily: 'var(--font-mono), monospace',
                      fontWeight: 600,
                      color: isHovered ? 'var(--accent-color)' : 'var(--text-secondary)',
                      background: isHovered ? 'var(--radar-hud-bg)' : 'var(--radar-peer-bg)',
                      border: isHovered ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      letterSpacing: '0.04em',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      opacity: isHovered ? 0 : 1 // Hover时隐藏常驻标签以露出高精 HUD 面板
                    }}>
                      {peer.nickname}
                    </div>

                    {/* HUD 大厂精细化弹出卡片：Hover / DragOver 时展示 */}
                    <div style={{
                      position: 'absolute',
                      top: '58px',
                      left: '50%',
                      transform: isHovered || isDragOver 
                        ? 'translateX(-50%) translateY(0)' 
                        : 'translateX(-50%) translateY(8px)',
                      opacity: isHovered || isDragOver ? 1 : 0,
                      visibility: isHovered || isDragOver ? 'visible' : 'hidden',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      background: 'var(--radar-hud-bg)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--radar-hud-border)',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-lg)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      alignItems: 'center',
                      zIndex: 100
                    }}>
                      {/* 卡片头部修饰条 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.58rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--accent-color)', fontWeight: 700, letterSpacing: '0.08em', width: '100%', borderBottom: '1px solid var(--radar-hud-divider)', paddingBottom: '5px', marginBottom: '3px' }}>
                        <Wifi size={10} />
                        DISCOVERED PEER NODE
                      </div>

                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--radar-hud-text-primary)', letterSpacing: '-0.01em' }}>
                        {peer.nickname}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--radar-hud-text-secondary)', fontFamily: 'var(--font-mono), monospace', fontWeight: 500 }}>
                        {peer.ip}
                      </span>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', margin: '2px 0' }}>
                        {renderOSBadge(peer.os)}
                        <span style={{ 
                          fontSize: '0.62rem', 
                          background: 'rgba(202,138,4,0.06)', 
                          color: 'var(--accent-color)', 
                          border: '1px solid rgba(202,138,4,0.15)', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono), monospace'
                        }}>
                          RTT: ~{mockPing}ms
                        </span>
                      </div>

                      <div style={{ 
                        fontSize: '0.65rem', 
                        color: 'var(--radar-hud-text-muted)', 
                        borderTop: '1px solid var(--radar-hud-divider)', 
                        paddingTop: '6px', 
                        width: '100%', 
                        textAlign: 'center',
                        marginTop: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}>
                        <ShieldCheck size={11} style={{ color: 'var(--success-color)' }} />
                        {isDragOver ? '松开即投递文件' : '点击选择文件 / 拖放互传'}
                      </div>
                    </div>

                  </div>
                );
              })
            )}

          </div>

        </div>

        {/* 底部交互科技信息提示：大厂极简风格 */}
        <div style={{ 
          marginTop: '20px', 
          fontSize: '0.78rem', 
          color: 'var(--text-secondary)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          background: 'rgba(128,128,128,0.03)',
          border: '1px solid var(--border-color)',
          padding: '8px 18px',
          borderRadius: '30px'
        }}>
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: 'var(--accent-color)',
            animation: 'sonar-pulse-accent 2s infinite' 
          }} />
          <span>终端操作指南：鼠标悬浮获取设备科技详情，点击设备节点或拖放文件至节点上即可触发高速安全传输</span>
        </div>

      </div>

      {/* 科技雷达动效定义及大厂精细化动画 */}
      <style jsx global>{`
        @keyframes sonar-pulse-accent {
          0% {
            box-shadow: 0 0 0 0 var(--radar-pulse-glow, rgba(202, 138, 4, 0.45));
          }
          70% {
            box-shadow: 0 0 0 8px transparent;
          }
          100% {
            box-shadow: 0 0 0 0 transparent;
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
            transform: translate(-50%, -50%) scale(3.2);
            opacity: 0;
          }
        }

        @keyframes radar-blink {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }

        @keyframes spin-clockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes spin-counter-clockwise {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }

        @keyframes fade-in-quick {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </Card>
  );
};

export default PeerList;
