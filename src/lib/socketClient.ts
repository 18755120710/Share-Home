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
      this.connect();
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
  private connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    console.log(`[SocketClient] 正在建立全局共享通信长连接: ${protocol}://${host}:3001`);
    const ws = new WebSocket(`${protocol}://${host}:3001`);
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
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
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
