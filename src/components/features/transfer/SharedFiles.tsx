import React, { useState, useEffect, useRef } from 'react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { formatBytes } from '@/lib/format';
import { SocketClient } from '@/lib/socketClient';
import { 
  UploadCloud, File, Trash2, Download, Monitor, Laptop, 
  Smartphone, Cpu, HelpCircle, CheckCircle2, AlertCircle,
  Eye, FileImage, FileVideo, FileAudio, RotateCw, ZoomIn, 
  ZoomOut, RefreshCw, X, Music, Play, ExternalLink
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

interface FilePreviewModalProps {
  file: SharedFile;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ext = file.fileName.toLowerCase().split('.').pop() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'webm', 'ogg'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);

  const previewUrl = `/api/transfer/shared/download?id=${file.id}&preview=true`;

  return (
    <div 
      className="preview-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fade-in 0.25s ease'
      }}
    >
      <div 
        className="preview-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '85vh',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'preview-scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* 顶部标题与关闭 */}
        <div className="preview-header-bar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {isImage && <FileImage size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />}
            {isVideo && <FileVideo size={18} style={{ color: '#10b981', flexShrink: 0 }} />}
            {isAudio && <FileAudio size={18} style={{ color: '#ec4899', flexShrink: 0 }} />}
            <span className="preview-header-title" style={{ 
              fontWeight: 600, 
              fontSize: '0.95rem',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap'
            }} title={file.fileName}>
              {file.fileName}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* 顶栏独立外链直达 */}
            <a 
              href={previewUrl} 
              target="_blank" 
              rel="noreferrer"
              className="preview-header-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'all 0.15s'
              }}
            >
              <ExternalLink size={12} />
              <span>新窗口打开</span>
            </a>

            <button 
              onClick={onClose}
              className="preview-header-action-btn"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 核心展示区 */}
        <div className="preview-content-area" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          minHeight: '380px',
          padding: '20px'
        }}>
          {isImage && (
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {isImgLoading && (
                <div style={{ position: 'absolute', color: '#a1a1aa', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>正在极速渲染高解析度图片...</span>
                </div>
              )}
              <img 
                src={previewUrl} 
                alt={file.fileName}
                onLoad={() => setIsImgLoading(false)}
                className="preview-img-element"
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  transform: `scale(${zoom}) rotate(${rotate}deg)`,
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: isImgLoading ? 0 : 1
                }}
              />
            </div>
          )}

          {isVideo && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video 
                src={previewUrl} 
                controls 
                autoPlay 
                playsInline
                preload="auto"
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  borderRadius: '12px',
                  outline: 'none',
                  background: '#000000'
                }}
              />
            </div>
          )}

          {isAudio && (
            <div className="preview-audio-container" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              padding: '40px',
              width: '100%',
              maxWidth: '480px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
              {/* CD 唱盘旋转效果 */}
              <div 
                className="audio-disc-container"
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  animation: 'spin 12s linear infinite'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Music size={14} />
                </div>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="preview-audio-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{file.fileName}</span>
                <span style={{ color: '#a1a1aa', fontSize: '0.78rem' }}>{formatBytes(file.fileSize)}</span>
              </div>

              <audio 
                src={previewUrl} 
                controls 
                autoPlay
                style={{
                  width: '100%',
                  borderRadius: '30px',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* 如果不是这三种格式，提供直接下载的阻碍指引 */}
          {!isImage && !isVideo && !isAudio && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              color: '#a1a1aa',
              textAlign: 'center',
              padding: '40px'
            }}>
              <AlertCircle size={40} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span>暂不支持此格式的在线预览</span>
                <span style={{ fontSize: '0.8rem' }}>您可以直接通过右侧操作按钮将其流式下载到本地查看。</span>
              </div>
              <a 
                href={`/api/transfer/shared/download?id=${file.id}`}
                download={file.fileName}
                style={{ textDecoration: 'none', marginTop: '10px' }}
              >
                <button style={{
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                  立即下载
                </button>
              </a>
            </div>
          )}
        </div>

        {/* 底部图片控制条 */}
        {isImage && (
          <div className="preview-bottom-toolbar" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            padding: '12px 24px'
          }}>
            <button 
              onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
              className="preview-toolbar-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="放大"
            >
              <ZoomIn size={14} />
              <span>放大</span>
            </button>

            <button 
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
              className="preview-toolbar-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="缩小"
            >
              <ZoomOut size={14} />
              <span>缩小</span>
            </button>

            <button 
              onClick={() => setRotate(r => r + 90)}
              className="preview-toolbar-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="旋转 90°"
            >
              <RotateCw size={14} />
              <span>旋转</span>
            </button>

            <button 
              onClick={() => { setZoom(1); setRotate(0); }}
              className="preview-toolbar-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="重置缩放与角度"
            >
              <RefreshCw size={14} />
              <span>重置</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  
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
        fetchSharedFiles();
      } else {
        alert(`删除失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`删除异常: ${err.message}`);
    }
  };

  // 获取文件类别小图标
  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={15} style={{ color: '#3b82f6' }} />;
    }
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return <FileVideo size={15} style={{ color: '#10b981' }} />;
    }
    if (['mp3', 'wav'].includes(ext)) {
      return <FileAudio size={15} style={{ color: '#ec4899' }} />;
    }
    return <File size={15} style={{ color: 'var(--text-secondary)' }} />;
  };

  const getFileIconBg = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'rgba(59, 130, 246, 0.08)';
    }
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return 'rgba(16, 185, 129, 0.08)';
    }
    if (['mp3', 'wav'].includes(ext)) {
      return 'rgba(236, 72, 153, 0.08)';
    }
    return 'rgba(128, 128, 128, 0.08)';
  };

  const canPreview = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(ext);
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
      className={`shared-files-card-container ${isDragOver ? 'drag-over' : ''}`}
      style={{ 
        flex: 1.3, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        minHeight: '400px',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        borderRadius: '16px'
      }}
    >
      
      {/* 标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>公共共享空间</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            局域网公共落盘文件长效存储，所有设备即插即用、流式极速下发（松开文件于页面即可极速上传）
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 高档胶囊 Badge */}
          <span style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontWeight: 500
          }}>
            已共享: {files.length} 个文件
          </span>
          
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
              background: 'linear-gradient(135deg, var(--accent-color), #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
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
          background: 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${
            status === 'uploading' ? 'rgba(59, 130, 246, 0.2)' :
            status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
          }`,
          borderRadius: '12px',
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
              <div style={{ width: '100%', height: '3px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '2px', overflow: 'hidden' }}>
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
        maxHeight: '340px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        background: 'rgba(0, 0, 0, 0.1)'
      }}>
        {files.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '60px 0',
            opacity: 0.35
          }}>
            <File size={28} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '0.8rem', marginTop: '12px', color: 'var(--text-secondary)' }}>
              暂无公共共享文件，拖拽文件即可占领沙发
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
            {files.map((file) => {
              const dateStr = new Date(file.uploadedAt).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              const isPreviewable = canPreview(file.fileName);

              return (
                <div
                  key={file.id}
                  className="shared-file-item-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: isPreviewable ? 'pointer' : 'default',
                    position: 'relative'
                  }}
                  onClick={() => {
                    if (isPreviewable) {
                      setPreviewFile(file);
                    }
                  }}
                >
                  {/* 左侧：文件图标与基本信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: getFileIconBg(file.fileName),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getFileIcon(file.fileName)}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span 
                          style={{ 
                            fontSize: '0.88rem', 
                            fontWeight: 600, 
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={file.fileName}
                        >
                          {file.fileName}
                        </span>
                        {isPreviewable && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 600
                          }}>
                            <Eye size={10} />
                            <span>在线预览</span>
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>{formatBytes(file.fileSize)}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：设备徽章与操作按钮组 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {renderDeviceBadge(file.deviceInfo)}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isPreviewable && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          title="在线预览"
                          className="action-btn preview-btn"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Eye size={13} style={{ color: '#60a5fa' }} />
                        </button>
                      )}

                      <a
                        href={`/api/transfer/shared/download?id=${file.id}`}
                        download={file.fileName}
                        style={{ textDecoration: 'none' }}
                      >
                        <button
                          title="安全下载"
                          className="action-btn download-btn"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Download size={13} style={{ color: 'var(--success-color)' }} />
                        </button>
                      </a>

                      <button
                        onClick={() => handleDelete(file.id)}
                        title="物理删除"
                        className="action-btn delete-btn"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <Trash2 size={13} style={{ color: 'var(--error-color)' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 在线多媒体预览浮层弹窗 */}
      {previewFile && (
        <FilePreviewModal 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
        />
      )}

      {/* 亮暗双色主题高精美 Badge 与表格微交互 CSS */}
      <style jsx global>{`
        /* ================= 共享中心主 Card 容器自适应 ================= */
        .shared-files-card-container {
          background: rgba(30, 30, 35, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15) !important;
        }
        
        [data-theme='light'] .shared-files-card-container {
          background: rgba(255, 255, 255, 0.75) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.04) !important;
        }

        .shared-files-card-container.drag-over {
          border: 2px dashed var(--accent-color) !important;
          background: var(--accent-glow) !important;
        }

        /* ================= 共享中心列表项自适应 ================= */
        .shared-file-item-row {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
        
        .shared-file-item-row:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        [data-theme='light'] .shared-file-item-row {
          background: rgba(0, 0, 0, 0.015) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
        }
        
        [data-theme='light'] .shared-file-item-row:hover {
          background: rgba(0, 0, 0, 0.035) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        [data-theme='light'] .action-btn:hover {
          background: rgba(0, 0, 0, 0.05) !important;
          border-color: rgba(0, 0, 0, 0.1) !important;
        }

        .preview-btn:hover {
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
        }
        .download-btn:hover {
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.15);
        }
        .delete-btn:hover {
          border-color: rgba(239, 68, 68, 0.25) !important;
          background: rgba(239, 68, 68, 0.08) !important;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.15);
        }
        [data-theme='light'] .delete-btn:hover {
          border-color: rgba(239, 68, 68, 0.3) !important;
          background: rgba(239, 68, 68, 0.05) !important;
        }

        /* ================= 预览 Modal 遮罩与卡片自适应 ================= */
        .preview-overlay {
          background: rgba(9, 9, 11, 0.85) !important;
        }
        [data-theme='light'] .preview-overlay {
          background: rgba(15, 23, 42, 0.55) !important;
          backdrop-filter: blur(16px) saturate(140%) !important;
        }

        .preview-modal-card {
          background: rgba(30, 30, 36, 0.75) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(30px) !important;
        }

        [data-theme='light'] .preview-modal-card {
          background: rgba(255, 255, 255, 0.88) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.12) !important;
          backdrop-filter: blur(30px) !important;
        }

        /* ================= 预览顶栏与标题自适应 ================= */
        .preview-header-bar {
          background: rgba(0, 0, 0, 0.2) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        }
        
        .preview-header-title {
          color: #f4f4f5 !important;
        }

        [data-theme='light'] .preview-header-bar {
          background: rgba(0, 0, 0, 0.02) !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
        }
        
        [data-theme='light'] .preview-header-title {
          color: #18181b !important;
        }

        /* ================= 预览按钮及关闭按钮自适应 ================= */
        .preview-header-action-btn {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #d4d4d8 !important;
        }
        
        .preview-header-action-btn:hover {
          background: rgba(255, 255, 255, 0.12) !important;
          color: #ffffff !important;
        }

        [data-theme='light'] .preview-header-action-btn {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          color: #4b5563 !important;
        }
        
        [data-theme='light'] .preview-header-action-btn:hover {
          background: rgba(0, 0, 0, 0.06) !important;
          color: #09090b !important;
        }

        .preview-close-btn:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5 !important;
        }

        /* ================= 预览内容展示区 - 黑白/浅灰高阶棋盘格自适应 ================= */
        .preview-content-area {
          background-color: #121214 !important;
          background-image: linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b), 
                            linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b) !important;
          background-size: 20px 20px !important;
          background-position: 0 0, 10px 10px !important;
        }

        [data-theme='light'] .preview-content-area {
          background-color: #fcfcfd !important;
          background-image: linear-gradient(45deg, #f0f0f3 25%, transparent 25%, transparent 75%, #f0f0f3 75%, #f0f0f3), 
                            linear-gradient(45deg, #f0f0f3 25%, transparent 25%, transparent 75%, #f0f0f3 75%, #f0f0f3) !important;
        }

        .preview-img-element {
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5) !important;
        }

        [data-theme='light'] .preview-img-element {
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08) !important;
        }

        /* ================= 预览音频播放卡片自适应 ================= */
        .preview-audio-container {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        
        .preview-audio-name {
          color: #e4e4e7 !important;
        }

        [data-theme='light'] .preview-audio-container {
          background: rgba(0, 0, 0, 0.02) !important;
          border-color: rgba(0, 0, 0, 0.06) !important;
        }
        
        [data-theme='light'] .preview-audio-name {
          color: #18181b !important;
        }

        /* ================= 预览底栏与控制按钮自适应 ================= */
        .preview-bottom-toolbar {
          border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
          background: rgba(0, 0, 0, 0.15) !important;
        }

        [data-theme='light'] .preview-bottom-toolbar {
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
          background: rgba(0, 0, 0, 0.02) !important;
        }

        .preview-toolbar-btn {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #e4e4e7 !important;
        }
        
        .preview-toolbar-btn:hover {
          background: rgba(255, 255, 255, 0.12) !important;
          color: #ffffff !important;
        }

        [data-theme='light'] .preview-toolbar-btn {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          color: #4b5563 !important;
        }
        
        [data-theme='light'] .preview-toolbar-btn:hover {
          background: rgba(0, 0, 0, 0.06) !important;
          color: #09090b !important;
        }

        /* ================= 高级大厂平滑动效定义 ================= */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes preview-scale-up {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </Card>
  );
};
export default SharedFiles;
