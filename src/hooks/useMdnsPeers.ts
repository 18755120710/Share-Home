import { useState, useEffect, useRef } from 'react';
import { Peer } from '../types/peer';
import { SocketClient } from '../lib/socketClient';

export function useMdnsPeers() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [self, setSelf] = useState<Peer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selfRef = useRef<Peer | null>(null);

  // 保证 selfRef 永远指向最新的 self
  useEffect(() => {
    selfRef.current = self;
  }, [self]);

  // 初始化本地宿主服务
  const initHostServices = async () => {
    try {
      let cid = '';
      if (typeof window !== 'undefined') {
        cid = localStorage.getItem('share_home_client_id') || '';
        if (!cid) {
          cid = `peer_web_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem('share_home_client_id', cid);
        }
      }
      const res = await fetch(`/api/init?clientId=${cid}`);
      const data = await res.json();
      if (data.status === 'ready') {
        const selfData = {
          ...data.self,
          isSelf: true,
          lastSeen: Date.now(),
        };
        setSelf(selfData);
        setIsConnected(SocketClient.getInstance().isConnected());
        // 拉取一次初始列表
        fetchPeersList(selfData.id);
      }
    } catch (err) {
      console.error('[useMdnsPeers] 宿主服务启动失败，将在 3 秒后重试:', err);
      reconnectTimeoutRef.current = setTimeout(initHostServices, 3000);
    }
  };

  // HTTP 兜底拉取在线节点
  const fetchPeersList = async (currentSelfId?: string) => {
    const targetSelfId = currentSelfId || selfRef.current?.id;
    if (!targetSelfId) return;

    try {
      const res = await fetch('/api/peers');
      const data = await res.json();
      if (data.peers) {
        const filtered = (data.peers as Peer[]).filter(p => p.id !== targetSelfId);
        setPeers(filtered);
      }
    } catch (err) {
      console.error('[useMdnsPeers] 拉取设备列表失败:', err);
    }
  };

  /**
   * 用户修改昵称或头像时，提交至本地后端并动态广播
   */
  const updateProfile = async (nickname: string, avatar: string) => {
    if (!self) return false;
    try {
      const cid = typeof window !== 'undefined' ? localStorage.getItem('share_home_client_id') || '' : '';
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatar, clientId: cid }),
      });
      const data = await res.json();
      if (data.success) {
        setSelf(prev => prev ? { ...prev, nickname, avatar } : null);
        console.log('[useMdnsPeers] 个人资料更新广播成功！');
        // 主动刷新一次列表
        fetchPeersList();
        return true;
      }
    } catch (err) {
      console.error('[useMdnsPeers] 个人资料更新失败:', err);
    }
    return false;
  };

  useEffect(() => {
    // 1. 触发本地宿主初始化挂载
    initHostServices();

    // 2. 统一订阅全局共享 WebSocket 连接与事件
    const socket = SocketClient.getInstance();

    const unsubConnected = socket.subscribe('system:connected', () => {
      setIsConnected(true);
      fetchPeersList();
    });

    const unsubDisconnected = socket.subscribe('system:disconnected', () => {
      setIsConnected(false);
    });

    const unsubPeers = socket.subscribe('peers:update', (data: Peer[]) => {
      const currentSelf = selfRef.current;
      if (currentSelf) {
        const filtered = data.filter(p => p.id !== currentSelf.id);
        setPeers(filtered);
      } else {
        setPeers(data);
      }
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubPeers();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    peers,
    self,
    isConnected,
    updateProfile,
    refreshPeers: () => fetchPeersList(),
  };
}
