import type { NextConfig } from "next";
import os from "os";

function getLocalIPv4Hosts(): string[] {
  const hosts = new Set<string>();
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    if (!addresses) continue;

    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        hosts.add(address.address);
      }
    }
  }

  return Array.from(hosts);
}

const nextConfig: NextConfig = {
  // Next.js 16 校验的是 Origin/Referer 的 hostname，不包含协议和端口。
  allowedDevOrigins: [
    ...getLocalIPv4Hosts(),
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
