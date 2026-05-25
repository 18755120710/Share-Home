import { useState, useEffect } from 'react';
import { TransferTask } from '../types/transfer';
import { generateUUID } from '../lib/utils';
import { SocketClient } from '../lib/socketClient';

export interface IncomingRequest {
  taskId: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
}

export function useFileTransfer(selfId: string | undefined, selfNickname: string | undefined) {
  // 维护所有正在进行与已完成的传输任务
  const [tasks, setTasks] = useState<Record<string, TransferTask>>({});
  
  // 缓存远端发来的接收文件请求 (同一时间只弹窗处理一个)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);

  // 1. 统一订阅全局共享 WebSocket 监听，动态捕获文件传输的物理进度
  useEffect(() => {
    const socket = SocketClient.getInstance();

    // 订阅局域网大文件互传请求信令
    const unsubRequest = socket.subscribe('transfer:request', (data: IncomingRequest) => {
      setIncomingRequest(data);
    });

    // 订阅高速拉取进度广播
    const unsubProgress = socket.subscribe('transfer:progress', (data: TransferTask) => {
      setTasks(prev => ({
        ...prev,
        [data.id]: data
      }));
    });

    // 订阅传输完成信号
    const unsubComplete = socket.subscribe('transfer:complete', (data: { taskId: string; filePath: string }) => {
      setTasks(prev => {
        const target = prev[data.taskId];
        if (!target) return prev;
        return {
          ...prev,
          [data.taskId]: {
            ...target,
            status: 'completed',
            progress: 100,
            speed: 0
          }
        };
      });
    });

    return () => {
      unsubRequest();
      unsubProgress();
      unsubComplete();
    };
  }, []);

  /**
   * 发送大文件给远端 Peer (核心物理大闭环)
   */
  const sendFile = async (
    targetPeerIp: string,
    targetPeerPort: number,
    targetPeerId: string,
    targetPeerName: string,
    file: File
  ) => {
    if (!selfId || !selfNickname) {
      alert('请等待系统初始化完毕！');
      return;
    }

    const taskId = generateUUID();
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 一个分片
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. 在本地任务栏注册一个发送任务
    const newTask: TransferTask = {
      id: taskId,
      fileName: file.name,
      fileSize: file.size,
      transferredBytes: 0,
      progress: 0,
      speed: 0,
      type: 'send',
      status: 'pending',
      peerId: targetPeerId,
      peerName: targetPeerName,
      startedAt: Date.now()
    };

    setTasks(prev => ({ ...prev, [taskId]: newTask }));

    // 2. 本机自循环极速分片暂存 (浏览器 -> 本地 Node.js 后端)
    console.log(`[useFileTransfer] 正在以本机高带宽暂存文件: ${file.name}, 总共 ${totalChunks} 分片`);
    
    let isSuccess = true;
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      // 更新本端准备进度
      setTasks(prev => {
        const target = prev[taskId];
        if (!target) return prev;
        return {
          ...prev,
          [taskId]: {
            ...target,
            status: 'transferring',
            progress: Math.round(((i + 1) / totalChunks) * 100),
            speed: 50 * 1024 * 1024 
          }
        };
      });

      try {
        const arrayBuffer = await chunk.arrayBuffer();
        const res = await fetch(
          `/api/transfer/prepare?taskId=${taskId}&chunkIndex=${i}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(file.name)}&fileSize=${file.size}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: arrayBuffer
          }
        );
        
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || '分片写入失败');
        }
      } catch (err: any) {
        console.error(`[useFileTransfer] 分片 ${i} 投递失败:`, err);
        isSuccess = false;
        break;
      }
    }

    if (!isSuccess) {
      setTasks(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'failed',
          error: '本机文件暂存合并失败'
        }
      }));
      return;
    }

    // 3. 本地合并注册完毕，向远端 Peer 发送文件传输请求
    const selfIp = window.location.hostname; // 获取自身 IP 供对方拉取
    const downloadUrl = `http://${selfIp}:3000/api/transfer/download?taskId=${taskId}`;
    
    console.log(`[useFileTransfer] 本地暂存合并完毕！正在向对方投递接收申请...`);

    try {
      const socket = SocketClient.getInstance();
      const sendSuccess = socket.emit('transfer:request', {
        targetClientId: targetPeerId, // 将目标 ClientId 带上，供服务端中转
        taskId,
        senderId: selfId,
        senderName: selfNickname,
        fileName: file.name,
        fileSize: file.size,
        downloadUrl
      });

      if (sendSuccess) {
        // 等待对方点击接收，状态置为 pending
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            status: 'pending',
            speed: 0
          }
        }));
      } else {
        throw new Error('WebSocket 信道未就绪或连接断开，请刷新页面重试');
      }
    } catch (err: any) {
      console.error('[useFileTransfer] 跨机投递握手失败:', err);
      setTasks(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'failed',
          error: `投递握手失败: ${err.message}`
        }
      }));
    }
  };

  /**
   * 同意接收远端发来的文件 (触发本地宿主启动拉取)
   */
  const acceptRequest = async () => {
    if (!incomingRequest) return;
    
    const { taskId, fileName, fileSize, downloadUrl, senderId, senderName } = incomingRequest;
    
    // 1. 在本地任务栏注册一个接收任务
    const newTask: TransferTask = {
      id: taskId,
      fileName,
      fileSize,
      transferredBytes: 0,
      progress: 0,
      speed: 0,
      type: 'receive',
      status: 'transferring',
      peerId: senderId,
      peerName: senderName,
      startedAt: Date.now()
    };
    
    setTasks(prev => ({ ...prev, [taskId]: newTask }));
    setIncomingRequest(null); // 关闭弹窗

    try {
      const res = await fetch('/api/transfer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          fileName,
          fileSize,
          downloadUrl,
          peerId: senderId,
          peerName: senderName
        })
      });
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '下载任务启动失败');
      }
    } catch (err: any) {
      console.error('[useFileTransfer] 启动本地流式下载异常:', err);
      setTasks(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'failed',
          error: err.message
        }
      }));
    }
  };

  /**
   * 拒绝接收远端文件
   */
  const rejectRequest = () => {
    setIncomingRequest(null);
  };

  /**
   * 上传文件到公共共享空间 (本机直接落盘合并)
   */
  const uploadPublicFile = async (
    file: File,
    deviceInfo: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> => {
    const taskId = generateUUID();
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 一个分片
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    console.log(`[useFileTransfer] 正在以上传共享文件: ${file.name}, 总共 ${totalChunks} 分片, 设备: ${deviceInfo}`);
    
    let isSuccess = true;
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const currentProgress = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress(currentProgress);
      }

      try {
        const arrayBuffer = await chunk.arrayBuffer();
        const res = await fetch(
          `/api/transfer/prepare?taskId=${taskId}&chunkIndex=${i}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(file.name)}&fileSize=${file.size}&isPublic=true&deviceInfo=${encodeURIComponent(deviceInfo)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: arrayBuffer
          }
        );
        
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || '分片写入失败');
        }
      } catch (err: any) {
        console.error(`[useFileTransfer] 公共分片 ${i} 投递失败:`, err);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  };

  return {
    tasks,
    incomingRequest,
    sendFile,
    acceptRequest,
    rejectRequest,
    uploadPublicFile
  };
}
