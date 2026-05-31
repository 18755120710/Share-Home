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

export function useFileTransfer(self: any) {
  const selfId = self?.id;
  const selfNickname = self?.nickname;
  const selfOS = self?.os || 'Windows';
  const selfAvatar = self?.avatar || 'avatar-1';

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
      // 🌟 新增自愈逻辑：如果广播中的任务属于已完结状态 (failed, completed, rejected)，且它是当前正在弹窗提示本端接收的请求，则同步清空弹窗
      if (data.status === 'failed' || data.status === 'completed' || data.status === 'rejected') {
        setIncomingRequest(prev => {
          if (prev && prev.taskId === data.id) {
            return null;
          }
          return prev;
        });
      }
    });

    // 订阅传输被拒绝信号，置为失败并说明对方已拒绝
    const unsubReject = socket.subscribe('transfer:reject', (data: { taskId: string }) => {
      setTasks(prev => {
        const target = prev[data.taskId];
        if (!target) return prev;
        return {
          ...prev,
          [data.taskId]: {
            ...target,
            status: 'rejected',
            speed: 0
          }
        };
      });
      // 🌟 新增自愈逻辑：同步关闭接收该文件的提示弹窗，完成双端协作
      setIncomingRequest(prev => {
        if (prev && prev.taskId === data.taskId) {
          return null;
        }
        return prev;
      });
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
      unsubReject();
      unsubComplete();
    };
  }, []);

  // 1.5. 在初始化时，从后端拉取该客户端的历史互传任务列表，实现网页刷新后任务自愈
  useEffect(() => {
    if (!selfId) return;
    
    const fetchHistoryTasks = async () => {
      try {
        const res = await fetch(`/api/transfer/tasks?clientId=${encodeURIComponent(selfId)}`);
        const data = await res.json();
        if (data.success && data.tasks) {
          const tasksMap: Record<string, TransferTask> = {};
          data.tasks.forEach((t: any) => {
            tasksMap[t.id] = {
              id: t.id,
              fileName: t.fileName,
              fileSize: t.fileSize,
              transferredBytes: t.status === 'completed' ? t.fileSize : 0,
              progress: t.status === 'completed' ? 100 : 0,
              speed: 0,
              type: t.senderId === selfId ? 'send' : 'receive',
              status: t.status,
              peerId: t.senderId === selfId ? t.peerId : t.senderId,
              peerName: t.senderId === selfId ? t.peerName : t.senderName,
              startedAt: t.startedAt || Date.now(),
              error: t.status === 'rejected' ? '对方已拒绝接收该文件' : undefined,
              senderId: t.senderId,
              senderName: t.senderName,
              senderIp: t.senderIp,
              senderOS: t.senderOS,
              senderAvatar: t.senderAvatar,
              receiverId: t.peerId || t.receiverId,
              receiverName: t.peerName || t.receiverName,
              receiverIp: t.receiverIp,
              receiverOS: t.receiverOS,
              receiverAvatar: t.receiverAvatar
            };
            
            // 如果对方是接收者，且该任务目前还是待接收状态，则自动弹出接收面板
            if (t.peerId === selfId && t.status === 'pending') {
              setIncomingRequest({
                taskId: t.id,
                senderId: t.senderId,
                senderName: t.senderName,
                fileName: t.fileName,
                fileSize: t.fileSize,
                downloadUrl: t.downloadUrl
              });
            }
          });
          
          setTasks(prev => ({
            ...tasksMap,
            ...prev
          }));
        }
      } catch (err) {
        console.error('[useFileTransfer] 拉取互传历史任务失败:', err);
      }
    };
    
    fetchHistoryTasks();
  }, [selfId]);

  /**
   * 发送大文件给远端 Peer (核心物理大闭环)
   */
  const sendFile = async (
    targetPeer: any,
    file: File
  ) => {
    if (!selfId || !selfNickname) {
      alert('请等待系统初始化完毕！');
      return;
    }

    const targetPeerId = targetPeer.id;
    const targetPeerName = targetPeer.nickname;
    const targetPeerIp = targetPeer.ip;
    const targetPeerOS = targetPeer.os || 'Windows';
    const targetPeerAvatar = targetPeer.avatar || 'avatar-1';

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
      startedAt: Date.now(),
      senderId: selfId,
      senderName: selfNickname,
      senderIp: self?.ip || window.location.hostname || '127.0.0.1',
      senderOS: selfOS,
      senderAvatar: selfAvatar,
      receiverId: targetPeerId,
      receiverName: targetPeerName,
      receiverIp: targetPeerIp,
      receiverOS: targetPeerOS,
      receiverAvatar: targetPeerAvatar
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
        const selfIp = self?.ip || window.location.hostname || '127.0.0.1';
        const hostWithPort = typeof window !== 'undefined' ? window.location.host : `${selfIp}:3000`;
        const downloadUrl = `http://${hostWithPort}/api/transfer/download?taskId=${taskId}`;
        const res = await fetch(
          `/api/transfer/prepare?taskId=${taskId}&chunkIndex=${i}&totalChunks=${totalChunks}&fileName=${encodeURIComponent(file.name)}&fileSize=${file.size}` +
          `&targetClientId=${encodeURIComponent(targetPeerId)}&targetPeerName=${encodeURIComponent(targetPeerName)}` +
          `&senderId=${encodeURIComponent(selfId)}&senderName=${encodeURIComponent(selfNickname)}&downloadUrl=${encodeURIComponent(downloadUrl)}` +
          `&senderIp=${encodeURIComponent(selfIp)}&senderOS=${encodeURIComponent(selfOS)}&senderAvatar=${encodeURIComponent(selfAvatar)}` +
          `&receiverIp=${encodeURIComponent(targetPeerIp)}&receiverOS=${encodeURIComponent(targetPeerOS)}&receiverAvatar=${encodeURIComponent(targetPeerAvatar)}`,
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
    const downloadUrl = `http://${window.location.host}/api/transfer/download?taskId=${taskId}`;
    
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
   * 同意接收远端发来的文件 (触发本地浏览器真实拉取并保存，同时在面板联动显示流式进度)
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
      console.log(`[useFileTransfer] 正在为对等端拉起浏览器物理落地流式下载: ${fileName}`);
      
      // 🌟 局域网自愈转换：如果发送端处于 localhost 环境，它上报的 downloadUrl 也会带有 localhost。
      // 我们必须将 Host 部分动态替换为当前接收端自己成功访问的、100% 能够连通的局域网物理 Host（即 window.location.host）！
      let finalDownloadUrl = downloadUrl;
      try {
        const parsedUrl = new URL(downloadUrl);
        parsedUrl.host = window.location.host; // 动态替换为真实的物理局域网 Host 及其 3000 端口
        finalDownloadUrl = parsedUrl.toString();
        console.log(`[useFileTransfer] [局域网地址自愈] 将下载地址重定向至真实物理主机: ${finalDownloadUrl}`);
      } catch (e) {
        console.error('[useFileTransfer] 自愈转换 downloadUrl 失败:', e);
      }

      // 🌟 核心突破：直接拉起浏览器自身自带的文件下载与保存管理器，完美落地到本地磁盘！
      const link = document.createElement('a');
      link.href = finalDownloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
      console.error('[useFileTransfer] 启动浏览器附件流下载异常:', err);
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
   * 拒绝接收远端文件 (物理强擦缓存并状态落盘)
   */
  const rejectRequest = async () => {
    if (incomingRequest) {
      const socket = SocketClient.getInstance();
      socket.emit('transfer:reject', { taskId: incomingRequest.taskId });
      
      // 物理清理：向后端发送 POST 请求强行 unlink 发送端已合并暂存在 upload_cache 中的物理大文件，并落盘为 'rejected'
      try {
        await fetch('/api/transfer/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: incomingRequest.taskId, action: 'reject' })
        });
      } catch (e) {
        console.error('[useFileTransfer] 发送物理拒绝状态落盘失败:', e);
      }
    }
    setIncomingRequest(null);
  };

  /**
   * 中途取消发送或接收任务 (物理擦除大缓存并广播)
   */
  const cancelTransfer = async (taskId: string) => {
    // 1. 本地立即将状态标为失败 (已取消)
    setTasks(prev => {
      const target = prev[taskId];
      if (!target) return prev;
      return {
        ...prev,
        [taskId]: {
          ...target,
          status: 'failed',
          speed: 0
        }
      };
    });

    try {
      // 2. 向后端发送 POST 强行擦除磁盘暂存大文件，并更新数据库状态为 'failed'
      await fetch('/api/transfer/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action: 'cancel' })
      });
    } catch (e) {
      console.error('[useFileTransfer] 取消物理任务传输失败:', e);
    }
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

    if (isSuccess) {
      // 成功上传共享文件后，向日志服务上报审计日志
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: taskId,
            type: 'share',
            action: 'upload',
            title: `成功上传公共共享文件《${file.name}》`,
            operator: selfNickname || '本端设备',
            avatar: selfAvatar,
            details: {
              fileName: file.name,
              fileSize: file.size,
              deviceInfo
            },
            timestamp: Date.now()
          })
        });
      } catch (e) {
        console.error('[useFileTransfer] 共享文件上传成功日志上报异常:', e);
      }
    }

    return isSuccess;
  };

  /**
   * 物理删除单条任务记录
   */
  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/transfer/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action: 'delete' })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      } else {
        console.error('[useFileTransfer] 删除物理记录失败:', data.error);
      }
    } catch (err) {
      console.error('[useFileTransfer] 删除物理记录发生网络异常:', err);
    }
  };

  /**
   * 一键清空该客户端所有已完结的历史任务记录
   */
  const clearHistory = async () => {
    if (!selfId) return;
    try {
      const res = await fetch('/api/transfer/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', clientId: selfId })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(taskId => {
            const t = next[taskId];
            if (t && (t.status === 'completed' || t.status === 'failed' || t.status === 'rejected')) {
              delete next[taskId];
            }
          });
          return next;
        });
      } else {
        console.error('[useFileTransfer] 清空物理记录失败:', data.error);
      }
    } catch (err) {
      console.error('[useFileTransfer] 清空物理记录发生网络异常:', err);
    }
  };

  return {
    tasks,
    incomingRequest,
    sendFile,
    acceptRequest,
    rejectRequest,
    cancelTransfer,
    uploadPublicFile,
    deleteTask,
    clearHistory
  };
}
