import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DevicePermission {
  allowUpload: boolean;
  allowEditDoc: boolean;
  allowCreateDoc: boolean;
}

export interface KnownDevice {
  id: string;
  ip: string;
  nickname: string;
  avatar: string;
  os: string;
  role: 'admin' | 'guest';
  firstSeen: number;
  lastSeen: number;
}

export interface AuthConfig {
  adminUsername: string;
  adminSalt: string;
  adminHash: string;
  guestSalt: string;
  guestHash: string;
  devicePermissions: Record<string, DevicePermission>;
  knownDevices?: Record<string, KnownDevice>;
}

export interface UserSession {
  role: 'admin' | 'guest';
  ip: string;
  lastActive: number;
}

export class AuthService {
  private confDir: string;
  private authFilePath: string;

  private constructor() {
    // 兼容本地开发及 CLI 生产物理路径
    const projectRoot = path.join(process.cwd());
    this.confDir = path.join(projectRoot, 'conf');
    this.authFilePath = path.join(this.confDir, 'auth.json');

    // 挂载全局共享 Session Map，跨热更新与 API 路由保持单例会话状态
    const globalSymbols = global as any;
    if (!globalSymbols.__sessions__) {
      globalSymbols.__sessions__ = new Map<string, UserSession>();
    }
  }

  public static getInstance(): AuthService {
    const globalSymbols = global as any;
    if (!globalSymbols.__auth_service_instance__) {
      globalSymbols.__auth_service_instance__ = new AuthService();
    }
    return globalSymbols.__auth_service_instance__;
  }

  /**
   * 判断配置是否已初始化 (auth.json 是否存在)
   */
  public isInitialized(): boolean {
    return fs.existsSync(this.authFilePath);
  }

