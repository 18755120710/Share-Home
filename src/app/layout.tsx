import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Share Home - 局域网去中心化协作办公平台",
  description: "一款专为局域网办公打造的去中心化、私密极速、零配置的点对点文件收发与飞书级云文档知识库协作平台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* 局域网全局主题防闪烁预设置脚本 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', savedTheme);
              } catch (e) {}
            `
          }}
        />
        {/* 局域网开发模式静默拦截防御脚本：防止非本地开发终端请求 Next.js HMR 导致控制台报错 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                const NativeWebSocket = window.WebSocket;
                class HmrMutedWebSocket {
                  constructor(url, protocols) {
                    const urlStr = url.toString();
                    if (!urlStr.includes('/_next/webpack-hmr') && !urlStr.includes(':3000')) {
                      return new NativeWebSocket(url, protocols);
                    }
                    
                    console.log('[HMR Muter] 已静默释放外部终端的开发期 HMR 订阅: ' + urlStr);
                    
                    this.readyState = 3; // CLOSED
                    this.binaryType = 'blob';
                    this.bufferedAmount = 0;
                    this.extensions = '';
                    this.protocol = '';
                    this.onopen = null;
                    this.onclose = null;
                    this.onerror = null;
                    this.onmessage = null;
                    
                    setTimeout(() => {
                      if (typeof this.onerror === 'function') {
                        try { this.onerror(new Event('error')); } catch(e) {}
                      }
                      if (typeof this.onclose === 'function') {
                        try { this.onclose(new CloseEvent('close', { code: 1006, reason: 'LAN HMR Muted' })); } catch(e) {}
                      }
                    }, 50);
                  }
                  close() {}
                  send() {}
                  addEventListener() {}
                  removeEventListener() {}
                  dispatchEvent() { return true; }
                }
                HmrMutedWebSocket.CONNECTING = 0;
                HmrMutedWebSocket.OPEN = 1;
                HmrMutedWebSocket.CLOSING = 2;
                HmrMutedWebSocket.CLOSED = 3;
                window.WebSocket = HmrMutedWebSocket;
              }
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
