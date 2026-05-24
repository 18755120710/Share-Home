export type TransferStatus = 'pending' | 'transferring' | 'paused' | 'completed' | 'failed';

export interface TransferTask {
  /** 任务唯一 UUID */
  id: string;
  /** 文件名 */
  fileName: string;
  /** 文件总大小 (字节) */
  fileSize: number;
  /** 已成功传输字节数 */
  transferredBytes: number;
  /** 传输进度 (百分比, 0-100) */
  progress: number;
  /** 实时传输速度 (字节/秒) */
  speed: number;
  /** 任务类型: 'send' 代表发送出去, 'receive' 代表接收 */
  type: 'send' | 'receive';
  /** 任务当前状态 */
  status: TransferStatus;
  /** 对方设备 ID */
  peerId: string;
  /** 对方设备名称 (冗余缓存方便直接显示) */
  peerName: string;
  /** 异常错误描述 */
  error?: string;
  /** 任务启动时间戳 */
  startedAt: number;
}

/** 局域网传输控制 WebSocket 信令结构 */
export interface TransferSignal {
  type: 'request' | 'accept' | 'reject' | 'cancel' | 'progress' | 'complete';
  taskId: string;
  senderId: string;
  receiverId: string;
  fileName?: string;
  fileSize?: number;
  chunkIndex?: number;
  totalChunks?: number;
  error?: string;
}
