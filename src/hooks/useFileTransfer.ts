import { useState, useEffect, useRef } from 'react';
import { TransferTask } from '../types/transfer';
import { generateUUID } from '../lib/utils';

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
  
  const wsRef = useRef<WebSocket | null>(null);

  // 1. 建立与本地后端的 WebSocket 监听，动态捕获文件传输的物理进度
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const { event: evName, data } = JSON.parse(event.data);
        
        switch (evName) {
          case 'transfer:request':
            // 收到局域网其他设备发来的发送大文件申请
            setIncomingRequest(data as IncomingRequest);
            break;
            
          case 'transfer:progress':
            // 收到本地 Node.js 汇报的高速下载进度与速度
            const updatedTask = data as TransferTask;
            setTasks(prev => ({
              ...prev,
              [updatedTask.id]: updatedTask
            }));
            break;
            
          case 'transfer:complete':
            // 本地大文件极速接收完成
            const completeInfo = data as { taskId: string; filePath: string };
            setTasks(prev => {
              const target = prev[completeInfo.taskId];
              if (!target) return prev;
              return {
                ...prev,
                [completeInfo.taskId]: {
                  ...target,
                  status: 'completed',
                  progress: 100,
                  speed: 0
                }
              };
            });
            break;
            
          default:
            break;
        }
      } catch (err) {
        // 忽略非标帧
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  /**
   * 发送大文件给远端 Peer (核心物理大闭环)
   * @param targetPeerIp 对方 IP
   * @param targetPeerPort 对方运行端口
   * @param targetPeerId 对方 Peer ID
   * @param targetPeerName 对方昵称
   * @param file 浏览器拖拽的 File 实体
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
            // 本地缓存时假定一个速度
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
      const res = await fetch(`http://${targetPeerIp}:${targetPeerPort}/api/transfer/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          senderId: selfId,
          senderName: selfNickname,
          fileName: file.name,
          fileSize: file.size,
          downloadUrl
        })
      });

      const data = await res.json();
      if (data.success) {
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
        throw new Error(data.error || '对方服务异常');
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
      // 调用自己本地后端 API 启动高速拉取
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

  return {
    tasks,
    incomingRequest,
    sendFile,
    acceptRequest,
    rejectRequest
  };
}
