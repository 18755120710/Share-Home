use wasm_bindgen::prelude::*;
use xxhash_rust::xxh3::xxh3_64;
use sha2::{Sha256, Digest};
use js_sys::Uint8Array;

/// 计算字节流的 XXH3 64位高性能非加密哈希值，返回十六进制字符串。
/// xxHash 极度契合大文件快速校验，速度可跑满物理网卡。
#[wasm_bindgen]
pub fn calculate_xxhash3(data: &Uint8Array) -> String {
    let bytes = data.to_vec();
    let hash_value = xxh3_64(&bytes);
    format!("{:016x}", hash_value)
}

/// 计算字节流的 SHA-256 加密哈希值，返回十六进制字符串。
/// 适用于对安全性校验要求较高的场景。
#[wasm_bindgen]
pub fn calculate_sha256(data: &Uint8Array) -> String {
    let bytes = data.to_vec();
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// 计算大文件分片信息，根据块大小 (Chunk Size) 计算出总块数。
#[wasm_bindgen]
pub fn calculate_chunks_count(file_size: f64, chunk_size: f64) -> u32 {
    if file_size <= 0.0 || chunk_size <= 0.0 {
        return 0;
    }
    (file_size / chunk_size).ceil() as u32
}

/// 快速辅助函数：校验单块的哈希，并返回当前分片指纹与总体序号
#[wasm_bindgen]
pub fn process_chunk_hash(chunk_data: &Uint8Array, chunk_index: u32) -> String {
    let hash_str = calculate_xxhash3(chunk_data);
    format!("{}:{}", chunk_index, hash_str)
}
