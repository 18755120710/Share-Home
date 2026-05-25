type SocketCallback = (data: any) => void;

export class SocketClient {
  private static instance: SocketClient | null = null;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SocketCallback>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  private constructor() {
    // 仅在浏览器环境下启动连接
    if (typeof window !== 'undefined') {
      void this.connect();
    }
  }

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  /**
   * 启动 WebSocket 连接并挂载自愈机制
   */
  private async connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    let clientId = '';
    let nickname = '局域网伙伴';
    let avatar = 'avatar-1';
    let os = 'Windows';
    if (typeof window !== 'undefined') {
      clientId = localStorage.getItem('share_home_client_id') || '';
      if (!clientId) {
        clientId = `peer_web_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('share_home_client_id', clientId);
      }
      nickname = localStorage.getItem('share_home_nickname') || '局域网伙伴';
      avatar = localStorage.getItem('share_home_avatar') || 'avatar-1';
      
      const ua = window.navigator.userAgent;
      if (ua.indexOf('Windows NT') !== -1) os = 'Windows';
      else if (ua.indexOf('Macintosh') !== -1) os = 'macOS';
      else if (ua.indexOf('Android') !== -1) os = 'Android';
      else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';
      else if (ua.indexOf('Linux') !== -1) os = 'Linux';
    }

    try {
      await fetch(`/api/init?clientId=${encodeURIComponent(clientId)}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}&os=${os}`, { cache: 'no-store' });
    } catch (err) {
      console.warn('[SocketClient] 初始化宿主服务失败，仍将尝试连接 WebSocket:', err);
    }

    console.log(`[SocketClient] 正在建立全局共享通信长连接: ${protocol}://${host}:3001?clientId=${clientId}`);
    const wsUrl = `${protocol}://${host}:3001?clientId=${clientId}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}&os=${os}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log('[SocketClient] 全局共享长连接成功建立。');
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.trigger('system:connected', null);
    };

    ws.onmessage = (event) => {
      try {
        const { event: evName, data } = JSON.parse(event.data);
        if (evName) {
          this.trigger(evName, data);
        }
      } catch (err) {
        // 忽略非标准帧
      }
    };

    ws.onclose = () => {
      console.warn('[SocketClient] 全局共享长连接已断开，3秒后尝试自愈重连...');
      this.ws = null;
      this.isConnecting = false;
      this.trigger('system:disconnected', null);

      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => void this.connect(), 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('[SocketClient] 全局共享长连接出现异常:', err);
      ws.close();
    };
  }

  /**
   * 订阅特定类型的 WebSocket 推送事件
   */
  public subscribe(event: string, callback: SocketCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // 返回一键取消订阅的函数，极致优雅
    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * 触发事件回调
   */
  private trigger(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SocketClient] 执行事件 ${event} 的回调时发生异常:`, err);
        }
      });
    }
  }

  /**
   * 提供给外界判断当前连接状态
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
