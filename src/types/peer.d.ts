export interface Peer {
  /** 局域网内唯一标识 (通常基于主机名或IP哈希) */
  id: string;
  /** 用户自定义昵称 */
  nickname: string;
  /** 用户选择的头像代号 (例如: 'avatar-1', 'avatar-2') */
  avatar: string;
  /** 局域网 IPv4 地址 */
  ip: string;
  /** 局域网服务运行端口 */
  port: number;
  /** 上次接收到心跳包的时间戳 */
  lastSeen: number;
  /** 是否是本端设备本身 */
  isSelf: boolean;
}

export interface SelfConfig {
  nickname: string;
  avatar: string;
}
