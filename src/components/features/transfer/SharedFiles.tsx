import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatBytes } from '@/lib/format';
import { SocketClient } from '@/lib/socketClient';
import { 
  UploadCloud, File, Trash2, Download, Monitor, Laptop, 
  Smartphone, Cpu, HelpCircle, CheckCircle2, AlertCircle,
  Eye, FileImage, FileVideo, FileAudio, RotateCw, ZoomIn, 
  ZoomOut, RefreshCw, X, Music, Search, ArrowUpDown, 
  LayoutGrid, List, Sparkles, FolderOpen, Calendar, HardDrive, Info,
  ShieldAlert
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button as ShadcnButton } from '@/components/ui/button';

interface SharedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  deviceInfo: string;
  filePath: string;
  boxId?: string; // 新增：所属收纳盒ID
}

interface SharedBox {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: number;
}

interface SharedFilesProps {
  uploadPublicFile: (
    file: File,
    deviceInfo: string,
    onProgress?: (progress: number) => void
  ) => Promise<boolean>;
  allowUpload?: boolean;
}

interface FilePreviewModalProps {
  file: SharedFile;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isImgLoading, setIsImgLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoom <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(z => Math.max(0.4, Math.min(3, z + zoomFactor)));
  };

  if (!mounted) return null;

  return createPortal(
    <div 
      className="preview-overlay"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backdropFilter: 'blur(24px) saturate(190%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div 
        className="preview-modal-card-cinema"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '85vh',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'preview-scale-up-elastic 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* 顶部标题栏 */}
        <div className="preview-header-bar-cinema" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div className="preview-header-icon-shell" style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isImage && <FileImage size={16} style={{ color: 'var(--accent-color)' }} />}
              {isVideo && <FileVideo size={16} style={{ color: '#10b981' }} />}
              {isAudio && <FileAudio size={16} style={{ color: '#ec4899' }} />}
              {!isImage && !isVideo && !isAudio && <File size={16} style={{ color: '#a1a1aa' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="preview-header-title-cinema" style={{ 
                fontWeight: 600, 
                fontSize: '0.95rem',
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap'
              }} title={file.fileName}>
                {file.fileName}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {formatBytes(file.fileSize)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a 
              href={previewUrl} 
              target="_blank" 
              rel="noreferrer"
              className="preview-action-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '0.78rem',
                textDecoration: 'none',
                fontWeight: 600,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span>新窗口查看</span>
            </a>

            <button 
              onClick={onClose}
              className="preview-close-btn-cinema"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 核心展示区 */}
        <div 
          className="preview-content-area-cinema" 
          onWheel={isImage ? handleWheel : undefined}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            minHeight: '420px',
            padding: '24px'
          }}
        >
          {isImage && (
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}>
              {isImgLoading && (
                <div className="preview-loading-box" style={{ 
                  position: 'absolute', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  zIndex: 2,
                  padding: '12px 20px',
                  borderRadius: '12px'
                }}>
                  <RefreshCw size={14} className="animate-spin-fast" />
                  <span>正在极速载入高清画幅...</span>
                </div>
              )}
              <img 
                ref={imgRef}
                src={previewUrl} 
                alt={file.fileName}
                onLoad={() => setIsImgLoading(false)}
                onMouseDown={handleMouseDown}
                className="preview-img-element-cinema"
                style={{
                  maxWidth: '100%',
                  maxHeight: '62vh',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotate}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
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
                  maxHeight: '62vh',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  outline: 'none',
                  background: '#000000',
                  margin: 'auto'
                }}
              />
            </div>
          )}

          {isAudio && (
            <div className="preview-audio-shell" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '28px',
              padding: '48px 40px',
              width: '100%',
              maxWidth: '440px',
              borderRadius: '28px',
            }}>
              {/* CD 唱盘旋转效果 */}
              <div 
                className="audio-disc-neon-container"
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div className="audio-disc-neon-pulse" />
                <div 
                  className="audio-disc-core"
                  style={{
                    width: '138px',
                    height: '138px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle, #09090b 25%, #18181b 60%, #27272a 100%)',
                    boxShadow: 'inset 0 0 10px rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.4)',
                    animation: 'spin 16s linear infinite',
                    position: 'relative'
                  }}
                >
                  {/* 胶片纹路 */}
                  <div className="disc-grooves" />
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-color), #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                    zIndex: 2
                  }}>
                    <Music size={16} style={{ color: '#ffffff' }} />
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="preview-audio-name-cinema" style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>{file.fileName}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatBytes(file.fileSize)}</span>
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

          {/* 不支持在线预览格式 */}
          {!isImage && !isVideo && !isAudio && (
            <div className="preview-unsupported-box" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              textAlign: 'center',
              padding: '48px 32px',
              maxWidth: '400px',
              borderRadius: '20px'
            }}>
              <div className="unsupported-icon-glow" style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.06)'
              }}>
                <AlertCircle size={28} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>暂不支持该格式在线预览</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  该文件可能属于二进制、压缩包或未识别文档。您可以极速安全下载到本地打开。
                </span>
              </div>
              <a 
                href={`/api/transfer/shared/download?id=${file.id}`}
                download={file.fileName}
                style={{ textDecoration: 'none', width: '100%', marginTop: '8px' }}
              >
                <button className="preview-action-btn-primary" style={{
                  width: '100%',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                  立即极速下载
                </button>
              </a>
            </div>
          )}
        </div>

        {/* 底部图片控制条 */}
        {isImage && (
          <div className="preview-bottom-toolbar-cinema" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '14px 28px'
          }}>
            <button 
              onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
              className="preview-toolbar-btn-cinema"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              title="放大 (支持滚轮)"
            >
              <ZoomIn size={14} />
              <span>放大</span>
            </button>

            <button 
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
              className="preview-toolbar-btn-cinema"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              title="缩小"
            >
              <ZoomOut size={14} />
              <span>缩小</span>
            </button>

            <button 
              onClick={() => setRotate(r => r + 90)}
              className="preview-toolbar-btn-cinema"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              title="顺时针旋转 90°"
            >
              <RotateCw size={14} />
              <span>旋转</span>
            </button>

            <button 
              onClick={() => { setZoom(1); setRotate(0); setPosition({ x: 0, y: 0 }); }}
              className="preview-toolbar-btn-cinema"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              title="恢复初始视口"
            >
              <RefreshCw size={14} />
              <span>重置</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
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

