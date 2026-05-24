import { WebSocketServer, WebSocket } from 'ws';
import { Peer } from '../types/peer';

export class SocketService {
  private static instance: SocketService | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private isStarted = false;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * 在指定端口启动 WebSocket 服务器，服务于本机浏览器前端
   */
  public start(port: number): void {
    if (this.isStarted) return;

    console.log(`[WebSocket] 正在启动通信服务, 监听端口: ${port}`);
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`[WebSocket] 本地浏览器客户端已建立连接. 当前连接数: ${this.clients.size}`);

      // 监听客户端发来的测试或控制指令
      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message);
          console.log('[WebSocket] 收到前端控制消息:', parsed);
          // 这里可以处理前端发来的个性化事件
        } catch (e) {
          // 忽略非 JSON 数据
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WebSocket] 本地浏览器客户端已断开连接. 当前连接数: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] 连接出现异常:', err);
        this.clients.delete(ws);
      });
      
      // 建立连接后，给前端发送一个欢迎及就绪包
      this.sendTo(ws, 'system:ready', { timestamp: Date.now() });
    });

    this.isStarted = true;
  }

  /**
   * 关闭 WebSocket 服务
   */
  public stop(): void {
    if (this.wss) {
      this.wss.close(() => {
        console.log('[WebSocket] 通信服务已关闭。');
      });
      this.wss = null;
    }
    this.clients.clear();
    this.isStarted = false;
  }

  /**
   * 向所有连接的前端页面广播事件
   * @param event 事件名
   * @param data 附带的数据体
   */
  public broadcast(event: string, data: any): void {
    const payload = JSON.stringify({ event, data });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * 向单个连接发送消息
   */
  private sendTo(ws: WebSocket, event: string, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data }));
    }
  }
}
