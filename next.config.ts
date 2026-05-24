import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网所有设备在开发模式下正常访问（Next.js 16 安全机制要求）
  allowedDevOrigins: [
    'http://10.100.50.194:3000',
    'http://192.168.*:3000',
    'http://10.*:3000',
    'http://172.16.*:3000',
    'http://172.17.*:3000',
    'http://172.18.*:3000',
    'http://172.19.*:3000',
    'http://172.20.*:3000',
    'http://172.21.*:3000',
    'http://172.22.*:3000',
    'http://172.23.*:3000',
    'http://172.24.*:3000',
    'http://172.25.*:3000',
    'http://172.26.*:3000',
    'http://172.27.*:3000',
    'http://172.28.*:3000',
    'http://172.29.*:3000',
    'http://172.30.*:3000',
    'http://172.31.*:3000',
  ],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;