  /**
   * pbkdf2 加盐哈希加密算法
   */
  private hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
  }

  /**
   * 从物理磁盘读取配置
   */
  private readConfig(): AuthConfig | null {
    if (!this.isInitialized()) return null;
    try {
      const raw = fs.readFileSync(this.authFilePath, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('[AuthService] 读取密码配置文件发生异常:', e);
      return null;
    }
  }

  /**
   * 将配置存入物理磁盘
   */
  private saveConfig(config: AuthConfig): boolean {
    try {
      if (!fs.existsSync(this.confDir)) {
        fs.mkdirSync(this.confDir, { recursive: true });
      }
      fs.writeFileSync(this.authFilePath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('[AuthService] 物理密码配置写入失败:', e);
      return false;
    }
  }

  /**
   * 网页端本地回环初始化管理员密码接口
   */
  public initAuth(adminUsername: string, adminPass: string, guestPass: string): boolean {
    if (this.isInitialized()) return false;

    const adminHashObj = this.hashPassword(adminPass);
    const guestHashObj = this.hashPassword(guestPass);

    const config: AuthConfig = {
      adminUsername: adminUsername || 'admin',
      adminSalt: adminHashObj.salt,
      adminHash: adminHashObj.hash,
      guestSalt: guestHashObj.salt,
      guestHash: guestHashObj.hash,
      devicePermissions: {},
      knownDevices: {}
    };

    return this.saveConfig(config);
  }

  /**
   * 校验管理员账号密码
   */
  public verifyAdmin(username: string, adminPass: string): boolean {
    const config = this.readConfig();
    if (!config) return false;

    if (config.adminUsername !== username) return false;
    const { hash } = this.hashPassword(adminPass, config.adminSalt);
    return hash === config.adminHash;
  }

  /**
   * 校验局域网普通伙伴通用登录密钥
   */
  public verifyGuest(guestPass: string): boolean {
    const config = this.readConfig();
    if (!config) return false;

    const { hash } = this.hashPassword(guestPass, config.guestSalt);
    return hash === config.guestHash;
  }

  /**
   * 超级管理员在线更新通用伙伴登录密钥
   */
  public updateGuestPassword(newGuestPass: string): boolean {
    const config = this.readConfig();
    if (!config) return false;

    const { salt, hash } = this.hashPassword(newGuestPass);
    config.guestSalt = salt;
    config.guestHash = hash;

    return this.saveConfig(config);
  }

  /**
   * 创建登录会话
   */
  public createSession(role: 'admin' | 'guest', ip: string): string {
    const globalSymbols = global as any;
    const sessionsMap = globalSymbols.__sessions__ as Map<string, UserSession>;
    
    // 产生全局唯一的高强度 32 字节 Session Token
    const token = crypto.randomBytes(32).toString('hex');
    sessionsMap.set(token, {
      role,
      ip,
      lastActive: Date.now()
    });

    return token;
  }

  public getClientIdFromIp(ip: string): string {
    return `peer_${ip.replace(/\./g, '_')}`;
  }

  public getActiveSessionDevices(maxIdleMs = 90 * 1000): Array<{ clientId: string; role: 'admin' | 'guest'; ip: string; lastActive: number }> {
    const globalSymbols = global as any;
    const sessionsMap = globalSymbols.__sessions__ as Map<string, UserSession>;
    const now = Date.now();
    const activeDevices = new Map<string, { clientId: string; role: 'admin' | 'guest'; ip: string; lastActive: number }>();

    for (const [token, session] of sessionsMap.entries()) {
      if (now - session.lastActive > 7 * 24 * 60 * 60 * 1000) {
        sessionsMap.delete(token);
        continue;
      }
      if (now - session.lastActive > maxIdleMs) {
        continue;
      }

      const clientId = this.getClientIdFromIp(session.ip);
      const previous = activeDevices.get(clientId);
      if (!previous || session.lastActive > previous.lastActive) {
        activeDevices.set(clientId, {
          clientId,
          role: session.role,
          ip: session.ip,
          lastActive: session.lastActive
        });
      }
    }

    return Array.from(activeDevices.values());
  }

  /**
   * 验证会话 Token 有效性
   */
  public verifySession(token: string): UserSession | null {
    if (!token) return null;
    const globalSymbols = global as any;
    const sessionsMap = globalSymbols.__sessions__ as Map<string, UserSession>;
    
    const session = sessionsMap.get(token);
    if (!session) return null;

    // 会话有效期 7 天：失效自愈清理
    const sessionExpiry = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.lastActive > sessionExpiry) {
      sessionsMap.delete(token);
      return null;
    }

    // 活跃会话滑动时间更新
    session.lastActive = Date.now();
    return session;
  }

  /**
   * 销毁会话 (登出)
   */
  public destroySession(token: string): void {
    const globalSymbols = global as any;
    const sessionsMap = globalSymbols.__sessions__ as Map<string, UserSession>;
    sessionsMap.delete(token);
  }

  /**
   * 获取特定客户端设备的权限 (无配置时默认全部开放)
   */
  public getDevicePermission(clientId: string): DevicePermission {
    const config = this.readConfig();
    if (!config || !config.devicePermissions || !config.devicePermissions[clientId]) {
      // 默认权限：全功能全天候开放
      return {
        allowUpload: true,
        allowEditDoc: true,
        allowCreateDoc: true
      };
    }
    return config.devicePermissions[clientId];
  }

  /**
   * 获取所有登记在册的设备权限字典
   */
  public getDevicePermissions(): Record<string, DevicePermission> {
    const config = this.readConfig();
    return config?.devicePermissions || {};
  }

  public getKnownDevices(): Record<string, KnownDevice> {
    const config = this.readConfig();
    return config?.knownDevices || {};
  }

  public registerDevice(device: Omit<KnownDevice, 'firstSeen' | 'lastSeen'>): boolean {
    const config = this.readConfig();
    if (!config) return false;

    if (!config.knownDevices) {
      config.knownDevices = {};
    }

    const previous = config.knownDevices[device.id];
    const now = Date.now();
    config.knownDevices[device.id] = {
      ...previous,
      ...device,
      nickname: device.nickname === '局域网伙伴' && previous?.nickname ? previous.nickname : device.nickname,
      avatar: device.avatar === 'avatar-1' && previous?.avatar ? previous.avatar : device.avatar,
      os: device.os === 'unknown' && previous?.os ? previous.os : device.os,
      role: previous && device.os !== 'unknown' ? previous.role : device.role,
      firstSeen: previous?.firstSeen || now,
      lastSeen: now
    };

    if (!config.devicePermissions) {
      config.devicePermissions = {};
    }
    if (!config.devicePermissions[device.id]) {
      config.devicePermissions[device.id] = {
        allowUpload: true,
        allowEditDoc: true,
        allowCreateDoc: true
      };
    }

    return this.saveConfig(config);
  }

  /**
   * 更新特定设备的特定功能权限项
   */
  public updateDevicePermission(clientId: string, key: keyof DevicePermission, value: boolean): boolean {
    const config = this.readConfig();
    if (!config) return false;

    if (!config.devicePermissions) {
      config.devicePermissions = {};
    }

    if (!config.devicePermissions[clientId]) {
      // 默认全开，按需重写
      config.devicePermissions[clientId] = {
        allowUpload: true,
        allowEditDoc: true,
        allowCreateDoc: true
      };
    }

    config.devicePermissions[clientId][key] = value;
    const ok = this.saveConfig(config);

    if (ok) {
      console.log(`[AuthService] 成功更新设备 ${clientId} 的权限项 ${key} -> ${value}`);
    }
    return ok;
  }
}
