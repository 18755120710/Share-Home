import React, { useState, useEffect, useRef } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { formatBytes } from '@/lib/format';
import { SocketClient } from '@/lib/socketClient';
import { 
  UploadCloud, File, Trash2, Download, Monitor, Laptop, 
  Smartphone, Cpu, HelpCircle, CheckCircle2, AlertCircle 
} from 'lucide-react';

interface SharedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  deviceInfo: string;
  filePath: string;
}

interface SharedFilesProps {
  uploadPublicFile: (
    file: File,
    deviceInfo: string,
    onProgress?: (progress: number) => void
  ) => Promise<boolean>;
}

// 客户端设备信息获取
function getDeviceInfo(): string {
  if (typeof window === 'undefined') return '未知设备';
  const ua = window.navigator.userAgent;
  
  if (/android/i.test(ua)) {
    return 'Android';
  }
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'iOS';
  }
  if (/macintosh|mac os x/i.test(ua)) {
    return 'macOS';
  }
  if (/windows nt/i.test(ua)) {
    if (/windows nt 10.0/i.test(ua)) {
      return 'Windows 11';
    }
    return 'Windows 10';
  }
  if (/linux/i.test(ua)) {
    return 'Linux';
  }
  return '未知设备';
}

export const SharedFiles: React.FC<SharedFilesProps> = ({ uploadPublicFile }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 初始化拉取公共文件列表
  const fetchSharedFiles = async () => {
    try {
      const res = await fetch('/api/transfer/shared');
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error('[SharedFiles] 拉取公共共享文件列表失败:', err);
    }
  };

  useEffect(() => {
    fetchSharedFiles();

    // 2. 订阅局域网公共文件列表更新 WebSocket 事件 (所有伙伴共享)
    const socket = SocketClient.getInstance();
    const unsubSharedUpdate = socket.subscribe('shared-files:update', (updatedFiles: SharedFile[]) => {
      console.log('[SharedFiles] 收到局域网公共文件列表广播更新:', updatedFiles);
      setFiles(updatedFiles);
    });

    return () => {
      unsubSharedUpdate();
    };
  }, []);

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (status === 'uploading') return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleUpload(droppedFiles[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (status === 'uploading') return;
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleUpload(selectedFiles[0]);
    }
  };

  // 核心上传逻辑
  const handleUpload = async (file: File) => {
    if (!file) return;

    setUploadingFile(file);
    setUploadProgress(0);
    setStatus('uploading');
    setErrorMsg('');

    try {
      const deviceInfo = getDeviceInfo();
      const success = await uploadPublicFile(file, deviceInfo, (progress) => {
        setUploadProgress(progress);
      });

      if (success) {
        setStatus('success');
        setTimeout(() => {
          setStatus('idle');
          setUploadingFile(null);
          setUploadProgress(0);
        }, 2000);
        // 主动刷新一次 (后端其实也会广播)
        fetchSharedFiles();
      } else {
        setStatus('error');
        setErrorMsg('上传分片合并失败');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || '上传异常');
    }
  };

  // 删除文件逻辑
  const handleDelete = async (id: string) => {
    if (!confirm('确认要物理删除此共享文件吗？删除后局域网其他伙伴将无法下载。')) return;

    try {
      const res = await fetch(`/api/transfer/shared?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        // 后端会广播更新，这里拉取作为兜底
        fetchSharedFiles();
      } else {
        alert(`删除失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`删除异常: ${err.message}`);
    }
  };

  // 根据设备信息渲染不同的专属高端 Badge 图标
  const renderDeviceBadge = (deviceInfo: string) => {
    let icon = <HelpCircle size={12} />;
    let badgeClass = 'device-badge general';

    if (deviceInfo.includes('Windows')) {
      icon = <Laptop size={12} />;
      badgeClass = 'device-badge windows';
    } else if (deviceInfo.includes('macOS') || deviceInfo.includes('iOS')) {
      icon = <Monitor size={12} />;
      badgeClass = 'device-badge macos';
    } else if (deviceInfo.includes('Android')) {
      icon = <Smartphone size={12} />;
      badgeClass = 'device-badge android';
    } else if (deviceInfo.includes('Linux')) {
      icon = <Cpu size={12} />;
      badgeClass = 'device-badge linux';
    }

    return (
      <span className={badgeClass} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 600,
        transition: 'all 0.15s'
      }}>
        {icon}
        {deviceInfo}
      </span>
    );
  };

  return (
    <Card style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '400px' }}>
      
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}>公共文件共享空间</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            上传至局域网公共盘，即使没有其他设备连接，文件也能长效持久保存
          </p>
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          共享文件数: {files.length} 个
        </span>
      </div>

      {/* 拖拽/点击上传热区 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        style={{
          border: isDragOver ? '2px dashed var(--accent-color)' : '1px dashed var(--border-color)',
          background: isDragOver ? 'var(--accent-glow)' : 'var(--bg-item)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 20px',
          textAlign: 'center',
          cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={status === 'uploading'}
        />

        {status === 'idle' && (
          <>
            <UploadCloud size={28} style={{ color: 'var(--text-secondary)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>点击选择或将文件拖拽到此处</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>支持任意格式的超大文件局域网极速合并上传</span>
            </div>
          </>
        )}

        {status === 'uploading' && uploadingFile && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                正在极速分片上传: {uploadingFile.name}
              </span>
              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
                borderRadius: '2px',
                transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 8px var(--accent-color)'
              }} />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              文件大小: {formatBytes(uploadingFile.size)} · 本地极速通道暂存中...
            </span>
          </div>
        )}

        {status === 'success' && uploadingFile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--success-color)' }}>
            <CheckCircle2 size={26} className="animate-pulse" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>共享上传成功！文件已在服务器物理落盘</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>已自动同步广播给所有局域网设备</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--error-color)' }}>
            <AlertCircle size={26} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>上传失败</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{errorMsg || '发生了未知错误'}</span>
          </div>
        )}
      </div>

      {/* 共享文件列表 */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        maxHeight: '320px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-item)'
      }}>
        {files.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '50px 0',
            opacity: 0.4
          }}>
            <File size={26} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>暂无公共共享文件，拖拽文件即可占领沙发</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>文件名</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>文件大小</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>上传设备</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>上传时间</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const dateStr = new Date(file.uploadedAt).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return (
                  <tr 
                    key={file.id} 
                    className="shared-file-row"
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    {/* 文件名 */}
                    <td style={{ 
                      padding: '12px 16px', 
                      fontWeight: 600, 
                      maxWidth: '220px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      color: 'var(--text-primary)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <File size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span title={file.fileName}>{file.fileName}</span>
                      </div>
                    </td>
                    
                    {/* 大小 */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {formatBytes(file.fileSize)}
                    </td>
                    
                    {/* 设备指纹 */}
                    <td style={{ padding: '12px 16px' }}>
                      {renderDeviceBadge(file.deviceInfo)}
                    </td>
                    
                    {/* 时间 */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {dateStr}
                    </td>
                    
                    {/* 操作区 */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {/* 极速下载链接 */}
                        <a
                          href={`/api/transfer/shared/download?id=${file.id}`}
                          download={file.fileName}
                          style={{ textDecoration: 'none' }}
                        >
                          <button
                            title="流式下载"
                            className="action-btn download-btn"
                            style={{
                              background: 'var(--bg-item)',
                              border: '1px solid var(--border-color)',
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <Download size={12} style={{ color: 'var(--success-color)' }} />
                          </button>
                        </a>

                        {/* 删除 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.id);
                          }}
                          title="物理删除"
                          className="action-btn delete-btn"
                          style={{
                            background: 'var(--bg-item)',
                            border: '1px solid var(--border-color)',
                            width: '26px',
                            height: '26px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={12} style={{ color: 'var(--error-color)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 亮暗双色主题高精美 Badge 与表格微交互 CSS */}
      <style jsx global>{`
        .upload-zone:hover {
          border-color: var(--border-color-hover) !important;
          background: var(--bg-item-hover) !important;
        }
        .upload-zone.drag-over {
          border-color: var(--accent-color) !important;
          background: var(--accent-glow) !important;
        }
        .shared-file-row {
          transition: background-color 0.15s;
        }
        .shared-file-row:hover {
          background-color: var(--bg-item-hover) !important;
        }
        .download-btn:hover {
          border-color: var(--success-color) !important;
          background: var(--success-glow) !important;
        }
        .delete-btn:hover {
          border-color: var(--error-color) !important;
          background: rgba(239, 68, 68, 0.08) !important;
        }

        /* 局域网设备 Badge 在不同模式下的高端色彩深度定制 */
        .device-badge {
          border: 1px solid var(--border-color);
        }
        .device-badge.general {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
        }
        .device-badge.windows {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.2);
        }
        .device-badge.macos {
          background: rgba(255, 255, 255, 0.06);
          color: #f4f4f5;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .device-badge.android {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.2);
        }
        .device-badge.linux {
          background: rgba(249, 115, 22, 0.1);
          color: #fb923c;
          border-color: rgba(249, 115, 22, 0.2);
        }

        /* 亮色模式特殊高可见度覆盖（消除原本白底白字的痛点） */
        [data-theme='light'] .device-badge.general {
          background: rgba(9, 9, 11, 0.04);
          color: var(--text-secondary);
        }
        [data-theme='light'] .device-badge.windows {
          background: rgba(37, 99, 235, 0.08);
          color: #1d4ed8;
          border-color: rgba(37, 99, 235, 0.2);
        }
        [data-theme='light'] .device-badge.macos {
          background: rgba(9, 9, 11, 0.05);
          color: #18181b;
          border-color: rgba(9, 9, 11, 0.12);
        }
        [data-theme='light'] .device-badge.android {
          background: rgba(5, 150, 105, 0.08);
          color: #047857;
          border-color: rgba(5, 150, 105, 0.2);
        }
        [data-theme='light'] .device-badge.linux {
          background: rgba(234, 88, 12, 0.08);
          color: #c2410c;
          border-color: rgba(234, 88, 12, 0.2);
        }
      `}</style>
    </Card>
  );
};
export default SharedFiles;
