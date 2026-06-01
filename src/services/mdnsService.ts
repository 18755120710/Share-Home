import { Bonjour, Service } from 'bonjour-service';
import os from 'os';
import { Peer } from '../types/peer';

export class MdnsService {
  private bonjour: InstanceType<typeof Bonjour> | null = null;
  private publishedService: InstanceType<typeof Service> | null = null;
  private browser: any = null;
  
  // 维护局域网在线节点，Key 为 Peer ID
  private peers: Map<string, Peer> = new Map();
  private onPeersChangeCallbacks: Array<(peers: Peer[]) => void> = [];
  
  private selfId: string = '';
  private localIp: string = '';
  private selfNickname: string = '超级管理员';
  private selfAvatar: string = 'avatar-1';
  private selfWebPort: number = 3000;

  private constructor() {
    this.localIp = this.detectLocalIp();
    this.selfId = `peer_${this.localIp.replace(/\./g, '_')}`;
  }

  public static getInstance(): MdnsService {
    const globalSymbols = global as any;
    if (!globalSymbols.__mdns_service_instance__) {
      globalSymbols.__mdns_service_instance__ = new MdnsService();
    }
    return globalSymbols.__mdns_service_instance__;
  }

  /**
   * 启动本机的 mDNS 服务广播与局域网节点发现
   */
  public start(nickname: string, avatar: string, webPort: number): void {
    this.selfNickname = nickname;
    this.selfAvatar = avatar;
    this.selfWebPort = webPort;

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

    this.browser.on('up', (service: InstanceType<typeof Service>) => {
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

    this.browser.on('down', (service: InstanceType<typeof Service>) => {
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
    this.selfNickname = nickname;
    this.selfAvatar = avatar;

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
   * 注册由 Web 浏览器访问建立的虚拟 Peer
   */
  public registerWebPeer(id: string, ip: string, nickname: string, avatar: string, port = 3000, os = 'Windows'): void {
    if (id === this.selfId) return;
    
    // 智能修正：若 Web 客户端通过本地回环地址访问，将其 IP 修正为本机的物理局域网 IP
    let clientIp = ip;
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost') {
      clientIp = this.localIp;
    }
    
    const newPeer: Peer = {
      id,
      nickname,
      avatar,
      ip: clientIp,
      port,
      lastSeen: Date.now(),
      isSelf: false,
      os
    };
    
    this.peers.set(id, newPeer);
    console.log(`[mDNS] 收到 Web 浏览器虚拟终端注册: ${nickname} (${clientIp}), OS: ${os}`);
    this.notifyListeners();
  }

  /**
   * 注销指定 Web 虚拟 Peer
   */
  public unregisterWebPeer(id: string): void {
    if (this.peers.has(id)) {
      const removedPeer = this.peers.get(id);
      this.peers.delete(id);
      console.log(`[mDNS] Web 浏览器虚拟终端下线: ${removedPeer?.nickname}`);
      this.notifyListeners();
    }
  }

  /**
   * 获取所有在线设备列表
   */
  public getPeers(): Peer[] {
    const list = Array.from(this.peers.values());

    let hostOs = 'Windows';
    const platform = os.platform();
    if (platform === 'darwin') hostOs = 'macOS';
    else if (platform === 'win32') hostOs = 'Windows';
    else if (platform === 'linux') hostOs = 'Linux';

    // 把主机自身作为一个常规 peer 节点拼装进列表在后端 API 中返回，让局域网其他客户端可以通过 API 拉取并正确渲染显示主机在线！
    const selfPeer: Peer = {
      id: this.selfId,
      nickname: this.selfNickname,
      avatar: this.selfAvatar,
      ip: this.localIp,
      port: this.selfWebPort,
      lastSeen: Date.now(),
      isSelf: false, // 对于外部访问而言，本机自然不是“自己”
      os: hostOs
    };

    list.push(selfPeer);
    return list;
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
   * 获取本机的局域网 IPv4 地址 (智能过滤虚拟网卡，优先获取物理 WLAN/以太网网口 IP)
   */
  private detectLocalIp(): string {
    const interfaces = os.networkInterfaces();
    const candidates: Array<{ name: string; address: string; isVirtual: boolean; isPreferred: boolean }> = [];

    // 虚拟/代理/虚拟网卡等常见关键字过滤
    const virtualKeywords = [
      'vmware', 'virtualbox', 'vbox', 'wsl', 'vethernet', 
      'meta', 'clash', 'zerotier', 'tailscale', 'tun', 
      'tap', 'loopback', 'vpn', 'host-only', 'sandbox'
    ];

    // 物理网卡优先关键字
    const physicalKeywords = [
      'wlan', 'wifi', 'wireless', '无线', 'ethernet', 
      '以太', '乙太', '本地连接', '区域连接'
    ];

    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;

      const nameLower = devName.toLowerCase();
      const isVirtual = virtualKeywords.some(keyword => nameLower.includes(keyword));
      const isPreferred = physicalKeywords.some(keyword => nameLower.includes(keyword));

      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          candidates.push({
            name: devName,
            address: alias.address,
            isVirtual,
            isPreferred
          });
        }
      }
    }

    // 1. 优先筛选出非虚拟且被选为 Preferred 的物理网卡
    const preferredPhysical = candidates.filter(c => !c.isVirtual && c.isPreferred);
    if (preferredPhysical.length > 0) {
      console.log(`[mDNS] 精准选择物理网卡: ${preferredPhysical[0].name} (${preferredPhysical[0].address})`);
      return preferredPhysical[0].address;
    }

    // 2. 其次筛选出非虚拟的其他网卡
    const realCandidates = candidates.filter(c => !c.isVirtual);
    if (realCandidates.length > 0) {
      console.log(`[mDNS] 选择非虚拟网卡: ${realCandidates[0].name} (${realCandidates[0].address})`);
      return realCandidates[0].address;
    }

    // 3. 如果全部是虚拟网卡，看是否有 Preferred 的虚拟网卡
    const preferredVirtual = candidates.filter(c => c.isPreferred);
    if (preferredVirtual.length > 0) {
      console.log(`[mDNS] 未检测到物理网卡，选择首选虚拟网卡: ${preferredVirtual[0].name} (${preferredVirtual[0].address})`);
      return preferredVirtual[0].address;
    }

    // 4. 兜底返回第一个非本地回环地址
    if (candidates.length > 0) {
      console.log(`[mDNS] 未检测到匹配网卡，使用首个 IPv4 网卡: ${candidates[0].name} (${candidates[0].address})`);
      return candidates[0].address;
    }

    return '127.0.0.1';
  }
}
