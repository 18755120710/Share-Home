import { useState, useEffect, useRef } from 'react';
import { Peer, SelfConfig } from '../types/peer';

export function useMdnsPeers() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [self, setSelf] = useState<Peer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化本地宿主服务
  const initHostServices = async () => {
    try {
      const res = await fetch('/api/init');
      const data = await res.json();
      if (data.status === 'ready') {
        setSelf({
          ...data.self,
          isSelf: true,
          lastSeen: Date.now(),
        });
        // 初始化成功后，连接 WebSocket
        connectWebSocket();
      }
    } catch (err) {
      console.error('[useMdnsPeers] 宿主服务启动失败，将在 3 秒后重试:', err);
      reconnectTimeoutRef.current = setTimeout(initHostServices, 3000);
    }
  };

  // 建立与本地后端的 WebSocket 双向长连接
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    // 默认使用 3001 端口进行本地前后端事件派发
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useMdnsPeers] 与本地 WebSocket 通信成功建立。');
      setIsConnected(true);
      // 成功连接后，主动请求拉取一次初始 Peer 列表
      fetchPeersList();
    };

    ws.onmessage = (event) => {
      try {
        const { event: evName, data } = JSON.parse(event.data);
        
        switch (evName) {
          case 'peers:update':
            // 剔除可能在列表中的自己
            const filteredPeers = (data as Peer[]).filter(p => p.id !== self?.id);
            setPeers(filteredPeers);
            break;
          case 'system:ready':
            console.log('[useMdnsPeers] 收到宿主系统就绪信号');
            break;
          default:
            break;
        }
      } catch (err) {
        // 忽略非标准的帧
      }
    };

    ws.onclose = () => {
      console.warn('[useMdnsPeers] 与本地 WebSocket 通信断开，3秒后尝试重连...');
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[useMdnsPeers] WebSocket 出现异常:', err);
      ws.close();
    };
  };

  // HTTP 兜底拉取在线节点
  const fetchPeersList = async () => {
    try {
      const res = await fetch('/api/peers');
      const data = await res.json();
      if (data.peers && self) {
        const filtered = (data.peers as Peer[]).filter(p => p.id !== self.id);
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
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatar }),
      });
      const data = await res.json();
      if (data.success) {
        setSelf(prev => prev ? { ...prev, nickname, avatar } : null);
        console.log('[useMdnsPeers] 个人资料更新广播成功！');
        return true;
      }
    } catch (err) {
      console.error('[useMdnsPeers] 个人资料更新失败:', err);
    }
    return false;
  };

  useEffect(() => {
    initHostServices();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
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
    refreshPeers: fetchPeersList,
  };
}
