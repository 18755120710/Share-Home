'use client';

import React, { useState } from 'react';
import { useMdnsPeers } from '@/hooks/useMdnsPeers';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import PeerList from '@/components/features/peers/PeerList';
import Board from '@/components/features/board/Board';
import Transfer from '@/components/features/transfer/Transfer';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Radio, RefreshCw, User, Laptop, Edit3, Check } from 'lucide-react';

export default function Home() {
  // 1. 初始化局域网在线节点发现逻辑
  const { peers, self, isConnected, updateProfile, refreshPeers } = useMdnsPeers();

  // 2. 初始化局域网极速传输引擎逻辑
  const { tasks, incomingRequest, sendFile, acceptRequest, rejectRequest } = useFileTransfer(
    self?.id,
    self?.nickname
  );

  // 个人资料编辑状态
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newAvatar, setNewAvatar] = useState('avatar-1');

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

  return (
    <div style={{ 
      maxWidth: '1440px', 
      margin: '0 auto', 
      padding: '32px 24px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '32px',
      minHeight: '100vh'
    }}>
      
      {/* 1. 顶部极简大厂风标题栏 */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '20px'
      }}>
        {/* Logo 区域 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-color)',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Radio size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.03em' }}>Share Home</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>局域网协作平台</p>
          </div>
        </div>

        {/* 个人身份栏与自发现状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {self && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isEditingProfile ? (
                // 个人信息实时修改编辑状态
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      width: '100px'
                    }}
                    maxLength={10}
                  />
                  <select
                    value={newAvatar}
                    onChange={(e) => setNewAvatar(e.target.value)}
                    style={{
                      background: '#09090b',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      outline: 'none',
                      padding: '2px'
                    }}
                  >
                    <option value="avatar-1">笔记本</option>
                    <option value="avatar-2">显示器</option>
                    <option value="avatar-3">手机</option>
                  </select>
                  <button onClick={saveProfile} style={{ background: 'transparent', border: 'none', color: 'var(--success-color)', cursor: 'pointer' }}>
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                // 静态个人展示卡片
                <div 
                  onClick={startEditProfile}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-color-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <Laptop size={14} style={{ color: 'var(--accent-color)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{self.nickname} (本端)</span>
                  <Edit3 size={12} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>
          )}

          {/* 强制拉取刷新 */}
          <Button variant="secondary" onClick={refreshPeers} style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </header>

      {/* 2. 主三栏式自适应极简控制台网格 */}
      <main style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
        gap: '24px',
        alignItems: 'stretch'
      }}>
        {/* 2.1 在线设备雷达卡片 */}
        <PeerList 
          peers={peers} 
          onSendFile={(peer, file) => {
            sendFile(peer.ip, peer.port, peer.id, peer.nickname, file);
          }} 
        />

        {/* 2.2 去中心化公告栏 */}
        <Board peers={peers} self={self} />

        {/* 2.3 文件传输进度卡片 */}
        <Transfer 
          tasks={tasks} 
          incomingRequest={incomingRequest} 
          onAccept={acceptRequest} 
          onReject={rejectRequest} 
        />
      </main>

      {/* 3. 极简页脚 */}
      <footer style={{ 
        textAlign: 'center', 
        fontSize: '0.75rem', 
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '20px',
        marginTop: 'auto'
      }}>
        Share Home © 2026. 私密、极速、零配置的局域网协作利器
      </footer>
    </div>
  );
}
