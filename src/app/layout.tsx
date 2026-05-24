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
        {/* 局域网开发模式静默拦截防御脚本：仅精确拦截 webpack-hmr，放行所有其他 WebSocket */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                const NativeWebSocket = window.WebSocket;
                class HmrMutedWebSocket {
                  constructor(url, protocols) {
                    const urlStr = url.toString();
                    // 仅精确拦截 webpack-hmr 路径，放行所有其他 WebSocket（包括业务 WS 和 Next.js 内部 dev client）
                    if (!urlStr.includes('/_next/webpack-hmr')) {
                      return new NativeWebSocket(url, protocols);
                    }
                    
                    this.readyState = 3; // CLOSED
                    this.binaryType = 'blob';
                    this.bufferedAmount = 0;
                    this.extensions = '';
                    this.protocol = '';
                    this.onopen = null;
                    this.onclose = null;
                    this.onerror = null;
                    this.onmessage = null;
                    this._listeners = {};
                    
                    var self = this;
                    setTimeout(function() {
                      if (typeof self.onerror === 'function') {
                        try { self.onerror(new Event('error')); } catch(e) {}
                      }
                      if (typeof self.onclose === 'function') {
                        try { self.onclose(new CloseEvent('close', { code: 1006, reason: 'LAN HMR Muted' })); } catch(e) {}
                      }
                      // 同时触发 addEventListener 注册的监听器
                      if (self._listeners['error']) {
                        self._listeners['error'].forEach(function(fn) { try { fn(new Event('error')); } catch(e) {} });
                      }
                      if (self._listeners['close']) {
                        self._listeners['close'].forEach(function(fn) { try { fn(new CloseEvent('close', { code: 1006, reason: 'LAN HMR Muted' })); } catch(e) {} });
                      }
                    }, 50);
                  }
                  close() {}
                  send() {}
                  addEventListener(type, fn) {
                    if (!this._listeners) this._listeners = {};
                    if (!this._listeners[type]) this._listeners[type] = [];
                    this._listeners[type].push(fn);
                  }
                  removeEventListener(type, fn) {
                    if (!this._listeners || !this._listeners[type]) return;
                    this._listeners[type] = this._listeners[type].filter(function(f) { return f !== fn; });
                  }
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
