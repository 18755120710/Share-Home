import { Bonjour, Service } from 'bonjour-service';
import os from 'os';
import { Peer } from '../types/peer';

export class MdnsService {
  private static instance: MdnsService | null = null;
  private bonjour: Bonjour | null = null;
  private publishedService: Service | null = null;
  private browser: any = null;
  
  // 维护局域网在线节点，Key 为 Peer ID
  private peers: Map<string, Peer> = new Map();
  private onPeersChangeCallbacks: Array<(peers: Peer[]) => void> = [];
  
  private selfId: string = '';
  private localIp: string = '';

  private constructor() {
    this.localIp = this.detectLocalIp();
    this.selfId = `peer_${this.localIp.replace(/\./g, '_')}`;
  }

  public static getInstance(): MdnsService {
    if (!MdnsService.instance) {
      MdnsService.instance = new MdnsService();
    }
    return MdnsService.instance;
  }

  /**
   * 启动本机的 mDNS 服务广播与局域网节点发现
   */
  public start(nickname: string, avatar: string, webPort: number): void {
    if (this.bonjour) {
      // 已经启动，则更新广播元数据
      this.updateBroadcast(nickname, avatar);
      return;
    }

    this.bonjour = new Bonjour();
    this.localIp = this.detectLocalIp();

    console.log(`[mDNS] 正在启动自发现服务. 本机IP: ${this.localIp}, 端口: ${webPort}`);

    // 1. 广播本机服务
    this.publishedService = this.bonjour.publish({
      name: `ShareHome-${this.selfId}`,
      type: 'sharehome',
      port: webPort,
      txt: {
        id: this.selfId,
        nickname: nickname,
        avatar: avatar,
        ip: this.localIp,
      }
    });

    this.publishedService.on('error', (err) => {
      console.error('[mDNS] 广播服务发生异常:', err);
    });

    // 2. 扫描局域网内的其他 ShareHome 服务
    this.browser = this.bonjour.find({ type: 'sharehome' });

    this.browser.on('up', (service: Service) => {
      const txt = service.txt || {};
      const peerId = txt.id;
      const peerIp = txt.ip || service.referer?.address;

      if (!peerId || !peerIp || peerId === this.selfId) {
        return; // 忽略本机以及无效广播
      }

      const newPeer: Peer = {
        id: peerId,
        nickname: txt.nickname || '局域网伙伴',
        avatar: txt.avatar || 'avatar-1',
        ip: peerIp,
        port: service.port,
        lastSeen: Date.now(),
        isSelf: false,
      };

      this.peers.set(peerId, newPeer);
      console.log(`[mDNS] 发现新设备上线: ${newPeer.nickname} (${newPeer.ip})`);
      this.notifyListeners();
    });

    this.browser.on('down', (service: Service) => {
      // 寻找对应的节点移出
      const txt = service.txt || {};
      const peerId = txt.id;
      if (peerId && this.peers.has(peerId)) {
        const removedPeer = this.peers.get(peerId);
        this.peers.delete(peerId);
        console.log(`[mDNS] 设备下线: ${removedPeer?.nickname}`);
        this.notifyListeners();
      }
    });
  }

  /**
   * 更新广播的昵称和头像元数据
   */
  public updateBroadcast(nickname: string, avatar: string): void {
    if (this.publishedService) {
      console.log(`[mDNS] 正在更新本机广播元数据: ${nickname}`);
      // bonjour-service 允许动态更新 TXT 记录
      try {
        // @ts-ignore
        this.publishedService.updateTxt({
          id: this.selfId,
          nickname: nickname,
          avatar: avatar,
          ip: this.localIp,
        });
      } catch (err) {
        console.error('[mDNS] 更新 TXT 记录失败，执行重启广播。');
      }
    }
  }

  /**
   * 关闭 mDNS 服务
   */
  public stop(): void {
    if (this.browser) {
      this.browser.stop();
    }
    if (this.publishedService) {
      this.publishedService.stop(() => {
        console.log('[mDNS] 停止本机广播服务。');
      });
    }
    if (this.bonjour) {
      this.bonjour.destroy();
      this.bonjour = null;
    }
    this.peers.clear();
    this.notifyListeners();
  }

  /**
   * 获取所有在线设备列表
   */
  public getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public getSelfId(): string {
    return this.selfId;
  }

  public getLocalIp(): string {
    return this.localIp;
  }

  /**
   * 监听列表变化
   */
  public onPeersChange(callback: (peers: Peer[]) => void): void {
    this.onPeersChangeCallbacks.push(callback);
    // 立即触发一次初始数据
    callback(this.getPeers());
  }

  private notifyListeners(): void {
    const peersList = this.getPeers();
    for (const callback of this.onPeersChangeCallbacks) {
      callback(peersList);
    }
  }

  /**
   * 获取本机的局域网 IPv4 地址
   */
  private detectLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '127.0.0.1';
  }
}
