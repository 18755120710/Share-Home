/**
 * Share Home 核心双向自适应哈希引擎 (Dual Hash Engine)
 * 
 * 架构考量：
 * 1. 优先尝试动态加载 Rust 编译出的 WebAssembly 模块实现 XXH3 极速分片哈希。
 * 2. 如果 Wasm 模块未编译、加载失败或环境不支持，自动无缝降级到：
 *    - 浏览器端：使用原生底层硬件加速的 `crypto.subtle.digest` (SHA-256)
 *    - Node.js端：使用原生 `crypto` 模块的极速 SHA-256 (C++底座)
 * 3. 从而保证了在没有安装 Rust 编译环境的系统上仍然能 100% 正常、极速且稳定运行。
 */

// 尝试导入 WASM 模块 (Next.js 支持通过 webpack async import)
let wasmModule: any = null;

async function tryLoadWasm() {
  try {
    // 动态引入 Rust WASM 编译出的 JS 胶水代码
    // @ts-ignore
    wasmModule = await import('@/rust-wasm/pkg/share_home_wasm');
    console.log('[HashEngine] Rust WebAssembly 硬件加速引擎加载成功！');
  } catch (e) {
    console.warn('[HashEngine] 未检测到已编译的 Rust WASM 模块，已无缝降级至系统原生硬件加速引擎。');
  }
}

// 自动在初始化时尝试加载
if (typeof window !== 'undefined') {
  tryLoadWasm();
}

/**
 * 计算整个字节流的快速指纹哈希
 * @param data 字节流
 */
export async function calculateFileHash(data: Uint8Array): Promise<string> {
  // 1. 优先使用 Rust Wasm 极速 xxhash3
  if (wasmModule && typeof wasmModule.calculate_xxhash3 === 'function') {
    try {
      return wasmModule.calculate_xxhash3(data);
    } catch (err) {
      console.error('[HashEngine] Wasm xxHash 计算失败，执行降级:', err);
    }
  }

  // 2. 浏览器环境 Fallback：使用原生 Web Crypto API (底层为浏览器 C++ 硬件加速，性能极强且不阻塞主线程)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 3. Node.js 环境 Fallback：使用原生 crypto 模块
  if (typeof process !== 'undefined') {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
    } catch (e) {
      // 最终沙箱兜底
      return mockSimpleHash(data);
    }
  }

  return mockSimpleHash(data);
}

/**
 * 计算大文件单片分块的哈希值
 * @param chunkData 分块字节流
 * @param chunkIndex 分块序号
 */
export async function calculateChunkHash(chunkData: Uint8Array, chunkIndex: number): Promise<string> {
  if (wasmModule && typeof wasmModule.process_chunk_hash === 'function') {
    try {
      return wasmModule.process_chunk_hash(chunkData, chunkIndex);
    } catch (err) {
      // 忽略错误，走兜底
    }
  }
  const chunkHash = await calculateFileHash(chunkData);
  return `${chunkIndex}:${chunkHash}`;
}

/**
 * 局域网极简非密码学 CRC32/Murmur 级极速哈希兜底 (当所有系统底层硬件加速均不可用时)
 */
function mockSimpleHash(data: Uint8Array): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) + hash + data[i];
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
