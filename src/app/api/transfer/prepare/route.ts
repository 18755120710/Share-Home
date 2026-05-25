import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FileService } from '@/services/fileService';
import { ConfigService } from '@/services/configService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const chunkIndex = parseInt(searchParams.get('chunkIndex') || '0', 10);
    const totalChunks = parseInt(searchParams.get('totalChunks') || '1', 10);
    const fileName = searchParams.get('fileName') || 'file';
    const fileSize = parseInt(searchParams.get('fileSize') || '0', 10);
    const isPublic = searchParams.get('isPublic') === 'true';
    const deviceInfo = searchParams.get('deviceInfo') || '未知设备';

    if (!taskId) {
      return NextResponse.json({ success: false, error: '缺少 taskId' }, { status: 400 });
    }

    // 缓存文件夹
    const cacheDir = path.join(process.cwd(), 'upload_cache', taskId);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 将本分片写入临时文件
    const chunkPath = path.join(cacheDir, `chunk_${chunkIndex}`);
    
    // 读取二进制 Request Body
    const buffer = await request.arrayBuffer();
    fs.writeFileSync(chunkPath, Buffer.from(buffer));

    // 校验是否所有分片都已传输完成
    const files = fs.readdirSync(cacheDir);
    if (files.length === totalChunks) {
      // 执行大文件分片合并
      console.log(`[PrepareUpload] 收到全部 ${totalChunks} 个分片，正在合并大文件: ${fileName}`);
      
      const fileService = FileService.getInstance();
      const finalDir = isPublic ? fileService.getSharedDir() : ConfigService.getInstance().getStoragePath();
      
      // 合并目标物理路径 (如果重名，自动加时间戳防覆盖)
      let finalPath = path.join(finalDir, fileName);
      if (fs.existsSync(finalPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        finalPath = path.join(finalDir, `${base}_${Date.now()}${ext}`);
      }

      // 1. 开始合并写入目标文件
      const writeStream = fs.createWriteStream(finalPath);
      
      try {
        for (let i = 0; i < totalChunks; i++) {
          const partPath = path.join(cacheDir, `chunk_${i}`);
          const data = fs.readFileSync(partPath);
          writeStream.write(data);
        }
      } catch (writeErr) {
        writeStream.end();
        throw writeErr;
      }

      // 2. 等待文件物理写入结束 (避免未写完即触发下步动作)
      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      // 3. 异步清理临时分片目录，含 EBUSY/EPERM 锁重试策略 (Windows 杀毒软件自动锁定防护友好)
      const cleanupCacheAsync = async (dirPath: string, maxRetries = 5) => {
        try {
          if (!fs.existsSync(dirPath)) return;
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            let unlinked = false;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                fs.unlinkSync(filePath);
                unlinked = true;
                break;
              } catch (e: any) {
                if (e.code === 'EBUSY' || e.code === 'EPERM') {
                  // 针对 Windows 平台，遭遇锁定时等待一段时间重试
                  await new Promise(r => setTimeout(r, 150));
                } else {
                  throw e;
                }
              }
            }
            if (!unlinked) {
              console.warn(`[PrepareUpload] 警告: 分片可能被其他进程长期锁定，无法完成物理删除: ${filePath}`);
            }
          }
          
          // 分片删除后，移除外层 taskId 文件夹
          try {
            if (fs.existsSync(dirPath)) {
              fs.rmdirSync(dirPath);
            }
          } catch (e) {
            // 稍后兜底清除
            setTimeout(() => {
              try {
                if (fs.existsSync(dirPath)) fs.rmdirSync(dirPath);
              } catch {}
            }, 3000);
          }
        } catch (cleanupErr) {
          console.error('[PrepareUpload] 异步清理临时分片缓存时异常:', cleanupErr);
        }
      };

      // 触发异步清理 (不阻塞主请求返回，秒级回执)
      cleanupCacheAsync(cacheDir);

      const actualName = path.basename(finalPath);
      
      if (isPublic) {
        // 向 FileService 注册为公共共享文件，记录设备平台信息并持久化
        fileService.registerSharedFile(taskId, actualName, fileSize, finalPath, deviceInfo);
      } else {
        // 向本地 FileService 注册为允许他人下载的实体
        fileService.registerUpload(taskId, finalPath, actualName, fileSize);

        // 提取互传参与者的所有元数据，并进行 JSON 持久化落盘注册
        const targetClientId = searchParams.get('targetClientId') || '';
        const targetPeerName = searchParams.get('targetPeerName') || '未知伙伴';
        const senderId = searchParams.get('senderId') || '';
        const senderName = searchParams.get('senderName') || '局域网伙伴';
        const downloadUrl = searchParams.get('downloadUrl') || '';

        // 🌟 新增的高保真局域网多维信息
        const senderIp = searchParams.get('senderIp') || '';
        const senderOS = searchParams.get('senderOS') || 'Windows';
        const senderAvatar = searchParams.get('senderAvatar') || 'avatar-1';
        const receiverIp = searchParams.get('receiverIp') || '';
        const receiverOS = searchParams.get('receiverOS') || 'Windows';
        const receiverAvatar = searchParams.get('receiverAvatar') || 'avatar-1';

        fileService.registerTransferTask(taskId, {
          id: taskId,
          fileName: actualName,
          fileSize,
          status: 'pending',
          type: 'send',
          progress: 100,
          peerId: targetClientId,
          peerName: targetPeerName,
          senderId,
          senderName,
          downloadUrl,
          startedAt: Date.now(),
          
          // 物理落盘记录
          senderIp,
          senderOS,
          senderAvatar,
          receiverId: targetClientId,
          receiverName: targetPeerName,
          receiverIp,
          receiverOS,
          receiverAvatar
        });
      }

      return NextResponse.json({
        success: true,
        status: 'merged',
        fileName: actualName,
        filePath: finalPath
      });
    }

    return NextResponse.json({
      success: true,
      status: 'chunk_received',
      chunkIndex,
      totalChunks
    });
  } catch (err: any) {
    console.error('[PrepareUpload] 分片处理异常:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
