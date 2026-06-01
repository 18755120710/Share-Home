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
  admin2faEnabled?: boolean;
  admin2faSecret?: string;
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
   * 获取管理员的用户名
   */
  public getAdminUsername(): string {
    const config = this.readConfig();
    return config?.adminUsername || 'admin';
  }

  /**
   * 验证并修改管理员账号密码
   */
  public updateAdminAuth(currentPass: string, newUsername: string, newPassword?: string): { success: boolean; message: string } {
    const config = this.readConfig();
    if (!config) return { success: false, message: '配置未初始化' };

    // 1. 验证当前密码是否正确
    const { hash: currentHash } = this.hashPassword(currentPass, config.adminSalt);
    if (currentHash !== config.adminHash) {
      return { success: false, message: '当前管理员密码验证失败，请重新输入。' };
    }

    // 2. 更新用户名
    if (!newUsername.trim()) {
      return { success: false, message: '管理员用户名不能为空。' };
    }
    config.adminUsername = newUsername.trim();

    // 3. 如果需要修改密码
    if (newPassword && newPassword.trim().length > 0) {
      if (newPassword.trim().length < 6) {
        return { success: false, message: '新密码长度不能小于 6 位。' };
      }
      const { salt, hash } = this.hashPassword(newPassword.trim());
      config.adminSalt = salt;
      config.adminHash = hash;
    }

    const saved = this.saveConfig(config);
    if (saved) {
      return { success: true, message: '管理员账号及密码更新成功。' };
    } else {
      return { success: false, message: '配置写入磁盘失败。' };
    }
  }

  // ==================== 2FA (两步验证 / TOTP) 核心安全编解码与时间窗校验算法 ====================

  /**
   * 原生 Base32 解码 (TOTP 秘钥解析)
   */
  private static base32Decode(base32Str: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanStr = base32Str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bufferList: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const val = alphabet.indexOf(cleanStr[i]);
      if (val === -1) continue;
      value = (value << 5) | val;
      bits += 5;
      if (bits >= 8) {
        bufferList.push((value >> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bufferList);
  }

  /**
   * 原生 Base32 编码 (用于生成 2FA 随机密钥文本)
   */
  public static base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  /**
   * 原生 TOTP (RFC 6238) 算法实现：生成特定时间窗的 6 位验证码
   */
  private static generateTOTP(secretBase32: string, timeStepIndex: number): string {
    const key = AuthService.base32Decode(secretBase32);
    // 时间步数转换为 8 字节大端字节序 buffer
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(timeStepIndex / 0x100000000), 0);
    buffer.writeUInt32BE(timeStepIndex % 0x100000000, 4);

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = code % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * 判断管理员是否已开启 2FA 两步验证
   */
  public isAdmin2faEnabled(): boolean {
    const config = this.readConfig();
    return !!(config && config.admin2faEnabled && config.admin2faSecret);
  }

  /**
   * 验证已经正式启用的管理员 2FA 动态验证码 (包含 ±30s 时钟容差校验)
   */
  public verifyAdmin2Fa(code: string): boolean {
    const config = this.readConfig();
    if (!config || !config.admin2faEnabled || !config.admin2faSecret) return false;

    return this.verifyCodeWithSecret(config.admin2faSecret, code);
  }

  /**
   * 验证暂未启用的临时 2FA 秘钥验证码 (用于扫码确认绑定)
   */
  public verifyTemp2Fa(secret: string, code: string): boolean {
    if (!secret || !code) return false;
    return this.verifyCodeWithSecret(secret, code);
  }

  /**
   * 对指定 Base32 密钥进行 TOTP 的时间窗校验 (包含时间窗误差偏移)
   */
  private verifyCodeWithSecret(secretBase32: string, code: string): boolean {
    const cleanCode = code.trim();
    if (cleanCode.length !== 6 || isNaN(Number(cleanCode))) return false;

    const currentStep = Math.floor(Date.now() / 30000);
    // 容差窗口：允许 -1, 0, +1 误差窗口，以处理服务端与客户端的时钟微调不一致
    for (let offset = -1; offset <= 1; offset++) {
      const expected = AuthService.generateTOTP(secretBase32, currentStep + offset);
      if (expected === cleanCode) {
        return true;
      }
    }
    return false;
  }

  /**
   * 真正将 2FA 两步验证密钥写入磁盘，并在配置中启用 2FA 状态
   */
  public enableAdmin2Fa(secret: string): boolean {
    const config = this.readConfig();
    if (!config) return false;

    config.admin2faEnabled = true;
    config.admin2faSecret = secret.trim();

    return this.saveConfig(config);
  }

  /**
   * 验证静态密码，关闭管理员两步验证并清理秘钥配置落盘
   */
  public disableAdmin2Fa(currentPass: string): { success: boolean; message: string } {
    const config = this.readConfig();
    if (!config) return { success: false, message: '配置未初始化' };

    // 验证静态密码
    const { hash: currentHash } = this.hashPassword(currentPass, config.adminSalt);
    if (currentHash !== config.adminHash) {
      return { success: false, message: '当前管理员密码验证失败，请重新输入。' };
    }

    config.admin2faEnabled = false;
    delete config.admin2faSecret;

    const saved = this.saveConfig(config);
    if (saved) {
      return { success: true, message: '两步验证 (2FA) 已成功关闭并注销手机绑定。' };
    } else {
      return { success: false, message: '密码校验成功，但写入磁盘配置失败。' };
    }
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