export const SharedFiles: React.FC<SharedFilesProps> = ({ uploadPublicFile, allowUpload = true }) => {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);

  // 共享文件删除确认弹窗状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  // 重构新增：状态与多维筛选过滤
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [sortBy, setSortBy] = useState<'time-desc' | 'time-asc' | 'size-desc' | 'size-asc'>('time-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 收纳盒状态
  const [boxes, setBoxes] = useState<SharedBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>('all'); // 'all', 'lobby', or boxId
  const [isCreateBoxModalOpen, setIsCreateBoxModalOpen] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxDescription, setNewBoxDescription] = useState('');
  const [newBoxColor, setNewBoxColor] = useState('');
  const [activeMoveMenuFileId, setActiveMoveMenuFileId] = useState<string | null>(null);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12); // 默认每页展示 12 个

  // 联动自愈重置：当模糊搜索、文件分类、排序方式、单页大小或收纳盒改变时，自动秒级重置当前页码为 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, sortBy, pageSize, selectedBoxId]);
  
  // 重构新增：上传测速
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [remainingTime, setRemainingTime] = useState('');
  const uploadStartRef = useRef<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化拉取公共文件列表
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

  // 拉取收纳盒列表
  const fetchSharedBoxes = async () => {
    try {
      const res = await fetch('/api/transfer/shared/boxes');
      const data = await res.json();
      if (data.success) {
        setBoxes(data.boxes);
      }
    } catch (err) {
      console.error('[SharedFiles] 拉取公共收纳盒列表失败:', err);
    }
  };

  // 创建收纳盒
  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoxName.trim()) return;

    try {
      const res = await fetch('/api/transfer/shared/boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBoxName.trim(),
          description: newBoxDescription.trim() || undefined,
          color: newBoxColor || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateBoxModalOpen(false);
        setNewBoxName('');
        setNewBoxDescription('');
        setNewBoxColor('');
        fetchSharedBoxes();
      } else {
        alert(`创建收纳盒失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`创建收纳盒异常: ${err.message}`);
    }
  };

  // 删除收纳盒
  const handleDeleteBox = async (boxId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('您确定要删除该收纳盒吗？\n物理文件不会被删除，它们将安全释放回到“未分类大厅”中。')) return;

    try {
      const res = await fetch(`/api/transfer/shared/boxes?id=${boxId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (selectedBoxId === boxId) {
          setSelectedBoxId('all');
        }
        fetchSharedBoxes();
        fetchSharedFiles();
      } else {
        alert(`删除收纳盒失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`删除收纳盒异常: ${err.message}`);
    }
  };

  // 转移文件至目标收纳盒
  const handleMoveFile = async (fileId: string, targetBoxId: string | null) => {
    try {
      const res = await fetch('/api/transfer/shared/boxes/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: [fileId],
          boxId: targetBoxId
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveMoveMenuFileId(null);
        fetchSharedFiles();
      } else {
        alert(`转移文件失败: ${data.error}`);
      }
    } catch (err: any) {
      alert(`转移文件异常: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchSharedFiles();
    fetchSharedBoxes();

    // 订阅局域网公共文件列表更新 WebSocket 事件 (所有伙伴共享)
    const socket = SocketClient.getInstance();
    const unsubSharedUpdate = socket.subscribe('shared-files:update', (updatedFiles: SharedFile[]) => {
      console.log('[SharedFiles] 收到局域网公共文件列表广播更新:', updatedFiles);
      setFiles(updatedFiles);
    });

    // 订阅局域网公共收纳盒列表更新 WebSocket 事件 (所有伙伴共享)
    const unsubBoxesUpdate = socket.subscribe('shared-boxes:update', (updatedBoxes: SharedBox[]) => {
      console.log('[SharedFiles] 收到局域网公共收纳盒列表广播更新:', updatedBoxes);
      setBoxes(updatedBoxes);
    });

    const handleStoragePathChanged = () => {
      console.log('[SharedFiles] 监听到物理存储路径发生变更，正在秒级自动重载...');
      fetchSharedFiles();
      fetchSharedBoxes();
    };
    window.addEventListener('storage-path-changed', handleStoragePathChanged);

    // 点击页面其他地方自动关闭文件转移气泡菜单
    const handleGlobalClick = () => {
      setActiveMoveMenuFileId(null);
    };
    window.addEventListener('click', handleGlobalClick);

    return () => {
      unsubSharedUpdate();
      unsubBoxesUpdate();
      window.removeEventListener('storage-path-changed', handleStoragePathChanged);
      window.removeEventListener('click', handleGlobalClick);
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

  // 核心上传逻辑（植入测速与时间预估算法）
  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!allowUpload) {
      alert('您的共享上传/互传文件权限已被超级管理员禁用。');
      return;
    }

    setUploadingFile(file);
    setUploadProgress(0);
    setStatus('uploading');
    setErrorMsg('');
    setUploadSpeed('计算中...');
    setRemainingTime('');
    uploadStartRef.current = Date.now();

    try {
      const deviceInfo = getDeviceInfo();
      const currentBoxId = (selectedBoxId && selectedBoxId !== 'all' && selectedBoxId !== 'lobby') ? selectedBoxId : undefined;
      const success = await uploadPublicFile(file, deviceInfo, (progress) => {
        setUploadProgress(progress);
      }, currentBoxId);
        
        // 测速核心算法
        const now = Date.now();
        const elapsed = (now - uploadStartRef.current) / 1000; // 秒
        if (elapsed > 0.3) { // 稍微延迟以防极早期速度不稳定
          const uploadedBytes = file.size * (progress / 100);
          const speed = uploadedBytes / elapsed; // bytes/sec
          setUploadSpeed(`${formatBytes(speed)}/s`);
          
          const remainingBytes = file.size - uploadedBytes;
          const remSec = speed > 0 ? Math.round(remainingBytes / speed) : 0;
          if (progress >= 99) {
            setRemainingTime('正在落盘校验合并...');
          } else if (remSec > 0) {
            setRemainingTime(`预计剩 ${remSec} 秒`);
          } else {
            setRemainingTime('即将完成');
          }
        }
      });

      if (success) {
        setStatus('success');
        setTimeout(() => {
          setStatus('idle');
          setUploadingFile(null);
          setUploadProgress(0);
          setUploadSpeed('');
          setRemainingTime('');
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
  const handleDelete = (id: string) => {
    setDeleteFileId(id);
    setIsDeleteModalOpen(true);
  };

  // 实际执行物理删除文件
  const executeDelete = async () => {
    setIsDeleteModalOpen(false);
    if (!deleteFileId) return;

    try {
      const res = await fetch(`/api/transfer/shared?id=${deleteFileId}`, {
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
    } finally {
      setDeleteFileId(null);
    }
  };

  // 获取文件类别小图标
  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={16} style={{ color: 'var(--accent-color)' }} />;
    }
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return <FileVideo size={16} style={{ color: '#10b981' }} />;
    }
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return <FileAudio size={16} style={{ color: '#ec4899' }} />;
    }
    return <File size={16} style={{ color: 'var(--text-secondary)' }} />;
  };

  const getFileIconBg = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'rgba(99, 102, 241, 0.08)';
    }
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return 'rgba(16, 185, 129, 0.08)';
    }
    if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return 'rgba(236, 72, 153, 0.08)';
    }
    return 'rgba(128, 128, 128, 0.08)';
  };

  const canPreview = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(ext);
  };

  // 🌲 资深前端工程师级：极客多态后缀名图标渲染 (Polymorphic Suffix Badge Generator)
  const renderFileExtIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || 'file';
    const displayExt = ext.toUpperCase().slice(0, 4);

    let bgColor = 'rgba(161, 161, 170, 0.08)'; // 钛合金默认灰
    let textColor = 'var(--text-secondary)';

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      bgColor = 'rgba(245, 158, 11, 0.08)';
      textColor = '#f59e0b';
    } else if (['pdf'].includes(ext)) {
      bgColor = 'rgba(239, 68, 68, 0.08)';
      textColor = '#ef4444';
    } else if (['doc', 'docx'].includes(ext)) {
      bgColor = 'rgba(59, 130, 246, 0.08)';
      textColor = '#3b82f6';
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      bgColor = 'rgba(16, 185, 129, 0.08)';
      textColor = '#10b981';
    } else if (['ppt', 'pptx'].includes(ext)) {
      bgColor = 'rgba(249, 115, 22, 0.08)';
      textColor = '#f97316';
    } else if (['java', 'py', 'js', 'ts', 'cpp', 'go', 'html', 'css', 'json', 'sh', 'sql', 'md'].includes(ext)) {
      bgColor = 'rgba(139, 92, 246, 0.08)';
      textColor = '#a78bfa';
    } else if (['dmg', 'pkg', 'exe', 'msi', 'iso'].includes(ext)) {
      bgColor = 'rgba(244, 244, 245, 0.06)';
      textColor = 'var(--text-primary)';
    }

    return (
      <div 
        className="grid-thumbnail-ext-badge-wrapper"
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: bgColor,
          border: `1px solid ${textColor}1a`, // 微透磨砂描边
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 2,
          padding: '4px'
        }}
      >
        <span style={{ 
          fontSize: displayExt.length > 3 ? '0.68rem' : '0.75rem', 
          fontWeight: 800, 
          color: textColor, 
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.02em',
          lineHeight: 1
        }}>
          {displayExt}
        </span>
      </div>
    );
  };

  // 专属流光高端 Badge
  const renderDeviceBadge = (deviceInfo: string) => {
    let icon = <HelpCircle size={11} />;
    let badgeClass = 'custom-device-badge general-glow';

    if (deviceInfo.includes('Windows')) {
      icon = <Laptop size={11} />;
      badgeClass = 'custom-device-badge windows-glow';
    } else if (deviceInfo.includes('macOS') || deviceInfo.includes('iOS')) {
      icon = <Monitor size={11} />;
      badgeClass = 'custom-device-badge macos-glow';
    } else if (deviceInfo.includes('Android')) {
      icon = <Smartphone size={11} />;
      badgeClass = 'custom-device-badge android-glow';
    } else if (deviceInfo.includes('Linux')) {
      icon = <Cpu size={11} />;
      badgeClass = 'custom-device-badge linux-glow';
    }

    return (
      <span className={badgeClass} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '20px',
        fontSize: '0.7rem',
        fontWeight: 600,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {icon}
        {deviceInfo}
      </span>
    );
  };

  // 前端过滤与排序实现
  const filteredFiles = files
    .filter(file => {
      // 0. 收纳盒分类过滤
      if (selectedBoxId === 'lobby') {
        if (file.boxId) return false;
      } else if (selectedBoxId && selectedBoxId !== 'all') {
        if (file.boxId !== selectedBoxId) return false;
      }

      // 1. 模糊搜索匹配
      const matchesSearch = file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            file.deviceInfo.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. 文件类型筛选
      if (selectedType === 'all') return true;
      const ext = file.fileName.toLowerCase().split('.').pop() || '';
      if (selectedType === 'image') return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
      if (selectedType === 'video') return ['mp4', 'webm', 'ogg'].includes(ext);
      if (selectedType === 'audio') return ['mp3', 'wav', 'ogg'].includes(ext);
      if (selectedType === 'document') {
        return !['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(ext);
      }
      return true;
    })
    .sort((a, b) => {
      // 3. 排序逻辑
      if (sortBy === 'time-desc') return b.uploadedAt - a.uploadedAt;
      if (sortBy === 'time-asc') return a.uploadedAt - b.uploadedAt;
      if (sortBy === 'size-desc') return b.fileSize - a.fileSize;
      if (sortBy === 'size-asc') return a.fileSize - b.fileSize;
      return 0;
    });

  // 分页截取计算
  const totalItems = filteredFiles.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // 安全限制：防止当前页数 currentPage 越界
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedFiles = filteredFiles.slice(startIndex, startIndex + pageSize);

  return (
    <div 
      className="share-center-master-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        position: 'relative'
      }}
    >
      
      {/* 顶部智能 Control Hub */}
      <div className="control-hub-panel" style={{
        padding: '16px 20px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* 第一排：标题、搜索和视图切换 */}
        <div className="control-hub-top-row" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="control-hub-logo-icon" style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
              border: '1px solid rgba(99,102,241,0.2)'
            }}>
              <FolderOpen size={16} style={{ color: 'var(--accent-color)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                公共落盘共享空间
                <span className="premium-glow-badge" style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: 'linear-gradient(90deg, var(--accent-color), #1d4ed8)',
                  color: '#ffffff',
                  boxShadow: '0 0 8px rgba(99,102,241,0.3)',
                  textTransform: 'uppercase'
                }}>P2P Hub</span>
              </h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>局域网长效存储中转站 · 支持文件即拖即传</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', justifyContent: 'flex-end', minWidth: '280px' }}>
            {/* 模糊搜索舱 */}
            <div className="search-input-shell" style={{
              position: 'relative',
              maxWidth: '300px',
              width: '100%'
            }}>
              <Search size={13} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="搜索文件、设备名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 14px 8px 34px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  outline: 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </div>

            {/* 视图切换按钮 */}
            <div className="view-mode-pill" style={{
              display: 'flex',
              padding: '2px',
              borderRadius: '10px',
            }}>
              <button
                onClick={() => setViewMode('grid')}
                className={`view-switch-btn ${viewMode === 'grid' ? 'active' : ''}`}
                title="网格视图"
                style={{
                  border: 'none',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`view-switch-btn ${viewMode === 'list' ? 'active' : ''}`}
                title="精细列表"
                style={{
                  border: 'none',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* 第二排：胶囊类型筛选与排序选择 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '12px',
          flexWrap: 'wrap'
        }}>
          {/* 胶囊过滤器 */}
          <div className="capsule-filters-scroller" style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}>
            <button 
              onClick={() => setSelectedType('all')} 
              className={`capsule-tab-btn ${selectedType === 'all' ? 'active' : ''}`}
            >
              全部
            </button>
            <button 
              onClick={() => setSelectedType('image')} 
              className={`capsule-tab-btn ${selectedType === 'image' ? 'active' : ''}`}
            >
              图片 🖼️
            </button>
            <button 
              onClick={() => setSelectedType('video')} 
              className={`capsule-tab-btn ${selectedType === 'video' ? 'active' : ''}`}
            >
              视频 🎥
            </button>
            <button 
              onClick={() => setSelectedType('audio')} 
              className={`capsule-tab-btn ${selectedType === 'audio' ? 'active' : ''}`}
            >
              音频 🎵
            </button>
            <button 
              onClick={() => setSelectedType('document')} 
              className={`capsule-tab-btn ${selectedType === 'document' ? 'active' : ''}`}
            >
              文档及其他 📂
            </button>
          </div>

          {/* 排序器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={11} />
              排序:
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="hub-sort-select"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <option value="time-desc">上传时间 (最新优先)</option>
              <option value="time-asc">上传时间 (最早优先)</option>
              <option value="size-desc">文件大小 (从大到小)</option>
              <option value="size-asc">文件大小 (从小到大)</option>
            </select>

            <span className="files-count-badge" style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '20px',
            }}>
              共 {filteredFiles.length} 项
            </span>
          </div>
        </div>

      </div>

      {/* 主体响应式复合双栏布局区域 */}
      <div className="share-center-workspace-columns" style={{
        display: 'flex',
        gap: '20px',
        width: '100%',
        alignItems: 'flex-start'
      }}>
        
        {/* 左侧：投递太空舱 (Upload Space Cabin) */}
        <div className="upload-cabin-aside" style={{
          width: '320px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* 上传拖拽面板 */}
          <div 
            onClick={() => {
              if (status !== 'uploading' && allowUpload) fileInputRef.current?.click();
            }}
            className={`drop-zone-cabin ${isDragOver && allowUpload ? 'drag-over' : ''} ${(status === 'uploading' || !allowUpload) ? 'disabled' : ''}`}
            style={{
              padding: '40px 24px',
              borderRadius: '20px',
              border: allowUpload ? '2px dashed rgba(99, 102, 241, 0.25)' : '2px dashed rgba(239, 68, 68, 0.3)',
              background: allowUpload ? 'transparent' : 'rgba(239, 68, 68, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: (status === 'uploading' || !allowUpload) ? 'not-allowed' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: allowUpload ? 1 : 0.85
            }}
          >
            {/* 炫光水滴流体发光层 */}
            <div className="drop-zone-glow-aura" />
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={status === 'uploading'}
            />

            <div className="icon-cabin-pulse" style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: allowUpload 
                ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))'
                : 'rgba(239, 68, 68, 0.08)',
              border: allowUpload ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
              marginBottom: '16px',
              position: 'relative',
              zIndex: 2
            }}>
              <UploadCloud size={22} className={allowUpload ? 'cloud-upload-icon-anim' : ''} style={{ color: allowUpload ? 'var(--accent-color)' : '#ef4444' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 2 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {allowUpload ? '极速闪传投递舱' : '投递舱已停用'}
              </span>
              <span style={{ fontSize: '0.72rem', color: allowUpload ? 'var(--text-secondary)' : '#ef4444', fontWeight: allowUpload ? 'normal' : 500 }}>
                {allowUpload ? '松开文件拖入页面任意处上传' : '共享文件上传权限已被超级管理员停用'}
              </span>
            </div>

            <button 
              className="cabin-select-btn" 
              disabled={status === 'uploading' || !allowUpload}
              style={{
                marginTop: '20px',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: (status === 'uploading' || !allowUpload) ? 'not-allowed' : 'pointer',
                background: allowUpload ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.1)',
                color: allowUpload ? '#ffffff' : 'var(--text-muted)',
                zIndex: 2,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {allowUpload ? '选择文件投递' : '权限已禁用'}
            </button>
          </div>

          {/* 上传进度指示舱 (立体水滴波浪进度球) */}
          {status !== 'idle' && (
            <div className="upload-progress-cabin" style={{
              padding: '20px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              animation: 'fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {status === 'uploading' && uploadingFile && (
                <>
                  {/* 高精美立体波浪球 */}
                  <div className="wave-progress-orb" style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.15)',
                    border: '2px solid rgba(99, 102, 241, 0.2)'
                  }}>
                    {/* 背景波浪水面 */}
                    <div className="wave-progress-water" style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${uploadProgress}%`,
                      background: 'linear-gradient(180deg, var(--accent-color), #3b82f6)',
                      transition: 'height 0.2s linear',
                      width: '100%',
                      zIndex: 1
                    }}>
                      <div className="water-sine-wave wave-1" />
                      <div className="water-sine-wave wave-2" />
                    </div>

                    <span style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: 800, 
                      color: uploadProgress > 48 ? '#ffffff' : 'var(--text-primary)',
                      zIndex: 3,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.02em',
                      transition: 'color 0.2s'
                    }}>
                      {uploadProgress}%
                    </span>
                  </div>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', display: 'block' }}>
                      {uploadingFile.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      文件大小: {formatBytes(uploadingFile.size)}
                    </span>
                  </div>

                  {/* 测速及时间栏 */}
                  <div style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '12px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>闪传速度</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-mono)' }}>{uploadSpeed}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>预计剩余</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{remainingTime || '计算中'}</span>
                    </div>
                  </div>
                </>
              )}

              {status === 'success' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 0',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.1)'
                  }}>
                    <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>共享投递成功！</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>文件已物理落盘并全局同步</span>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 0',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.1)'
                  }}>
                    <AlertCircle size={20} style={{ color: '#ef4444' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>投递遭遇异常</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{errorMsg || '发生了未知错误'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 局域网提醒说明卡片 */}
          <div className="cabin-info-card" style={{
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '12px',
          }}>
            <Info size={14} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>去中心化局域网广播</span>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                在这里上传的文件将被同步落盘于服务器指定物理目录，所有连入同一局域网的设备均可无损直接拉取，实现企业级 AirDrop 体验。
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：星轨资源池 (Resource Orbit) */}
        <div className="resource-orbit-area" style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          
          {/* 1. 收纳盒卡片网格 (Interactive Box Decks) */}
          <div className="boxes-deck-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '12px',
            width: '100%',
            marginBottom: '4px'
          }}>
            {/* 1.1 "全部文件" 盒子 */}
            <div 
              onClick={() => setSelectedBoxId('all')}
              className={`box-deck-card ${selectedBoxId === 'all' ? 'active' : ''}`}
              style={{
                background: selectedBoxId === 'all' 
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)' 
                  : 'rgba(255, 255, 255, 0.02)',
                border: selectedBoxId === 'all'
                  ? '1px solid rgba(99, 102, 241, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                position: 'relative',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: selectedBoxId === 'all' ? '0 8px 24px rgba(99, 102, 241, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '1.1rem' }}>🌐</span>
                <span className="box-files-count-tag" style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)'
                }}>
                  {files.length} 个文件
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>全部共享文件</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>大厅中所有伙伴的文件</span>
              </div>
            </div>

            {/* 1.2 "未分类大厅" 盒子 */}
            <div 
              onClick={() => setSelectedBoxId('lobby')}
              className={`box-deck-card ${selectedBoxId === 'lobby' ? 'active' : ''}`}
              style={{
                background: selectedBoxId === 'lobby' 
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)' 
                  : 'rgba(255, 255, 255, 0.02)',
                border: selectedBoxId === 'lobby'
                  ? '1px solid rgba(255, 255, 255, 0.2)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                position: 'relative',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: selectedBoxId === 'lobby' ? '0 8px 24px rgba(255, 255, 255, 0.06)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '1.1rem' }}>📦</span>
                <span className="box-files-count-tag" style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)'
                }}>
                  {files.filter(f => !f.boxId).length} 个文件
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>未分类大厅</span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>尚未装箱的共享文件</span>
              </div>
            </div>

            {/* 1.3 用户创建的所有物理收纳盒 */}
            {boxes.map(box => {
              const isActive = selectedBoxId === box.id;
              const boxFiles = files.filter(f => f.boxId === box.id);
              
              return (
                <div 
                  key={box.id}
                  onClick={() => setSelectedBoxId(box.id)}
                  className={`box-deck-card ${isActive ? 'active' : ''}`}
                  style={{
                    background: box.color,
                    border: isActive
                      ? '1px solid rgba(255, 255, 255, 0.6)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? '0 10px 28px rgba(0,0,0,0.3)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2 }}>
                    <span style={{ fontSize: '1.1rem' }}>📁</span>
                    <span className="box-files-count-tag" style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      backdropFilter: 'blur(4px)'
                    }}>
                      {boxFiles.length} 个文件
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', position: 'relative', zIndex: 2 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {box.name}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.7)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {box.description || '无简短说明'}
                    </span>
                  </div>

                  {/* 悬停删除小垃圾桶 */}
                  <button 
                    onClick={(e) => handleDeleteBox(box.id, e)}
                    className="box-delete-icon-btn"
                    title="注销并删除该收纳盒"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      bottom: '8px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 3,
                      transition: 'all 0.2s'
                    }}
                  >
                    <Trash2 size={10} style={{ color: '#ff8a8a' }} />
                  </button>
                </div>
              );
            })}

            {/* 1.4 "新建收纳盒" 虚线按钮卡片 */}
            <div 
              onClick={() => setIsCreateBoxModalOpen(true)}
              className="box-create-trigger-card"
              style={{
                border: '1.5px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.005)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                minHeight: '94px'
              }}
            >
              <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 300 }}>+</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>新建收纳盒</span>
            </div>
          </div>

          {filteredFiles.length === 0 ? (
            <div className="orbit-empty-state" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '90px 24px',
              borderRadius: '20px',
              border: '1px dashed rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                marginBottom: '16px'
              }}>
                <File size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                资源池里空空如也
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.4 }}>
                暂无匹配该分类或关键字的文件。松开文件于页面任意位置，即可极速完成第一份投递！
              </p>
            </div>
          ) : (
            <>
              {/* 网格视图骨架 */}
              {viewMode === 'grid' && (
                <div className="orbit-files-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '16px',
                  width: '100%'
                }}>
                  {paginatedFiles.map((file) => {
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
                        className="orbit-grid-card"
                        style={{
                          borderRadius: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {/* 上半部：毛玻璃底图与格式图标展示区 */}
                        <div 
                          className="grid-card-thumbnail-wrapper"
                          onClick={() => {
                            if (isPreviewable) setPreviewFile(file);
                          }}
                          style={{
                            height: '110px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            cursor: isPreviewable ? 'pointer' : 'default',
                            overflow: 'hidden'
                          }}
                        >
                          {/* 缩略图毛玻璃背景（如果是图片则直接流式拉取） */}
                          {canPreview(file.fileName) && file.fileName.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp|svg)$/) ? (
                            <>
                              <img 
                                src={`/api/transfer/shared/download?id=${file.id}&preview=true`} 
                                alt="" 
                                style={{
                                  position: 'absolute',
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  filter: 'blur(8px) brightness(0.65)',
                                  opacity: 0.8
                                }}
                              />
                              <img 
                                src={`/api/transfer/shared/download?id=${file.id}&preview=true`} 
                                alt={file.fileName}
                                style={{
                                  position: 'relative',
                                  maxHeight: '85%',
                                  maxWidth: '85%',
                                  objectFit: 'contain',
                                  borderRadius: '6px',
                                  boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
                                  zIndex: 2,
                                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                                className="grid-thumbnail-image"
                              />
                            </>
                          ) : (
                            renderFileExtIcon(file.fileName)
                          )}

                          {/* 悬浮预览小 Badge */}
                          {isPreviewable && (
                            <span className="grid-preview-badge" style={{
                              position: 'absolute',
                              top: '10px',
                              left: '10px',
                              zIndex: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                            }}>
                              <Eye size={10} />
                              <span>在线预览</span>
                            </span>
                          )}
                        </div>

                        {/* 下半部：卡片信息与操作按钮区 */}
                        <div style={{
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          flex: 1
                        }}>
                          {/* 文件名 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span 
                              className="grid-card-filename"
                              style={{ 
                                fontSize: '0.82rem', 
                                fontWeight: 700, 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block'
                              }}
                              title={file.fileName}
                            >
                              {file.fileName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {formatBytes(file.fileSize)} · {dateStr}
                            </span>
                          </div>

                          {/* 设备 Badge 与操作按钮 */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                            paddingTop: '8px',
                            marginTop: 'auto'
                          }}>
                            {renderDeviceBadge(file.deviceInfo)}
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {/* 移入收纳盒按钮与气泡菜单 */}
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMoveMenuFileId(activeMoveMenuFileId === file.id ? null : file.id);
                                  }}
                                  title="移入收纳盒"
                                  className="action-btn-circle box-glow"
                                  style={{
                                    border: 'none',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    background: activeMoveMenuFileId === file.id ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                  }}
                                >
                                  <FolderOpen size={12} style={{ color: '#e5c07b' }} />
                                </button>

                                {/* 移入盒子气泡菜单 */}
                                {activeMoveMenuFileId === file.id && (
                                  <div 
                                    onClick={e => e.stopPropagation()}
                                    className="box-move-popup-menu"
                                    style={{
                                      position: 'absolute',
                                      bottom: '34px',
                                      right: '0',
                                      width: '180px',
                                      borderRadius: '12px',
                                      padding: '6px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                      zIndex: 100,
                                      background: 'rgba(30, 30, 35, 0.9)',
                                      backdropFilter: 'blur(20px)',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                      animation: 'preview-scale-up-elastic 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                    }}
                                  >
                                    <span style={{ fontSize: '0.65rem', color: '#8e8e93', padding: '4px 8px', fontWeight: 700, display: 'block' }}>整理收纳至：</span>
                                    
                                    {file.boxId && (
                                      <button 
                                        onClick={() => handleMoveFile(file.id, null)}
                                        className="box-move-item-btn"
                                        style={{
                                          border: 'none',
                                          width: '100%',
                                          padding: '6px 8px',
                                          borderRadius: '8px',
                                          background: 'transparent',
                                          color: '#ffffff',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          textAlign: 'left',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        <span>📦 释放至大厅 (未分类)</span>
                                      </button>
                                    )}

                                    {boxes.map(box => {
                                      if (box.id === file.boxId) return null;
                                      return (
                                        <button 
                                          key={box.id}
                                          onClick={() => handleMoveFile(file.id, box.id)}
                                          className="box-move-item-btn"
                                          style={{
                                            border: 'none',
                                            width: '100%',
                                            padding: '6px 8px',
                                            borderRadius: '8px',
                                            background: 'transparent',
                                            color: '#ffffff',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            textAlign: 'left',
                                            transition: 'all 0.15s'
                                          }}
                                        >
                                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: box.color, marginRight: '6px', shrink: 0 }} />
                                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{box.name}</span>
                                        </button>
                                      );
                                    })}

                                    {boxes.length === 0 && !file.boxId && (
                                      <span style={{ fontSize: '0.7rem', color: '#8e8e93', padding: '6px 8px', textAlign: 'center', display: 'block' }}>暂无可用的收纳盒</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {isPreviewable && (
                                <button
                                  onClick={() => setPreviewFile(file)}
                                  title="在线预览"
                                  className="action-btn-circle preview-glow"
                                  style={{
                                    border: 'none',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                  }}
                                >
                                  <Eye size={12} style={{ color: 'var(--accent-color)' }} />
                                </button>
                              )}

                              <a
                                href={`/api/transfer/shared/download?id=${file.id}`}
                                download={file.fileName}
                                style={{ textDecoration: 'none' }}
                              >
                                <button
                                  title="极速下载"
                                  className="action-btn-circle download-glow"
                                  style={{
                                    border: 'none',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                  }}
                                >
                                  <Download size={12} style={{ color: '#10b981' }} />
                                </button>
                              </a>

                              <button
                                onClick={() => handleDelete(file.id)}
                                title="物理删除"
                                className="action-btn-circle delete-glow"
                                style={{
                                  border: 'none',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                              >
                                <Trash2 size={12} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* 精细列表视图骨架 */}
              {viewMode === 'list' && (
                <div className="orbit-files-list-container" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%'
                }}>
                  {paginatedFiles.map((file) => {
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
                        className="orbit-list-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          borderRadius: '12px',
                          transition: 'all 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: isPreviewable ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (isPreviewable) setPreviewFile(file);
                        }}
                      >
                        {/* 左侧：文件图标与文件名 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1', minWidth: 0 }}>
                          <div className="list-row-icon-shell" style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: getFileIconBg(file.fileName),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {getFileIcon(file.fileName)}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span 
                                className="list-row-filename"
                                style={{ 
                                  fontSize: '0.85rem', 
                                  fontWeight: 700, 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={file.fileName}
                              >
                                {file.fileName}
                              </span>
                              {isPreviewable && (
                                <span className="list-preview-pill" style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                }}>
                                  <Eye size={10} />
                                  <span>在线预览</span>
                                </span>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              <span>{formatBytes(file.fileSize)}</span>
                              <span>•</span>
                              <span>{dateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* 右侧：设备徽章与操作按钮组 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {renderDeviceBadge(file.deviceInfo)}
                          
                          <div className="list-row-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* 移入收纳盒按钮与气泡菜单 */}
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMoveMenuFileId(activeMoveMenuFileId === file.id ? null : file.id);
                                }}
                                title="移入收纳盒"
                                className="action-btn-circle box-glow"
                                style={{
                                  border: 'none',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  background: activeMoveMenuFileId === file.id ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                              >
                                <FolderOpen size={12} style={{ color: '#e5c07b' }} />
                              </button>

                              {/* 移入盒子气泡菜单 */}
                              {activeMoveMenuFileId === file.id && (
                                <div 
                                  onClick={e => e.stopPropagation()}
                                  className="box-move-popup-menu"
                                  style={{
                                    position: 'absolute',
                                    bottom: '34px',
                                    right: '0',
                                    width: '180px',
                                    borderRadius: '12px',
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    zIndex: 100,
                                    background: 'rgba(30, 30, 35, 0.9)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                                    animation: 'preview-scale-up-elastic 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                  }}
                                >
                                  <span style={{ fontSize: '0.65rem', color: '#8e8e93', padding: '4px 8px', fontWeight: 700, display: 'block' }}>整理收纳至：</span>
                                  
                                  {file.boxId && (
                                    <button 
                                      onClick={() => handleMoveFile(file.id, null)}
                                      className="box-move-item-btn"
                                      style={{
                                        border: 'none',
                                        width: '100%',
                                        padding: '6px 8px',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        color: '#ffffff',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        textAlign: 'left',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span>📦 释放至大厅 (未分类)</span>
                                    </button>
                                  )}

                                  {boxes.map(box => {
                                    if (box.id === file.boxId) return null;
                                    return (
                                      <button 
                                        key={box.id}
                                        onClick={() => handleMoveFile(file.id, box.id)}
                                        className="box-move-item-btn"
                                        style={{
                                          border: 'none',
                                          width: '100%',
                                          padding: '6px 8px',
                                          borderRadius: '8px',
                                          background: 'transparent',
                                          color: '#ffffff',
                                          fontSize: '0.72rem',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          textAlign: 'left',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: box.color, marginRight: '6px', shrink: 0 }} />
                                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>{box.name}</span>
                                      </button>
                                    );
                                  })}

                                  {boxes.length === 0 && !file.boxId && (
                                    <span style={{ fontSize: '0.7rem', color: '#8e8e93', padding: '6px 8px', textAlign: 'center', display: 'block' }}>暂无可用的收纳盒</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {isPreviewable && (
                              <button
                                onClick={() => setPreviewFile(file)}
                                title="在线预览"
                                className="action-btn-circle preview-glow"
                                style={{
                                  border: 'none',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                              >
                                <Eye size={12} style={{ color: 'var(--accent-color)' }} />
                              </button>
                            )}

                            <a
                              href={`/api/transfer/shared/download?id=${file.id}`}
                              download={file.fileName}
                              style={{ textDecoration: 'none' }}
                            >
                              <button
                                title="极速下载"
                                className="action-btn-circle download-glow"
                                style={{
                                  border: 'none',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}
                              >
                                <Download size={12} style={{ color: '#10b981' }} />
                              </button>
                            </a>

                            <button
                              onClick={() => handleDelete(file.id)}
                              title="物理删除"
                              className="action-btn-circle delete-glow"
                              style={{
                                border: 'none',
                                width: '26px',
                                height: '26px',
                                  borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                              }}
                            >
                              <Trash2 size={12} style={{ color: '#ef4444' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 智能磨砂玻璃分页控制器 */}
              {totalItems > 0 && (
                <div className="hub-pagination-bar" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: '14px',
                  marginTop: '16px',
                  gap: '16px',
                  flexWrap: 'wrap',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                  {/* 左侧：数据区间统计说明 */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>当前展示 </span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{startIndex + 1}</strong>
                    <span> - </span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{endIndex}</strong>
                    <span> 项，共 </span>
                    <strong style={{ color: 'var(--accent-color)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{totalItems}</strong>
                    <span> 项</span>
                  </div>

                  {/* 中间：页码数字按钮组与上一页/下一页 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="pagination-arrow-btn"
                      style={{
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      <span>上一页</span>
                    </button>

                    {/* 页码渲染逻辑 */}
                    {(() => {
                      const pages = [];
                      const maxVisible = 5;
                      
                      if (totalPages <= maxVisible) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        let start = Math.max(2, safeCurrentPage - 1);
                        let end = Math.min(totalPages - 1, safeCurrentPage + 1);
                        
                        if (safeCurrentPage <= 2) {
                          end = 4;
                        }
                        if (safeCurrentPage >= totalPages - 1) {
                          start = totalPages - 3;
                        }
                        
                        if (start > 2) {
                          pages.push('ellipsis-start');
                        }
                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }
                        if (end < totalPages - 1) {
                          pages.push('ellipsis-end');
                        }
                        pages.push(totalPages);
                      }

                      return pages.map((page, idx) => {
                        if (typeof page === 'string') {
                          return (
                            <span key={`ell-${idx}`} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`pagination-num-btn ${safeCurrentPage === page ? 'active' : ''}`}
                            style={{
                              border: 'none',
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="pagination-arrow-btn"
                      style={{
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      <span>下一页</span>
                    </button>
                  </div>

                  {/* 右侧：单页容量 pageSize 调整选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>每页显示:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="pagination-size-select"
                      style={{
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      <option value={8}>8 项</option>
                      <option value={12}>12 项</option>
                      <option value={24}>24 项</option>
                      <option value={48}>48 项</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* 在线多媒体预览浮层弹窗 */}
      {previewFile && (
        <FilePreviewModal 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
        />
      )}

      {/* 共享文件物理删除确认组件库弹窗 */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="rounded-xl border-border/70 bg-popover sm:max-w-[420px]" showCloseButton={true}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive">
                <ShieldAlert size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm font-bold tracking-tight text-foreground">
                  确认删除
                </DialogTitle>
                <DialogDescription className="mt-2 text-xs leading-5 text-muted-foreground">
                  确认要物理删除此共享文件吗？删除后局域网其他伙伴将无法下载。
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end mt-2">
            <ShadcnButton 
              variant="outline" 
              onClick={() => setIsDeleteModalOpen(false)} 
              className="rounded-lg h-8 text-xs"
            >
              取消
            </ShadcnButton>
            <ShadcnButton 
              variant="destructive" 
              onClick={executeDelete} 
              className="rounded-lg h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              确定删除
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. 新建收纳盒极客弹框组件 (Box Creation Deck Dialog) */}
      <Dialog open={isCreateBoxModalOpen} onOpenChange={setIsCreateBoxModalOpen}>
        <DialogContent className="rounded-xl border-border/70 bg-popover sm:max-w-[440px]" showCloseButton={true}>
          <form onSubmit={handleCreateBox} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DialogHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                  border: '1px solid rgba(99,102,241,0.2)'
                }}>
                  <FolderOpen size={16} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <DialogTitle style={{ fontSize: '0.92rem', fontWeight: 800 }}>建立新收纳盒</DialogTitle>
                  <DialogDescription style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                    在公共共享空间中建立独立的文件夹分类收纳舱
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', py: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>收纳盒名称</label>
                <input 
                  type="text" 
                  required
                  placeholder="例如：视觉UI稿、前端周报"
                  value={newBoxName}
                  onChange={(e) => setNewBoxName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.15)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>盒子描述 (可选)</label>
                <textarea 
                  placeholder="简单描述一下这个盒子的分类用途..."
                  value={newBoxDescription}
                  onChange={(e) => setNewBoxDescription(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.15)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              {/* 预设 HSL 极客渐变配色挑选仓 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>专属极客渐变配色</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {[
                    'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', // 熔岩橙
                    'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)', // 霓虹紫
                    'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)', // 极光蓝
                    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', // 翡翠绿
                    'linear-gradient(135deg, #f12711 0%, #f5af19 100%)'  // 日落金
                  ].map((gradient, index) => {
                    const isSelected = newBoxColor === gradient || (newBoxColor === '' && index === 0);
                    return (
                      <button
                        type="button"
                        key={gradient}
                        onClick={() => setNewBoxColor(gradient)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: gradient,
                          border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                          transform: isSelected ? 'scale(1.15)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <ShadcnButton 
                type="button"
                variant="outline" 
                onClick={() => setIsCreateBoxModalOpen(false)} 
                className="rounded-lg h-8 text-xs"
              >
                取消
              </ShadcnButton>
              <ShadcnButton 
                type="submit" 
                className="rounded-lg h-8 text-xs bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm"
              >
                一键创建
              </ShadcnButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 亮暗双色主题高精美 Glassmorphism 全局及微交互 CSS */}
      <style jsx global>{`
        /* ================= 1. 顶部 Control Hub 配色与特效 ================= */
        .control-hub-panel {
          background: rgba(30, 30, 35, 0.45) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.2) !important;
        }
        
        [data-theme='light'] .control-hub-panel {
          background: rgba(255, 255, 255, 0.75) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.03) !important;
        }

        .search-input-shell input {
          background: rgba(0, 0, 0, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: var(--text-primary) !important;
        }
        .search-input-shell input:focus {
          border-color: rgba(99, 102, 241, 0.6) !important;
          background: rgba(0, 0, 0, 0.28) !important;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.15) !important;
        }

        [data-theme='light'] .search-input-shell input {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .search-input-shell input:focus {
          border-color: rgba(99, 102, 241, 0.5) !important;
          background: #ffffff !important;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.08) !important;
        }

        .view-mode-pill {
          background: rgba(0, 0, 0, 0.15) !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
        }
        [data-theme='light'] .view-mode-pill {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
        }

        .view-switch-btn {
          background: transparent !important;
          color: var(--text-muted) !important;
        }
        .view-switch-btn.active {
          background: rgba(255, 255, 255, 0.08) !important;
          color: var(--accent-color) !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
        }
        [data-theme='light'] .view-switch-btn.active {
          background: #ffffff !important;
          color: var(--accent-color) !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06) !important;
        }

        /* 胶囊过滤器样式 */
        .capsule-tab-btn {
          border: none !important;
          padding: 6px 14px !important;
          border-radius: 20px !important;
          font-size: 0.76rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          color: var(--text-secondary) !important;
          white-space: nowrap !important;
        }
        .capsule-tab-btn:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-primary) !important;
        }
        .capsule-tab-btn.active {
          background: rgba(59, 130, 246, 0.12) !important;
          border-color: rgba(59, 130, 246, 0.25) !important;
          color: var(--accent-color) !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08) !important;
        }

        [data-theme='light'] .capsule-tab-btn {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .capsule-tab-btn:hover {
          background: rgba(0, 0, 0, 0.04) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .capsule-tab-btn.active {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.18) !important;
        }

        .hub-sort-select {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          color: var(--text-secondary) !important;
        }
        .hub-sort-select:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .hub-sort-select {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.05) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .hub-sort-select:hover {
          background: rgba(0, 0, 0, 0.04) !important;
          color: var(--text-primary) !important;
        }

        .files-count-badge {
          background: rgba(255, 255, 255, 0.04) !important;
          color: var(--text-secondary) !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
        }
        [data-theme='light'] .files-count-badge {
          background: rgba(0, 0, 0, 0.03) !important;
          color: var(--text-secondary) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
        }

        /* ================= 收纳盒卡片仓 (Box Decks Deck) ================= */
        .box-deck-card {
          position: relative;
          overflow: hidden;
        }
        .box-card-glow-bg {
          position: absolute;
          top: -30px;
          right: -30px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          filter: blur(15px);
          pointer-events: none;
          z-index: 1;
        }
        .box-deck-card:hover {
          transform: translateY(-2.5px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        .box-deck-card.active {
          transform: scale(1.02);
        }
        .box-deck-card:hover .box-delete-icon-btn {
          opacity: 1 !important;
          transform: scale(1);
        }
        .box-delete-icon-btn {
          opacity: 0 !important;
          transform: scale(0.9);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .box-delete-icon-btn:hover {
          background: rgba(239, 68, 68, 0.25) !important;
        }
        [data-theme='light'] .box-deck-card:not(.active) {
          background: rgba(0, 0, 0, 0.02) !important;
          border-color: rgba(0, 0, 0, 0.05) !important;
        }
        [data-theme='light'] .box-deck-card:not(.active):hover {
          background: rgba(0, 0, 0, 0.04) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
        }
        .box-create-trigger-card:hover {
          border-color: var(--accent-color) !important;
          background: rgba(99, 102, 241, 0.015) !important;
          transform: translateY(-1.5px);
        }
        [data-theme='light'] .box-create-trigger-card {
          border-color: rgba(0, 0, 0, 0.08) !important;
        }
        [data-theme='light'] .box-create-trigger-card:hover {
          border-color: var(--accent-color) !important;
          background: rgba(99, 102, 241, 0.02) !important;
        }

        /* ================= 移入盒子气泡菜单 ================= */
        .box-move-popup-menu {
          background: rgba(30, 30, 35, 0.92) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
        }
        [data-theme='light'] .box-move-popup-menu {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.12) !important;
        }
        .box-move-item-btn {
          transition: all 0.15s;
        }
        .box-move-item-btn:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--accent-color) !important;
        }
        [data-theme='light'] .box-move-item-btn {
          color: #1f2937 !important;
        }
        [data-theme='light'] .box-move-item-btn:hover {
          background: rgba(99, 102, 241, 0.05) !important;
          color: var(--accent-color) !important;
        }

        /* ================= 2. 左侧闪传投递舱 (Upload Cabin) ================= */
        .drop-zone-cabin {
          background: rgba(30, 30, 35, 0.45) !important;
          box-shadow: 0 15px 25px rgba(0, 0, 0, 0.15) !important;
        }
        [data-theme='light'] .drop-zone-cabin {
          background: rgba(255, 255, 255, 0.75) !important;
          box-shadow: 0 15px 25px rgba(0, 0, 0, 0.02) !important;
        }

        .drop-zone-glow-aura {
          position: absolute;
          top: -40px;
          left: -40px;
          right: -40px;
          bottom: -40px;
          background: radial-gradient(circle at center, rgba(99,102,241,0.04) 0%, transparent 65%);
          z-index: 1;
          pointer-events: none;
          transition: background 0.3s;
        }

        .drop-zone-cabin.drag-over {
          border-color: var(--accent-color) !important;
          box-shadow: 0 0 25px rgba(59, 130, 246, 0.25) !important;
          background: rgba(59, 130, 246, 0.03) !important;
        }
        .drop-zone-cabin.drag-over .drop-zone-glow-aura {
          background: radial-gradient(circle at center, rgba(59,130,246,0.08) 0%, transparent 70%);
        }

        .drop-zone-cabin.drag-over .cloud-upload-icon-anim {
          animation: drop-bounce 0.8s infinite alternate cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .cabin-select-btn {
          background: linear-gradient(135deg, var(--accent-color), #2563eb) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.2) !important;
        }
        .cabin-select-btn:hover {
          filter: brightness(1.15) !important;
          box-shadow: 0 6px 18px rgba(59, 130, 246, 0.3) !important;
          transform: translateY(-1px);
        }

        .upload-progress-cabin {
          background: rgba(30, 30, 35, 0.45) !important;
          box-shadow: 0 15px 25px rgba(0, 0, 0, 0.15) !important;
        }
        [data-theme='light'] .upload-progress-cabin {
          background: rgba(255, 255, 255, 0.75) !important;
          box-shadow: 0 15px 25px rgba(0, 0, 0, 0.02) !important;
        }

        .cabin-info-card {
          background: rgba(255, 255, 255, 0.01) !important;
          background: rgba(255, 255, 255, 0.01) !important;
        }
        [data-theme='light'] .cabin-info-card {
          background: rgba(0, 0, 0, 0.01) !important;
          border-color: rgba(0, 0, 0, 0.04) !important;
        }

        /* 立体水滴波浪球动画 */
        .water-sine-wave {
          position: absolute;
          width: 200%;
          height: 200%;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 38%;
          left: -50%;
          bottom: 0;
          pointer-events: none;
        }
        .wave-1 {
          animation: spin-sine-1 7s linear infinite;
        }
        .wave-2 {
          animation: spin-sine-2 9s linear infinite;
          border-radius: 40%;
          background: rgba(255, 255, 255, 0.08);
        }

        @keyframes spin-sine-1 {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-4px) rotate(360deg); }
        }
        @keyframes spin-sine-2 {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-2px) rotate(-360deg); }
        }

        /* ================= 3. 右侧网格卡片 (Grid Card) ================= */
        .orbit-grid-card {
          background: rgba(30, 30, 35, 0.4) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
        }
        .orbit-grid-card:hover {
          border-color: rgba(99, 102, 241, 0.22) !important;
          box-shadow: 0 12px 24px rgba(99, 102, 241, 0.06), 0 4px 10px rgba(0, 0, 0, 0.12) !important;
          transform: translateY(-3px) scale(1.01);
        }

        [data-theme='light'] .orbit-grid-card {
          background: rgba(255, 255, 255, 0.7) !important;
          border: 1px solid rgba(0, 0, 0, 0.05) !important;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.02) !important;
        }
        [data-theme='light'] .orbit-grid-card:hover {
          border-color: rgba(99, 102, 241, 0.2) !important;
          box-shadow: 0 12px 24px rgba(99, 102, 241, 0.05), 0 4px 10px rgba(0, 0, 0, 0.03) !important;
          transform: translateY(-3px) scale(1.01);
        }

        .grid-card-thumbnail-wrapper {
          background: rgba(0, 0, 0, 0.25) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
        }
        [data-theme='light'] .grid-card-thumbnail-wrapper {
          background: rgba(0, 0, 0, 0.02) !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
        }

        .orbit-grid-card:hover .grid-thumbnail-image {
          transform: scale(1.05) rotate(1deg);
        }
        .orbit-grid-card:hover .grid-thumbnail-icon-shell {
          transform: scale(1.08) rotate(-2deg);
        }

        .grid-preview-badge {
          background: rgba(9, 9, 11, 0.7) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #d4d4d8 !important;
          backdrop-filter: blur(8px) !important;
        }
        [data-theme='light'] .grid-preview-badge {
          background: rgba(255, 255, 255, 0.85) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: #4b5563 !important;
          backdrop-filter: blur(8px) !important;
        }

        .grid-card-filename {
          color: var(--text-primary) !important;
        }

        /* 圆形微动效操作按钮 */
        .action-btn-circle {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .action-btn-circle:hover {
          transform: scale(1.1) translateY(-0.5px);
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        [data-theme='light'] .action-btn-circle {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
        }
        [data-theme='light'] .action-btn-circle:hover {
          transform: scale(1.1) translateY(-0.5px);
          background: rgba(0, 0, 0, 0.05) !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
        }

        .preview-glow:hover {
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.25) !important;
        }
        .download-glow:hover {
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.25) !important;
        }
        .delete-glow:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          border-color: rgba(239, 68, 68, 0.25) !important;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.25) !important;
        }

        /* ================= 4. 右侧精细列表 (List View) ================= */
        .orbit-list-row {
          background: rgba(30, 30, 35, 0.4) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
        .orbit-list-row:hover {
          background: rgba(30, 30, 35, 0.6) !important;
          border-color: rgba(99, 102, 241, 0.2) !important;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12), 0 0 8px rgba(99,102,241,0.04) !important;
        }

        [data-theme='light'] .orbit-list-row {
          background: rgba(255, 255, 255, 0.7) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
        }
        [data-theme='light'] .orbit-list-row:hover {
          background: rgba(255, 255, 255, 0.9) !important;
          border-color: rgba(99, 102, 241, 0.18) !important;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.03), 0 0 8px rgba(99,102,241,0.03) !important;
        }

        .list-row-filename {
          color: var(--text-primary) !important;
        }

        .list-preview-pill {
          background: rgba(99, 102, 241, 0.1) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          color: #818cf8 !important;
        }
        [data-theme='light'] .list-preview-pill {
          background: rgba(99, 102, 241, 0.06) !important;
          border: 1px solid rgba(99, 102, 241, 0.12) !important;
          color: #4f46e5 !important;
        }

        /* ================= 5. 高阶流光设备 Badge 体系 ================= */
        .custom-device-badge {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .custom-device-badge {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.05) !important;
        }

        /* 苹果设备 */
        .macos-glow {
          background: linear-gradient(135deg, rgba(226, 232, 240, 0.06), rgba(71, 85, 105, 0.06)) !important;
          border-color: rgba(226, 232, 240, 0.15) !important;
          color: #e2e8f0 !important;
          box-shadow: 0 0 8px rgba(226, 232, 240, 0.03);
        }
        [data-theme='light'] .macos-glow {
          background: linear-gradient(135deg, rgba(241, 245, 249, 0.8), rgba(203, 213, 225, 0.8)) !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
          color: #334155 !important;
          box-shadow: none;
        }

        /* Windows 设备 */
        .windows-glow {
          background: linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(37, 99, 235, 0.08)) !important;
          border-color: rgba(96, 165, 250, 0.2) !important;
          color: #60a5fa !important;
          box-shadow: 0 0 8px rgba(37, 99, 235, 0.05);
        }
        [data-theme='light'] .windows-glow {
          background: linear-gradient(135deg, rgba(239, 246, 255, 0.9), rgba(191, 219, 254, 0.9)) !important;
          border-color: rgba(96, 165, 250, 0.3) !important;
          color: #2563eb !important;
          box-shadow: none;
        }

        /* 安卓设备 */
        .android-glow {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.08), rgba(5, 150, 105, 0.08)) !important;
          border-color: rgba(52, 211, 153, 0.2) !important;
          color: #34d399 !important;
          box-shadow: 0 0 8px rgba(5, 150, 105, 0.05);
        }
        [data-theme='light'] .android-glow {
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(167, 243, 208, 0.9)) !important;
          border-color: rgba(52, 211, 153, 0.3) !important;
          color: #059669 !important;
          box-shadow: none;
        }

        /* Linux 与其它设备 */
        .linux-glow {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(217, 119, 6, 0.08)) !important;
          border-color: rgba(251, 191, 36, 0.2) !important;
          color: #fbbf24 !important;
          box-shadow: 0 0 8px rgba(217, 119, 6, 0.05);
        }
        [data-theme='light'] .linux-glow {
          background: linear-gradient(135deg, rgba(255, 251, 235, 0.9), rgba(253, 244, 215, 0.9)) !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
          color: #d97706 !important;
          box-shadow: none;
        }

        /* ================= 6. 影院级多媒体预览弹窗 ================= */
        .preview-overlay {
          background: rgba(6, 6, 8, 0.88) !important;
        }
        [data-theme='light'] .preview-overlay {
          background: rgba(15, 23, 42, 0.6) !important;
        }

        .preview-modal-card-cinema {
          background: rgba(24, 24, 28, 0.72) !important;
          border: 1px solid rgba(255, 255, 255, 0.09) !important;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7) !important;
          backdrop-filter: blur(35px) !important;
          background-image: radial-gradient(circle at top, rgba(99, 102, 241, 0.08) 0%, transparent 65%) !important;
        }
        [data-theme='light'] .preview-modal-card-cinema {
          background: rgba(255, 255, 255, 0.85) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.15) !important;
          backdrop-filter: blur(35px) !important;
          background-image: radial-gradient(circle at top, rgba(99, 102, 241, 0.05) 0%, transparent 65%) !important;
        }

        .preview-header-bar-cinema {
          background: rgba(0, 0, 0, 0.25) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
        [data-theme='light'] .preview-header-bar-cinema {
          background: rgba(0, 0, 0, 0.02) !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
        }

        .preview-header-icon-shell {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
        }
        [data-theme='light'] .preview-header-icon-shell {
          background: rgba(0, 0, 0, 0.02) !important;
          border-color: rgba(0, 0, 0, 0.06) !important;
        }

        .preview-header-title-cinema {
          color: #f4f4f5 !important;
        }
        [data-theme='light'] .preview-header-title-cinema {
          color: #0f172a !important;
        }

        .preview-action-pill {
          background: rgba(59, 130, 246, 0.1) !important;
          border: 1px solid rgba(59, 130, 246, 0.2) !important;
          color: var(--accent-color) !important;
        }
        .preview-action-pill:hover {
          background: rgba(59, 130, 246, 0.16) !important;
          color: #ffffff !important;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.2) !important;
          transform: translateY(-0.5px);
        }
        [data-theme='light'] .preview-action-pill {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
          color: #ffffff !important;
        }
        [data-theme='light'] .preview-action-pill:hover {
          filter: brightness(1.08) !important;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2) !important;
        }

        .preview-close-btn-cinema {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: #a1a1aa !important;
        }
        .preview-close-btn-cinema:hover {
          background: rgba(239, 68, 68, 0.12) !important;
          border-color: rgba(239, 68, 68, 0.25) !important;
          color: #fca5a5 !important;
        }
        [data-theme='light'] .preview-close-btn-cinema {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: #4b5563 !important;
        }
        [data-theme='light'] .preview-close-btn-cinema:hover {
          background: rgba(239, 68, 68, 0.08) !important;
          border-color: rgba(239, 68, 68, 0.2) !important;
          color: #ef4444 !important;
        }

        /* 磨砂黑白棋盘格预览展示区 */
        .preview-content-area-cinema {
          background-color: #0d0d0f !important;
          background-image: linear-gradient(45deg, #131316 25%, transparent 25%, transparent 75%, #131316 75%, #131316), 
                            linear-gradient(45deg, #131316 25%, transparent 25%, transparent 75%, #131316 75%, #131316) !important;
          background-size: 24px 24px !important;
          background-position: 0 0, 12px 12px !important;
        }
        [data-theme='light'] .preview-content-area-cinema {
          background-color: #fafafc !important;
          background-image: linear-gradient(45deg, #f1f1f5 25%, transparent 25%, transparent 75%, #f1f1f5 75%, #f1f1f5), 
                            linear-gradient(45deg, #f1f1f5 25%, transparent 25%, transparent 75%, #f1f1f5 75%, #f1f1f5) !important;
        }

        .preview-loading-box {
          background: rgba(9, 9, 11, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #d4d4d8 !important;
          backdrop-filter: blur(8px) !important;
        }
        [data-theme='light'] .preview-loading-box {
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: #4b5563 !important;
        }

        .preview-img-element-cinema {
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5) !important;
        }
        [data-theme='light'] .preview-img-element-cinema {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08) !important;
        }

        /* 唱片机高级呼吸光圈 */
        .preview-audio-shell {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
        }
        [data-theme='light'] .preview-audio-shell {
          background: rgba(0,0,0,0.02) !important;
          border-color: rgba(0,0,0,0.06) !important;
          box-shadow: 0 15px 30px rgba(0,0,0,0.04) !important;
        }

        .preview-audio-name-cinema {
          color: #f4f4f5 !important;
        }
        [data-theme='light'] .preview-audio-name-cinema {
          color: #0f172a !important;
        }

        .audio-disc-neon-container {
          background: rgba(59, 130, 246, 0.03) !important;
          border: 1px solid rgba(59, 130, 246, 0.1) !important;
        }
        .audio-disc-neon-pulse {
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          border-radius: 50%;
          background: conic-gradient(from 180deg, var(--accent-color), #3b82f6, #60a5fa, var(--accent-color));
          opacity: 0.15;
          filter: blur(12px);
          animation: spin 8s linear infinite;
        }

        .disc-grooves {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 50%;
          background: repeating-radial-gradient(circle, transparent, transparent 3px, rgba(255,255,255,0.01) 4px, rgba(255,255,255,0.02) 5px);
          pointer-events: none;
        }

        .preview-unsupported-box {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
        }
        [data-theme='light'] .preview-unsupported-box {
          background: rgba(0,0,0,0.02) !important;
          border-color: rgba(0,0,0,0.05) !important;
        }

        .preview-action-btn-primary {
          background: linear-gradient(135deg, var(--accent-color), #2563eb) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2) !important;
        }
        .preview-action-btn-primary:hover {
          filter: brightness(1.1) !important;
          transform: translateY(-0.5px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3) !important;
        }

        /* 预览控制条 */
        .preview-bottom-toolbar-cinema {
          border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
          background: rgba(0, 0, 0, 0.25) !important;
        }
        [data-theme='light'] .preview-bottom-toolbar-cinema {
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
          background: rgba(0, 0, 0, 0.02) !important;
        }

        .preview-toolbar-btn-cinema {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: #d4d4d8 !important;
        }
        .preview-toolbar-btn-cinema:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        [data-theme='light'] .preview-toolbar-btn-cinema {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: #4b5563 !important;
        }
        [data-theme='light'] .preview-toolbar-btn-cinema:hover {
          background: rgba(0, 0, 0, 0.06) !important;
          color: #0f172a !important;
          border-color: rgba(0, 0, 0, 0.12) !important;
        }

        /* ================= 7. 全局动效 ================= */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes preview-scale-up-elastic {
          0% {
            opacity: 0;
            transform: scale(0.93) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-back {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        .animate-spin-fast {
          animation: spin 0.8s linear infinite;
        }

        @keyframes drop-bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-6px); }
        }

        /* 响应式样式适配 */
        @media (max-width: 1024px) {
          .share-center-workspace-columns {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .upload-cabin-aside {
            width: 100% !important;
          }
        }

        @media (max-width: 640px) {
          .control-hub-panel {
            padding: 12px 14px !important;
          }
          .search-input-shell {
            max-width: 100% !important;
            width: 100% !important;
            order: 2;
          }
          .control-hub-top-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .control-hub-top-row > div:last-child {
            justify-content: space-between !important;
            width: 100% !important;
          }
          .orbit-files-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
          }
          .grid-card-thumbnail-wrapper {
            height: 90px !important;
          }
          .hub-pagination-bar {
            padding: 8px 10px !important;
            flex-direction: column !important;
            gap: 10px !important;
            align-items: center !important;
          }
        }

        /* ================= 8. 高保真磨砂玻璃分页控制器 CSS ================= */
        .hub-pagination-bar {
          background: rgba(30, 30, 35, 0.35) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1) !important;
        }
        [data-theme='light'] .hub-pagination-bar {
          background: rgba(255, 255, 255, 0.6) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.02) !important;
        }

        .pagination-arrow-btn {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: var(--text-secondary) !important;
        }
        .pagination-arrow-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08) !important;
          color: var(--text-primary) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .pagination-arrow-btn:disabled {
          opacity: 0.35 !important;
          cursor: not-allowed !important;
        }

        [data-theme='light'] .pagination-arrow-btn {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .pagination-arrow-btn:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.04) !important;
          color: var(--text-primary) !important;
          border-color: rgba(0, 0, 0, 0.1) !important;
        }

        .pagination-num-btn {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          color: var(--text-secondary) !important;
        }
        .pagination-num-btn:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-primary) !important;
          transform: scale(1.05);
        }
        .pagination-num-btn.active {
          background: linear-gradient(135deg, var(--accent-color), #3b82f6) !important;
          border-color: var(--accent-color) !important;
          color: #ffffff !important;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3) !important;
          transform: scale(1.05);
        }

        [data-theme='light'] .pagination-num-btn {
          background: rgba(0, 0, 0, 0.015) !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .pagination-num-btn:hover {
          background: rgba(0, 0, 0, 0.04) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .pagination-num-btn.active {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2) !important;
        }

        .pagination-size-select {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: var(--text-secondary) !important;
        }
        .pagination-size-select:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .pagination-size-select {
          background: rgba(0, 0, 0, 0.02) !important;
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          color: var(--text-secondary) !important;
        }
        [data-theme='light'] .pagination-size-select:hover {
          background: rgba(0, 0, 0, 0.04) !important;
          color: var(--text-primary) !important;
        }
      `}</style>
    </div>
  );
};
export default SharedFiles;
