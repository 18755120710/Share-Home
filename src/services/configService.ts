import fs from 'fs';
import path from 'path';

interface AppConfig {
  storagePath: string;
}

export class ConfigService {
  private static instance: ConfigService | null = null;
  private configFilePath: string;
  private currentConfig: AppConfig;

  private constructor() {
    this.configFilePath = path.join(process.cwd(), 'config-settings.json');
    this.currentConfig = this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * 从文件载入配置，若无则初始化默认配置
   */
  private loadConfig(): AppConfig {
    const defaultConfig: AppConfig = {
      storagePath: './storage',
    };

    try {
      if (fs.existsSync(this.configFilePath)) {
        const fileContent = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return {
          ...defaultConfig,
          ...parsed,
        };
      }
    } catch (err) {
      console.error('[ConfigService] 载入配置文件失败，将使用默认配置:', err);
    }

    // 若无配置文件，创建默认的配置文件
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * 保存配置到 config-settings.json 文件
   */
  private saveConfig(config: AppConfig): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ConfigService] 持久化保存配置文件失败:', err);
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AppConfig {
    return { ...this.currentConfig };
  }

  /**
   * 获取当前已解析的绝对存储路径，若目录不存在则自动创建
   */
  public getStoragePath(): string {
    const rawPath = this.currentConfig.storagePath;
    let resolvedPath = '';

    if (path.isAbsolute(rawPath)) {
      resolvedPath = rawPath;
    } else {
      resolvedPath = path.resolve(process.cwd(), rawPath);
    }

    // 确保物理目录存在
    try {
      if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
        console.log(`[ConfigService] 成功创建存储目录: ${resolvedPath}`);
      }
    } catch (err) {
      console.error(`[ConfigService] 物理目录创建失败: ${resolvedPath}`, err);
    }

    return resolvedPath;
  }

  /**
   * 动态更新存储路径配置
   */
  public updateStoragePath(newPath: string): boolean {
    if (!newPath || !newPath.trim()) return false;
    
    const sanitizedPath = newPath.trim();
    
    // 预检该路径是否能够成功创建或写入
    let testPath = '';
    if (path.isAbsolute(sanitizedPath)) {
      testPath = sanitizedPath;
    } else {
      testPath = path.resolve(process.cwd(), sanitizedPath);
    }

    try {
      if (!fs.existsSync(testPath)) {
        fs.mkdirSync(testPath, { recursive: true });
      }
      // 成功写入测试文件来验证写权限
      const testFile = path.join(testPath, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      console.error(`[ConfigService] 无法使用此存储路径（无写权限或路径无效）: ${sanitizedPath}`, err);
      return false;
    }

    // 更新内存及文件
    this.currentConfig.storagePath = sanitizedPath;
    this.saveConfig(this.currentConfig);
    console.log(`[ConfigService] 存储路径成功修改为: ${sanitizedPath}`);
    return true;
  }
}
