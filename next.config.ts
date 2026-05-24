import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev, isServer }) => {
    // 启用 WebAssembly 与 Layers
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // 如果在开发环境的客户端打包中，强制 HMR 链接指向 localhost 避免局域网其他设备控制台爆红
    if (dev && !isServer) {
      const entry = config.entry;
      config.entry = async () => {
        const entries = await entry();
        // 遍历入口文件，修改 webpack-hot-middleware-client 的参数
        for (const key in entries) {
          if (Array.isArray(entries[key])) {
            entries[key] = entries[key].map((item: string) => {
              if (item.includes('webpack-hot-middleware-client')) {
                // 强制指定 HMR 连接 localhost，非本机设备将静默放弃 HMR 连接
                return item + '&host=localhost&port=3000';
              }
              return item;
            });
          }
        }
        return entries;
      };
    }

    return config;
  },
};

export default nextConfig;

