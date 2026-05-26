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
    <Card 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ 
        flex: 1.3, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        minHeight: '400px',
        border: isDragOver ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
        background: isDragOver ? 'var(--accent-glow)' : 'var(--bg-card)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
    >
      
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>公共共享空间</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            局域网公共落盘文件长效存储，所有设备即插即用、流式极速下发（松开文件于页面即可极速上传）
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            共享文件数: {files.length} 个
          </span>
          
          {/* 隐藏的物理文件选择器 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={status === 'uploading'}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'uploading'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'var(--accent-color)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.15)'
            }}
            onMouseEnter={(e) => {
              if (status !== 'uploading') e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              if (status !== 'uploading') e.currentTarget.style.filter = 'none';
            }}
          >
            <UploadCloud size={14} />
            <span>{status === 'uploading' ? '正在上传...' : '上传文件'}</span>
          </button>
        </div>
      </div>

      {/* 极窄、微光大厂科技感状态指示栏 */}
      {status !== 'idle' && (
        <div style={{
          background: 'var(--bg-item)',
          border: `1px solid ${
            status === 'uploading' ? 'rgba(59, 130, 246, 0.2)' :
            status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
          }`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          animation: 'fade-in 0.25s ease'
        }}>
          {status === 'uploading' && uploadingFile && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  正在极速分片上传: {uploadingFile.name} ({formatBytes(uploadingFile.size)})
                </span>
                <span style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(128, 128, 128, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
                  borderRadius: '2.5px',
                  transition: 'width 0.15s linear',
                  boxShadow: '0 0 6px var(--accent-color)'
                }} />
              </div>
            </>
          )}
          
          {status === 'success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success-color)', fontSize: '0.8rem', fontWeight: 600 }}>
              <CheckCircle2 size={14} />
              <span>共享上传成功！文件已在服务器物理落盘并向局域网广播同步。</span>
            </div>
          )}
          
          {status === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error-color)', fontSize: '0.8rem', fontWeight: 600 }}>
              <AlertCircle size={14} />
              <span>上传失败: {errorMsg || '发生了未知错误'}</span>
            </div>
          )}
        </div>
      )}

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
      `}</style>
    </Card>
  );
};
export default SharedFiles;
