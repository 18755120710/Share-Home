'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMdnsPeers } from '@/hooks/useMdnsPeers';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { SocketClient } from '@/lib/socketClient';
import PeerList from '@/components/features/peers/PeerList';
import Transfer from '@/components/features/transfer/Transfer';
import SharedFiles from '@/components/features/transfer/SharedFiles';
import RecordCenter from '@/components/features/transfer/RecordCenter';
import KnowledgeBase from '@/components/features/knowledge-base/KnowledgeBase';
import Button from '@/components/ui/LegacyButton';
import Card from '@/components/ui/LegacyCard';
import { Button as ShadcnButton } from '@/components/ui/button';
import { Card as ShadcnCard, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input as ShadcnInput } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Radio, RefreshCw, Laptop, Monitor, Smartphone, Edit3, Check, 
  Files, FileText, Settings, ShieldAlert, FolderOpen,
  Info, Cpu, Link, Server, Sun, Moon, ArrowUpDown, X, Bell,
  History, ArrowRight, CheckCircle2, XCircle, Ban,
  ChevronLeft, ChevronRight, ChevronDown, KeyRound, LogOut,
  Users, ShieldCheck, Lock, UserRound, Eye, EyeOff
} from 'lucide-react';

type ActiveTab = 'transfer' | 'share' | 'knowledge' | 'settings' | 'history-transfer' | 'history-share' | 'history-document' | 'users' | 'admin-settings';

export default function Home() {
  // ==================== 局域网安全与权限管理状态 ====================
  const [authStatus, setAuthStatus] = useState<'loading' | 'uninitialized' | 'unauthorized' | 'authorized'>('loading');
  const [role, setRole] = useState<'admin' | 'guest' | null>(null);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [myPermissions, setMyPermissions] = useState<{ allowUpload: boolean; allowEditDoc: boolean; allowCreateDoc: boolean }>({
    allowUpload: true,
    allowEditDoc: true,
    allowCreateDoc: true
  });

  // 网页自愈配置状态
  const [initAdminUser, setInitAdminUser] = useState('admin');
  const [initAdminPass, setInitAdminPass] = useState('');
  const [initGuestPass, setInitGuestPass] = useState('');
  const [initIsLocal, setInitIsLocal] = useState(true); // 判定是否为回环
  const [initError, setInitError] = useState('');

  // 双通道登录页状态
  const [loginTab, setLoginTab] = useState<'guest' | 'admin'>('guest');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginGuestPass, setLoginGuestPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLogining, setIsLogining] = useState(false);

  // 用户管理特权面板状态
  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [isUpdatingDevicePerm, setIsUpdatingDevicePerm] = useState<string | null>(null);
  const [newGuestKeyInput, setNewGuestKeyInput] = useState('');
  const [guestKeyStatus, setGuestKeyStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [guestKeyError, setGuestKeyError] = useState('');
  const [noticeDialog, setNoticeDialog] = useState<{
    title: string;
    description?: string;
    variant: 'info' | 'error';
    permissions?: { allowUpload: boolean; allowEditDoc: boolean; allowCreateDoc: boolean };
  } | null>(null);

  // ==================== 管理员账户设置状态 ====================
  const [adminUsername, setAdminUsername] = useState('admin');
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('admin');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [adminSettingsStatus, setAdminSettingsStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [adminSettingsError, setAdminSettingsError] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // ==================== 管理员 2FA 两步验证状态 ====================
  const [admin2faEnabled, setAdmin2faEnabled] = useState(false);
  const [temp2faSecret, setTemp2faSecret] = useState('');
  const [temp2faQrUri, setTemp2faQrUri] = useState('');
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [totpLoginCode, setTotpLoginCode] = useState('');
  const [totp2faStatus, setTotp2faStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [totp2faError, setTotp2faError] = useState('');
  const [use2faLogin, setUse2faLogin] = useState(false);
  const [disable2faPass, setDisable2faPass] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [is2faBindingActive, setIs2faBindingActive] = useState(false);

  // 1. 初始化探针会话校验
  const checkSession = async (tokenToCheck?: string) => {
    const activeToken = tokenToCheck || localStorage.getItem('share_home_token') || '';
    
    try {
      const res = await fetch('/api/auth/session', {
        headers: activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}
      });
      const data = await res.json();
      
      if (data.admin2faEnabled !== undefined) {
        setAdmin2faEnabled(data.admin2faEnabled);
        // 如果是首次加载页面，根据是否启用了 2FA 来初始化 use2faLogin 选项
        if (authStatus === 'loading') {
          setUse2faLogin(data.admin2faEnabled);
        }
      }

      if (data.success) {
        setRole(data.role);
        setMyClientId(data.clientId);
        setMyPermissions(data.permissions);
        setAuthStatus('authorized');
        // 同步 LocalStorage client_id
        if (data.clientId) {
          localStorage.setItem('share_home_client_id', data.clientId);
        }
      } else {
        // 校验失败
        if (data.error === 'auth_not_initialized') {
          // 安全检测：检查当前客户端是否为本地回环以决定是否允许在网页初始化
          const requestIp = data.ip || '127.0.0.1';
          const isLocal = requestIp === '127.0.0.1' || requestIp === '::1' || requestIp === 'localhost';
          setInitIsLocal(isLocal);
          setAuthStatus('uninitialized');
        } else {
          localStorage.removeItem('share_home_token');
          setAuthStatus('unauthorized');
        }
      }
    } catch (err) {
      console.error('[Session] 会话鉴权异常，默认退避到登录状态:', err);
      setAuthStatus('unauthorized');
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    // 🌟 【网关级秒级权限变更订阅】：订阅 WebSocket 发送的 permissions:update 广播！
    const socket = SocketClient.getInstance();
    const unsubPermsUpdate = socket.subscribe('permissions:update', (data: any) => {
      // 这里的 data 结构为 { clientId, permissions }
      if (myClientId && data.clientId === myClientId) {
        console.log('[WebSocket] 监听到超级管理员实时更新了您的设备权限:', data.permissions);
        setMyPermissions(data.permissions);
        
        setNoticeDialog({
          title: '您的操作权限已更新',
          description: '超级管理员刚刚调整了这台设备的可用功能。',
          variant: 'info',
          permissions: data.permissions
        });
      }
    });

    return () => {
      unsubPermsUpdate();
    };
  }, [myClientId]);

  // 2. 触发网页密码初始化配置
  const handleInitAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initAdminPass || !initGuestPass) {
      setInitError('密码和通用密钥均不能为空。');
      return;
    }
    setInitError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          adminUsername: initAdminUser,
          adminPassword: initAdminPass,
          guestPass: initGuestPass
        })
      });
      const data = await res.json();
      if (data.success) {
        // 初始化成功，自动帮该管理员进行一次登录，体验极其丝滑！
        await handleLoginExecute(initAdminUser, initAdminPass, 'admin');
      } else {
        setInitError(data.error || '写入物理密码配置失败，请检查写入权限。');
      }
    } catch (err: any) {
      setInitError(err.message || '网络连接异常');
    }
  };

  // 3. 执行登录请求
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLogining(true);

    try {
      if (loginTab === 'admin') {
        if (use2faLogin) {
          if (!totpLoginCode || totpLoginCode.trim().length !== 6) {
            setLoginError('请输入手机 App 上生成的 6 位 2FA 两步验证码');
            setIsLogining(false);
            return;
          }
          await handleLoginExecute('', '', 'admin', undefined, totpLoginCode.trim());
        } else {
          if (!loginUser || !loginPass) {
            setLoginError('管理员账号和密码不能为空');
            setIsLogining(false);
            return;
          }
          await handleLoginExecute(loginUser, loginPass, 'admin');
        }
      } else {
        if (!loginGuestPass) {
          setLoginError('伙伴通行密钥不能为空');
          setIsLogining(false);
          return;
        }
        await handleLoginExecute('', '', 'guest', loginGuestPass);
      }
    } catch (err: any) {
      setLoginError(err.message || '登录异常');
      setIsLogining(false);
    }
  };

  const handleLoginExecute = async (user: string, pass: string, targetRole: 'admin' | 'guest', guestPassValue?: string, totpCodeValue?: string) => {
    try {
      const payload = targetRole === 'admin' 
        ? (totpCodeValue ? { totpCode: totpCodeValue } : { username: user, password: pass })
        : { guestPassword: guestPassValue };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        localStorage.setItem('share_home_token', data.token);
        // 验证会话并拉取最新的身份及 client_id 绑定
        await checkSession(data.token);
        
        // 重置登录表单状态
        setLoginUser('');
        setLoginPass('');
        setLoginGuestPass('');
        setTotpLoginCode('');
        setIsLogining(false);
      } else {
        setLoginError(data.error || '认证失败，请重新检查密码、验证码或通用密钥。');
        setIsLogining(false);
      }
    } catch (e: any) {
      setLoginError(e.message || '服务器接口握手发生异常');
      setIsLogining(false);
    }
  };

  // 4. 超级管理员：获取网内活跃与持久化绑定的设备列表
  const fetchDevicesList = async () => {
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    try {
      const res = await fetch('/api/auth/admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDevicesList(data.devices || []);
        if (data.adminUsername) {
          setAdminUsername(data.adminUsername);
          // 默认把当前的新用户名输入框也填成拉取到的用户名
          setNewAdminUser(data.adminUsername);
        }
      }
    } catch (err) {
      console.error('[Admin] 获取网内设备权限表失败:', err);
    }
  };

  // 5. 超级管理员：更新特定设备权限 Switch
  const handleUpdateDevicePermission = async (clientId: string, key: 'allowUpload' | 'allowEditDoc' | 'allowCreateDoc', value: boolean) => {
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    setIsUpdatingDevicePerm(`${clientId}_${key}`);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clientId, key, value })
      });
      const data = await res.json();
      if (data.success) {
        setDevicesList(prev => prev.map(d => {
          if (d.id === clientId) {
            return {
              ...d,
              permissions: {
                ...d.permissions,
                [key]: value
              }
            };
          }
          return d;
        }));
      } else {
        setNoticeDialog({
          title: '更新权限失败',
          description: data.error || '权限写入失败，请稍后重试。',
          variant: 'error'
        });
      }
    } catch (err: any) {
      setNoticeDialog({
        title: '更新权限异常',
        description: err.message || '服务器接口握手发生异常。',
        variant: 'error'
      });
    } finally {
      setIsUpdatingDevicePerm(null);
    }
  };

  // 6. 超级管理员：在线修改伙伴通用登录密钥
  const handleUpdateGuestKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    if (!newGuestKeyInput.trim() || newGuestKeyInput.trim().length < 6) {
      setGuestKeyError('局域网通用密码必须为至少 6 位的有效字符');
      setGuestKeyStatus('error');
      return;
    }

    setGuestKeyStatus('saving');
    setGuestKeyError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newGuestPass: newGuestKeyInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setGuestKeyStatus('success');
        setNewGuestKeyInput('');
        setTimeout(() => setGuestKeyStatus('idle'), 3000);
      } else {
        setGuestKeyError(data.error || '写入通用密码文件失败');
        setGuestKeyStatus('error');
      }
    } catch (err: any) {
      setGuestKeyError(err.message || '网络连接异常');
      setGuestKeyStatus('error');
    }
  };

  // 6.5 超级管理员：在线修改管理员自身账号和密码
  const handleUpdateAdminSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    if (!currentAdminPass) {
      setAdminSettingsError('请输入当前管理员密码以验证身份');
      setAdminSettingsStatus('error');
      return;
    }

    if (!newAdminUser.trim()) {
      setAdminSettingsError('管理员用户名不能为空');
      setAdminSettingsStatus('error');
      return;
    }

    if (newAdminPass && newAdminPass.length < 6) {
      setAdminSettingsError('新密码长度不能小于 6 位');
      setAdminSettingsStatus('error');
      return;
    }

    if (newAdminPass !== confirmAdminPass) {
      setAdminSettingsError('两次输入的新密码不一致');
      setAdminSettingsStatus('error');
      return;
    }

    setAdminSettingsStatus('saving');
    setAdminSettingsError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'admin',
          currentPassword: currentAdminPass,
          newUsername: newAdminUser.trim(),
          newPassword: newAdminPass ? newAdminPass : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setAdminSettingsStatus('success');
        setCurrentAdminPass('');
        setNewAdminPass('');
        setConfirmAdminPass('');
        
        setNoticeDialog({
          title: '修改成功',
          description: '管理员账号已成功更新，系统将在 2 秒后自动安全退出，请用新凭证重新登录。',
          variant: 'info'
        });
        
        setTimeout(() => {
          setNoticeDialog(null);
          setAdminSettingsStatus('idle');
          handleLogout();
        }, 2500);
      } else {
        setAdminSettingsError(data.error || '修改管理员账户失败');
        setAdminSettingsStatus('error');
      }
    } catch (err: any) {
      setAdminSettingsError(err.message || '网络连接异常');
      setAdminSettingsStatus('error');
    }
  };

  // ==================== 管理员 2FA 两步验证交互逻辑 ====================

  /**
   * 点击开启 Switch 时：生成并展示临时 2FA 绑定信息
   */
  const handleGet2FaDetails = async () => {
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    setTotp2faStatus('loading');
    setTotp2faError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'get_2fa' })
      });
      const data = await res.json();
      if (data.success) {
        setTemp2faSecret(data.tempSecret);
        // 使用在线高可用服务渲染二维码链接
        setTemp2faQrUri(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data.otpauthUri)}&size=180x180`);
        setIs2faBindingActive(true);
        setTotp2faStatus('idle');
      } else {
        setTotp2faError(data.error || '获取两步验证绑定秘钥失败');
        setTotp2faStatus('error');
      }
    } catch (err: any) {
      setTotp2faError(err.message || '网络连接异常');
      setTotp2faStatus('error');
    }
  };

  /**
   * 输入首个 6 位 TOTP 并进行确认绑定
   */
  const handleVerifyAndEnable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    if (!totpVerifyCode || totpVerifyCode.trim().length !== 6) {
      setTotp2faError('请输入 6 位动态验证码确认绑定');
      setTotp2faStatus('error');
      return;
    }

    setTotp2faStatus('loading');
    setTotp2faError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'verify_and_enable_2fa',
          tempSecret: temp2faSecret,
          code: totpVerifyCode.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setTotp2faStatus('success');
        setAdmin2faEnabled(true);
        setIs2faBindingActive(false);
        setTotpVerifyCode('');
        setTemp2faSecret('');
        setTemp2faQrUri('');
        
        setNoticeDialog({
          title: '两步验证绑定成功',
          description: '管理员专属 2FA 两步验证已正式开启！下次登录时，您可以免输入账号密码，仅凭手机接收器上的验证码即可极速安全登录。',
          variant: 'info'
        });
        setTimeout(() => {
          setNoticeDialog(null);
          setTotp2faStatus('idle');
        }, 3000);
      } else {
        setTotp2faError(data.error || '绑定两步验证失败');
        setTotp2faStatus('error');
      }
    } catch (err: any) {
      setTotp2faError(err.message || '网络连接异常');
      setTotp2faStatus('error');
    }
  };

  /**
   * 关闭 2FA (校验当前密码)
   */
  const handleDisable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;

    if (!disable2faPass) {
      setTotp2faError('验证密码不能为空');
      setTotp2faStatus('error');
      return;
    }

    setTotp2faStatus('loading');
    setTotp2faError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'disable_2fa',
          currentPassword: disable2faPass
        })
      });
      const data = await res.json();
      if (data.success) {
        setTotp2faStatus('success');
        setAdmin2faEnabled(false);
        setShowDisableModal(false);
        setDisable2faPass('');
        
        setNoticeDialog({
          title: '两步验证已成功关闭',
          description: '您的 2FA 安全手机绑定已成功解除，登录时将恢复为常规账号密码验证。',
          variant: 'info'
        });
        setTimeout(() => {
          setNoticeDialog(null);
          setTotp2faStatus('idle');
        }, 3000);
      } else {
        setTotp2faError(data.error || '两步验证解绑失败');
        setTotp2faStatus('error');
      }
    } catch (err: any) {
      setTotp2faError(err.message || '网络连接异常');
      setTotp2faStatus('error');
    }
  };

  // 7. 登出
  const handleLogout = () => {
    const token = localStorage.getItem('share_home_token') || '';
    if (token) {
      fetch('/api/auth/login', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    localStorage.removeItem('share_home_token');
    setRole(null);
    setAuthStatus('unauthorized');
    setActiveTab('transfer');
  };

  // 1. 初始化局域网在线节点发现逻辑
  const { peers, self, isConnected, updateProfile, refreshPeers } = useMdnsPeers();

  // 侧边导航栏折叠显隐状态 (持久化缓存)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRecordMenuExpanded, setIsRecordMenuExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed') === 'true';
      setIsSidebarCollapsed(saved);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  // 2. 初始化局域网极速传输引擎逻辑
  const { 
    tasks, 
    incomingRequest, 
    sendFile, 
    acceptRequest, 
    rejectRequest, 
    cancelTransfer, 
    uploadPublicFile,
    deleteTask,
    clearHistory
  } = useFileTransfer(self);

  // 页面当前激活的大 Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('transfer');

  useEffect(() => {
    if ((activeTab === 'users' || activeTab === 'admin-settings') && role === 'admin') {
      fetchDevicesList();
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (authStatus !== 'authorized') return;

    const heartbeat = window.setInterval(() => {
      checkSession();
      if (role === 'admin' && (activeTab === 'users' || activeTab === 'admin-settings')) {
        fetchDevicesList();
      }
    }, 30 * 1000);

    return () => window.clearInterval(heartbeat);
  }, [authStatus, role, activeTab]);

  // 系统设置局部二级 Tab 导航状态
  const [settingsSubTab, setSettingsSubTab] = useState<'storage' | 'profile' | 'network' | 'guidelines'>('storage');

  // 智能避错：如果非管理员试图查看或加载存储路径，则将其静默重定向到极客头像 Tab
  useEffect(() => {
    if (role && role !== 'admin' && settingsSubTab === 'storage') {
      setSettingsSubTab('profile');
    }
  }, [role, settingsSubTab]);

  // ==================== 在线一键热升级系统核心状态与逻辑 ====================
  const [updateInfo, setUpdateInfo] = useState<{ currentVersion: string; latestVersion: string; hasUpdate: boolean; error?: string } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<Array<{ type: 'log' | 'error'; text: string }>>([]);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const [systemUpdateStatus, setSystemUpdateStatus] = useState<'idle' | 'updating' | 'reconnecting' | 'success' | 'failed'>('idle');

  // 并发版本在线检测拉取
  const checkSystemUpdate = async () => {
    try {
      const res = await fetch('/api/config/check-update');
      const data = await res.json();
      if (data.success) {
        setUpdateInfo(data);
      }
    } catch (err) {
      console.error('[Update] 检查系统更新失败:', err);
    }
  };

  // 延时重连心跳探针
  const triggerReconnectionHeartbeat = () => {
    let attempts = 0;
    const maxAttempts = 15;
    const interval = window.setInterval(async () => {
      attempts++;
      try {
        const token = localStorage.getItem('share_home_token') || '';
        const res = await fetch('/api/auth/session', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          window.clearInterval(interval);
          setSystemUpdateStatus('success');
          setIsUpdatingSystem(false);
          // 重新拉取对齐最新版本号
          await checkSystemUpdate();
          setTimeout(() => {
            setShowUpdateModal(false);
            setSystemUpdateStatus('idle');
            setUpdateLogs([]);
          }, 3000);
        }
      } catch (e) {
        if (attempts >= maxAttempts) {
          window.clearInterval(interval);
          setSystemUpdateStatus('failed');
          setIsUpdatingSystem(false);
          setUpdateLogs(prev => [...prev, { type: 'error', text: '❌ [ERROR] 守护进程热拉起超时，请尝试在终端中手动重启服务。' }]);
        }
      }
    }, 1000);
  };

  // 发起在线物理一键重装
  const handleStartSystemUpdate = async () => {
    if (isUpdatingSystem) return;
    setIsUpdatingSystem(true);
    setSystemUpdateStatus('updating');
    setUpdateLogs([{ type: 'log', text: '⚙️ [SYSTEM] 准备执行物理更新进程...' }]);
    
    try {
      const token = localStorage.getItem('share_home_token') || '';
      const res = await fetch('/api/config/update-system', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!data.success) {
        setSystemUpdateStatus('failed');
        setIsUpdatingSystem(false);
        setUpdateLogs(prev => [...prev, { type: 'error', text: `❌ [ERROR] 派发更新指令失败: ${data.error || data.message}` }]);
      }
    } catch (err: any) {
      setSystemUpdateStatus('failed');
      setIsUpdatingSystem(false);
      setUpdateLogs(prev => [...prev, { type: 'error', text: `❌ [ERROR] 发起更新请求发生异常: ${err.message}` }]);
    }
  };

  // 管理员身份激活后，自动执行版本检测
  useEffect(() => {
    if (role === 'admin') {
      checkSystemUpdate();
    }
  }, [role]);

  // 主题颜色状态
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // 文件传输中心抽屉显隐状态
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState(false);
  const [prevTasksLength, setPrevTasksLength] = useState(0);

  // 标志是否为首次加载，在 1 秒后强制置为 false
  const isInitialLoad = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 个人资料相关状态
  const [newNickname, setNewNickname] = useState('');
  const [newAvatar, setNewAvatar] = useState('avatar-1');
  const isProfileInitialized = useRef(false);
  const prevSelfRef = useRef<{ nickname: string; avatar?: string } | null>(null);



  // 3. 系统参数配置相关状态
  const [storagePath, setStoragePath] = useState('');
  const [absolutePath, setAbsolutePath] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [configErrorMsg, setConfigErrorMsg] = useState('');
  const [isSelectingDir, setIsSelectingDir] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationPaths, setMigrationPaths] = useState<{ oldPath: string; newPath: string } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
    currentFile: string;
  } | null>(null);

  // 初始化拉取主题设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  // 监听任务长度变化：当新文件传输任务加入时，自动滑出传输抽屉 3 秒
  useEffect(() => {
    const currentTasks = Object.values(tasks);
    if (isInitialLoad.current) {
      setPrevTasksLength(currentTasks.length);
      return;
    }

    if (currentTasks.length > prevTasksLength) {
      setIsTransferDrawerOpen(true);
      const timer = setTimeout(() => {
        setIsTransferDrawerOpen(false);
      }, 3000);
      setPrevTasksLength(currentTasks.length);
      return () => clearTimeout(timer);
    } else if (currentTasks.length !== prevTasksLength) {
      setPrevTasksLength(currentTasks.length);
    }
  }, [tasks, prevTasksLength]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // 初始化拉取系统配置
  const fetchConfig = async () => {
    const token = localStorage.getItem('share_home_token') || '';
    if (!token || role !== 'admin') return;
    try {
      const res = await fetch('/api/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setStoragePath(data.storagePath);
        setAbsolutePath(data.absolutePath);
      }
    } catch (err) {
      console.error('[Settings] 获取存储路径配置失败:', err);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchConfig();
    }
  }, [role]);

  useEffect(() => {
    if (role === 'admin') {
      fetchConfig();
    }

    // 订阅物理文件迁移进度 WebSocket 事件
    const socket = SocketClient.getInstance();
    const unsubMigrationProgress = socket.subscribe('migration:progress', (progress: any) => {
      console.log('[Settings] 物理数据迁移实时进度:', progress);
      setMigrationProgress(progress);
    });

    // 订阅系统热升级 WebSocket 进度事件
    const unsubUpdateLog = socket.subscribe('system:update-log', (log: { type: 'log' | 'error'; text: string }) => {
      setUpdateLogs(prev => [...prev, log]);
      if (log.type === 'error') {
        setSystemUpdateStatus('failed');
        setIsUpdatingSystem(false);
      } else if (log.text.includes('热升级自愈重启信号')) {
        setSystemUpdateStatus('reconnecting');
        triggerReconnectionHeartbeat();
      }
    });

    return () => {
      unsubMigrationProgress();
      unsubUpdateLog();
    };
  }, []);

  // 当 self 数据加载成功后，自动同步初始化本端昵称与头像，当 self 的真实资料发生变更时进行深度同步
  useEffect(() => {
    if (self) {
      const selfChanged = prevSelfRef.current?.nickname !== self.nickname || prevSelfRef.current?.avatar !== self.avatar;
      if (!isProfileInitialized.current || selfChanged) {
        setNewNickname(self.nickname);
        setNewAvatar(self.avatar || '💻');
        isProfileInitialized.current = true;
        prevSelfRef.current = { nickname: self.nickname, avatar: self.avatar };
      }
    }
  }, [self]);

  // 智能状态同步：当激活路由为记录中心的子分类时，自动展开二级导航菜单
  useEffect(() => {
    if (activeTab.startsWith('history-') && !isSidebarCollapsed) {
      setIsRecordMenuExpanded(true);
    }
  }, [activeTab, isSidebarCollapsed]);

  useEffect(() => {
    if (role !== 'admin' && (activeTab === 'users' || activeTab.startsWith('history-'))) {
      setActiveTab('transfer');
    }
  }, [activeTab, role]);

  const renderSelfAvatar = (avatar: string, size = 13) => {
    switch (avatar) {
      case 'avatar-1':
        return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      case 'avatar-2':
        return <Monitor size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      case 'avatar-3':
        return <Smartphone size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
      default:
        if (avatar && avatar.trim()) {
          if (avatar === '💻') {
            return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          if (avatar === '🖥️') {
            return <Monitor size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          if (avatar === '📱') {
            return <Smartphone size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
          }
          return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar}</span>;
        }
        return <Laptop size={size} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />;
    }
  };

  const saveProfile = async () => {
    if (newNickname.trim()) {
      await updateProfile(newNickname.trim(), newAvatar);
    }
  };

  const handleSaveConfig = async (migrate?: boolean) => {
    if (!storagePath.trim()) return;
    
    // 强制防御性检查：若因为 React 事件绑定错误导致将 Event 传入，则安全过滤为 undefined
    const realMigrate = typeof migrate === 'boolean' ? migrate : undefined;
    
    if (realMigrate === true) {
      setIsMigrating(true);
      setMigrationProgress({
        total: 0,
        current: 0,
        percentage: 0,
        currentFile: '准备建立局域网数据合流信道...'
      });
    }
    setConfigStatus('saving');
    
    try {
      const token = localStorage.getItem('share_home_token') || '';
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          storagePath: storagePath.trim(),
          migrate: realMigrate
        })
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.requireMigration) {
          // 触发迁移确认模态框
          setMigrationPaths({ oldPath: data.oldPath, newPath: data.newPath });
          setShowMigrationModal(true);
          setConfigStatus('idle');
        } else {
          // 配置正式应用成功
          setShowMigrationModal(false);
          setMigrationProgress(null);
          setStoragePath(data.storagePath);
          setAbsolutePath(data.absolutePath);
          setConfigStatus('success');
          setTimeout(() => setConfigStatus('idle'), 3000);
          
          // 获取最新绝对路径
          fetchConfig();
          
          // 派发自定义全局更改事件，让共享文件和知识库模块能感知变化并立即刷新重载
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('storage-path-changed'));
          }
        }
      } else {
        setShowMigrationModal(false);
        setMigrationProgress(null);
        setConfigStatus('error');
        setConfigErrorMsg(data.error || '路径无效或系统没有对该路径的写权限');
      }
    } catch (err: any) {
      setShowMigrationModal(false);
      setMigrationProgress(null);
      setConfigStatus('error');
      setConfigErrorMsg(err.message || '配置提交异常');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSelectDirectory = async () => {
    setIsSelectingDir(true);
    try {
      const token = localStorage.getItem('share_home_token') || '';
      const res = await fetch('/api/config/select-directory', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        if (!data.canceled && data.path) {
          setStoragePath(data.path);
        }
      } else {
        setConfigStatus('error');
        setConfigErrorMsg(data.error || '系统弹窗调用异常，请手动输入路径');
      }
    } catch (err: any) {
      setConfigStatus('error');
      setConfigErrorMsg(err.message || '调用系统资源管理器失败，请手动输入路径');
    } finally {
      setIsSelectingDir(false);
    }
  };

  // 统计互传任务数
  const activeTasksCount = Object.values(tasks).filter(
    t => t.status === 'transferring' || t.status === 'pending'
  ).length;
  const totalTasksCount = Object.values(tasks).length;

  const renderAuthShell = () => {
    const isInit = authStatus === 'uninitialized';
    const isLoading = authStatus === 'loading';

    return (
      <div className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1180px] gap-8 lg:grid-cols-[1fr_420px] lg:items-center lg:gap-12">
          <section className="flex flex-col justify-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/10">
                <Radio size={21} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold tracking-[-0.02em] leading-tight sm:text-4xl">Share Home</h1>
                <p className="mt-1 text-sm text-muted-foreground">局域网协作平台安全入口</p>
              </div>
            </div>

            <p className="mt-8 max-w-[62ch] text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              文件投递、共享中心和云文档在本地网络内工作。进入工作台前完成身份验证，管理员负责发放伙伴密钥并管理每台设备权限。
            </p>

            <div className="mt-8 max-w-[720px] border-y border-border/60">
              {[
                { code: 'ADMIN', label: '账号密码', detail: '管理员可修改伙伴密钥、设备权限和系统配置', Icon: ShieldCheck },
                { code: 'GUEST', label: '通用密钥', detail: '普通伙伴输入密钥即可进入协作工作台', Icon: KeyRound },
                { code: 'DEVICE', label: 'IP 绑定', detail: '同一 IP 固定为同一个设备身份，便于权限追踪', Icon: Lock },
              ].map(({ code, label, detail, Icon }, index) => (
                <div key={code} className={`grid grid-cols-[22px_88px_1fr] items-center gap-3 py-4 ${index > 0 ? 'border-t border-border/40' : ''}`}>
                  <Icon size={15} className="text-primary" />
                  <div className="font-mono text-[10px] font-semibold text-muted-foreground">{code}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{label}</div>
                    <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col justify-center border-t border-border/70 pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/10">
                  {isInit ? <ShieldCheck size={17} className="text-primary" /> : <Lock size={17} className="text-primary" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight">
                    {isLoading ? '正在校验会话' : isInit ? '首次启动初始化' : '验证身份'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isInit ? '设置管理员账号，并创建普通伙伴通用密钥' : loginTab === 'admin' ? '使用管理员账号进入管理模式' : '使用管理员发放的密钥进入工作台'}
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-3 border-y border-border/50 py-5 text-sm text-muted-foreground">
                <RefreshCw size={16} className="animate-spin text-primary" />
                <span>正在读取本地授权状态...</span>
              </div>
            ) : isInit ? (
              <form onSubmit={handleInitAuthSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-xs font-semibold">
                  超级管理员账号
                  <ShadcnInput
                    value={initAdminUser}
                    onChange={(e) => setInitAdminUser(e.target.value)}
                    autoComplete="username"
                    className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                    placeholder="admin"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold">
                  超级管理员密码
                  <ShadcnInput
                    type="password"
                    value={initAdminPass}
                    onChange={(e) => setInitAdminPass(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                    placeholder="输入管理员密码"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold">
                  伙伴通用登录密钥
                  <ShadcnInput
                    type="password"
                    value={initGuestPass}
                    onChange={(e) => setInitGuestPass(e.target.value)}
                    autoComplete="new-password"
                    className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                    placeholder="例如 123456"
                  />
                </label>
                {initError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                    <span>{initError}</span>
                  </div>
                )}
                {!initIsLocal && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-600 dark:text-amber-400">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>非本机访问不能初始化管理员密码，请在宿主机器打开本页面或使用 `share-home` 终端初始化。</span>
                  </div>
                )}
                <ShadcnButton type="submit" disabled={!initIsLocal} className="mt-1 h-11 rounded-lg text-sm font-semibold">
                  <ShieldCheck size={14} />
                  初始化并登录
                </ShadcnButton>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
                  <button
                    type="button"
                    aria-pressed={loginTab === 'guest'}
                    onClick={() => setLoginTab('guest')}
                    className={`h-10 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      loginTab === 'guest'
                        ? 'bg-background text-foreground border border-border/60 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <KeyRound size={13} />
                    伙伴密钥
                  </button>
                  <button
                    type="button"
                    aria-pressed={loginTab === 'admin'}
                    onClick={() => setLoginTab('admin')}
                    className={`h-10 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      loginTab === 'admin'
                        ? 'bg-background text-foreground border border-border/60 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <ShieldCheck size={13} />
                    超级管理员
                  </button>
                </div>

                {loginTab === 'admin' ? (
                  use2faLogin ? (
                    <>
                      <label className="flex flex-col gap-2 text-xs font-semibold animate-in fade-in duration-200">
                        两步验证动态码 (2FA)
                        <ShadcnInput
                          type="text"
                          value={totpLoginCode}
                          onChange={(e) => setTotpLoginCode(e.target.value)}
                          maxLength={6}
                          className="h-11 rounded-lg border-border/70 bg-background px-3 text-center text-lg font-mono tracking-widest"
                          placeholder="000000"
                          required
                        />
                      </label>
                      <div className="flex justify-end mt-1 animate-in fade-in duration-200">
                        <button
                          type="button"
                          onClick={() => {
                            setUse2faLogin(false);
                            setLoginError('');
                          }}
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          切换回常规密码登录
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="flex flex-col gap-2 text-xs font-semibold animate-in fade-in duration-200">
                        管理员账号
                        <ShadcnInput
                          value={loginUser}
                          onChange={(e) => setLoginUser(e.target.value)}
                          autoComplete="username"
                          className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                          placeholder="admin"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-xs font-semibold animate-in fade-in duration-200">
                        管理员密码
                        <ShadcnInput
                          type="password"
                          value={loginPass}
                          onChange={(e) => setLoginPass(e.target.value)}
                          autoComplete="current-password"
                          className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                          placeholder="输入管理员密码"
                        />
                      </label>
                      {admin2faEnabled && (
                        <div className="flex justify-end mt-1 animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={() => {
                              setUse2faLogin(true);
                              setLoginError('');
                            }}
                            className="text-[11px] text-primary hover:underline font-semibold"
                          >
                            使用 2FA 动态码极速登录
                          </button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <label className="flex flex-col gap-2 text-xs font-semibold">
                    伙伴通用密钥
                    <ShadcnInput
                      type="password"
                      value={loginGuestPass}
                      onChange={(e) => setLoginGuestPass(e.target.value)}
                      autoComplete="current-password"
                      className="h-11 rounded-lg border-border/70 bg-background px-3 text-sm"
                      placeholder="输入管理员发放的密钥"
                    />
                  </label>
                )}

                {loginError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <ShadcnButton type="submit" disabled={isLogining} className="mt-1 h-11 rounded-lg text-sm font-semibold">
                  {isLogining ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {isLogining ? '正在验证' : '进入工作台'}
                </ShadcnButton>
              </form>
            )}
          </section>
        </div>
      </div>
    );
  };

  if (authStatus !== 'authorized') {
    return renderAuthShell();
  }

  return (
    <div className="app-container">
      
      {/* 1. 左侧大厂极简侧边导航栏 (Sidebar) */}
      <aside className={`sidebar-container ${isSidebarCollapsed ? 'collapsed' : ''} bg-sidebar border-r border-border/40 flex flex-col justify-between flex-shrink-0 z-10 duration-300`}>
        {/* 顶部 Logo & 品牌区 */}
        <div>
          <div className={`sidebar-logo-group flex ${isSidebarCollapsed ? 'flex-col justify-center py-5 px-2 gap-3' : 'flex-row justify-between py-6 px-5 gap-0'} items-center border-b border-border/40 relative`}>
            <div className="flex items-center gap-3 overflow-hidden justify-center">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm flex-shrink-0">
                <Radio size={16} className="text-primary animate-pulse" />
              </div>
              {!isSidebarCollapsed && (
                <div className="sidebar-title-group animate-in fade-in slide-in-from-left-2 duration-200">
                  <h1 className="text-sm font-bold text-foreground tracking-tight white-space-nowrap">Share Home</h1>
                  <p className="text-[10px] text-muted-foreground tracking-wide white-space-nowrap">局域网协作平台</p>
                </div>
              )}
            </div>

            {/* 折叠切换按钮 */}
            <button
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? '展开导航' : '收起导航'}
              className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                isSidebarCollapsed ? 'mt-2 w-8 h-8' : 'w-auto h-auto'
              }`}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* 导航菜单列表 */}
          <nav className="sidebar-nav p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('transfer')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'transfer'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Files size={15} className={`flex-shrink-0 ${activeTab === 'transfer' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">极速文件流</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'share'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <FolderOpen size={15} className={`flex-shrink-0 ${activeTab === 'share' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">共享中心</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'knowledge'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <FileText size={15} className={`flex-shrink-0 ${activeTab === 'knowledge' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">云文档</span>
            </button>

            {role === 'admin' && (
              <div className="flex flex-col w-full">
                <button
                  onClick={() => {
                    setIsRecordMenuExpanded(!isRecordMenuExpanded);
                    if (!activeTab.startsWith('history-')) {
                      setActiveTab('history-transfer'); // 点击大类默认切换到第一个子菜单
                    }
                  }}
                  className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                    activeTab.startsWith('history-')
                      ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                      : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <History size={15} className={`flex-shrink-0 ${activeTab.startsWith('history-') ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="sidebar-nav-text">记录中心</span>
                  {!isSidebarCollapsed && (
                    <ChevronDown 
                      size={12} 
                      className={`ml-auto opacity-60 transition-transform duration-300 ${
                        isRecordMenuExpanded ? 'rotate-180' : 'rotate-0'
                      }`}
                    />
                  )}
                </button>

                {/* 二级侧边导航子菜单 (大厂级莫兰迪缩进美学) */}
                {isRecordMenuExpanded && !isSidebarCollapsed && (
                  <div className="flex flex-col gap-1 pl-5 mt-1.5 border-l border-border/40 ml-4 animate-in fade-in duration-200">
                    <button
                      onClick={() => setActiveTab('history-transfer')}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                        activeTab === 'history-transfer'
                          ? 'text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${
                        activeTab === 'history-transfer' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                      } inline-block`} />
                      设备互传历史
                    </button>

                    <button
                      onClick={() => setActiveTab('history-share')}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                        activeTab === 'history-share'
                          ? 'text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${
                        activeTab === 'history-share' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                      } inline-block`} />
                      共享上传记录
                    </button>

                    <button
                      onClick={() => setActiveTab('history-document')}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
                        activeTab === 'history-document'
                          ? 'text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${
                        activeTab === 'history-document' ? 'bg-primary shadow-[0_0_6px_#3b82f6]' : 'bg-muted-foreground/60'
                      } inline-block`} />
                      云文档活动日志
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                  : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Settings size={15} className={`flex-shrink-0 ${activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="sidebar-nav-text">系统配置</span>
            </button>

            {role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                    activeTab === 'users'
                      ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                      : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Users size={15} className={`flex-shrink-0 ${activeTab === 'users' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="sidebar-nav-text">用户管理</span>
                </button>

                <button
                  onClick={() => setActiveTab('admin-settings')}
                  className={`sidebar-nav-btn flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg text-xs transition-all duration-200 ${
                    activeTab === 'admin-settings'
                      ? 'bg-primary/10 border border-primary/20 text-primary font-semibold shadow-sm shadow-primary/5'
                      : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <ShieldCheck size={15} className={`flex-shrink-0 ${activeTab === 'admin-settings' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="sidebar-nav-text">管理员设置</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* 侧边栏底部本端身份管理与主题切换区 */}
        <div className="p-4 border-t border-border/40">
          {self && (
            <div className={`flex ${isSidebarCollapsed ? 'flex-col items-center gap-3' : 'flex-row items-center gap-2'}`}>
              <div className="flex-1 min-w-0 w-full flex justify-center">
                <div 
                  onClick={isSidebarCollapsed ? () => setIsSidebarCollapsed(false) : undefined}
                  className={`sidebar-profile-card flex items-center justify-between bg-transparent px-2.5 py-2 rounded-lg transition-all duration-200 overflow-hidden ${
                    isSidebarCollapsed ? 'cursor-pointer hover:bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden min-w-0">
                    {renderSelfAvatar(self.avatar, 13)}
                    <span className="sidebar-profile-details text-xs font-semibold text-foreground overflow-hidden text-ellipsis white-space-nowrap">
                      {self.nickname}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
                className="w-9 h-9 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center cursor-pointer hover:border-border/60 hover:bg-muted/40 transition-all duration-200 text-foreground flex-shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun size={15} className="text-amber-500 animate-spin-slow" />
                ) : (
                  <Moon size={15} className="text-indigo-500" />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 2. 右侧主工作面板工作区 (Workspace) */}
      <main className="workspace-container fade-in">
        
        {/* 顶部自发现网络拉取与刷新状态栏 */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {activeTab === 'transfer' && '文件传输工作台'}
              {activeTab === 'share' && '公共共享中心'}
              {activeTab === 'knowledge' && '知识协作云文档'}
              {activeTab.startsWith('history-') && '操作与协作记录中心'}
              {activeTab === 'settings' && '全局系统配置'}
              {activeTab === 'users' && '用户与权限管理'}
              {activeTab === 'admin-settings' && '管理员账号设置'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {activeTab === 'transfer' && '安全、无压缩的局域网零阻碍点对点极速传输'}
              {activeTab === 'share' && '长效、大文件零压缩合并存储的局域网公共共享空间'}
              {activeTab === 'knowledge' && '支持富文本与代码的局域网去中心化物理落盘云文档'}
              {activeTab.startsWith('history-') && '局域网互传历史、共享上传审计以及云协作审计日志'}
              {activeTab === 'settings' && '修改默认存储路径以及查看本端硬件和网络特征'}
              {activeTab === 'users' && '管理普通伙伴登录密钥以及每台设备的共享与文档权限'}
              {activeTab === 'admin-settings' && '在线更新管理员的用户名以及登录密码，增强系统安全性'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '0.7rem',
              color: isConnected ? 'var(--success-color)' : 'var(--text-muted)',
              background: isConnected ? 'var(--success-glow)' : 'transparent',
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)'}`,
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isConnected ? 'var(--success-color)' : 'var(--text-muted)',
                display: 'inline-block'
              }} />
              {isConnected ? '局域网信道在线' : '离线状态'}
            </span>

            {/* 传输任务触发按钮 */}
            <button
              onClick={() => setIsTransferDrawerOpen(!isTransferDrawerOpen)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: 'rgba(128, 128, 128, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeTasksCount > 0 ? '0 0 12px var(--accent-glow)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)';
                e.currentTarget.style.borderColor = 'var(--border-color-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(128, 128, 128, 0.04)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <ArrowUpDown 
                size={14} 
                style={{ 
                  color: activeTasksCount > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                }} 
              />
              <span>传输任务</span>
              
              {/* 任务徽标 (Badge) */}
              {activeTasksCount > 0 && (
                <span style={{
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}>
                  {activeTasksCount}
                </span>
              )}
            </button>

            <Button variant="secondary" onClick={refreshPeers} style={{ padding: '8px 12px' }}>
              <RefreshCw size={14} />
              刷新雷达
            </Button>

            {/* 自动检测升级呼吸铃铛 (仅管理员在登录态后可见) */}
            {role === 'admin' && updateInfo && (
              <button
                onClick={() => {
                  setShowUpdateModal(true);
                  setUpdateLogs([]);
                }}
                className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/15 rounded-lg border-none bg-transparent cursor-pointer transition-all mr-1 flex items-center justify-center shrink-0"
                title={updateInfo.hasUpdate ? "发现新版本！点击查看在线升级详情" : "系统已是最新版"}
              >
                <Bell size={16} className={updateInfo.hasUpdate ? "animate-pulse text-amber-500" : ""} />
                {updateInfo.hasUpdate && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>
            )}

            <button
              onClick={handleLogout}
              title="退出当前登录"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            >
              <LogOut size={14} />
              <span>{role === 'admin' ? '管理员' : '伙伴'}</span>
            </button>
          </div>
        </header>

        {/* 动态内容工作区渲染 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* TAB 1: 极速文件传输工作台 */}
          {activeTab === 'transfer' && (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }} className="fade-in">
              <PeerList 
                peers={peers} 
                self={self}
                onSendFile={(peer, file) => {
                  sendFile(peer, file);
                }} 
              />
            </div>
          )}

          {/* TAB 2: 公共共享中心 */}
          {activeTab === 'share' && (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }} className="fade-in">
              <SharedFiles uploadPublicFile={uploadPublicFile} allowUpload={myPermissions.allowUpload} />
            </div>
          )}

          {/* TAB 2: 去中心化知识库云文档 */}
          {activeTab === 'knowledge' && (
            <div className="fade-in">
              <KnowledgeBase peers={peers} self={self} allowEditDoc={myPermissions.allowEditDoc} allowCreateDoc={myPermissions.allowCreateDoc} />
            </div>
          )}

          {/* TAB 4: 大统一记录中心 (Activity Hub) */}
          {activeTab.startsWith('history-') && (
            <div className="fade-in">
              <RecordCenter 
                tasks={tasks} 
                self={self} 
                subTab={
                  activeTab === 'history-share' 
                    ? 'share' 
                    : activeTab === 'history-document' 
                      ? 'document' 
                      : 'transfer'
                }
                onDeleteTask={deleteTask}
                onClearHistory={clearHistory}
                onNavigateToDoc={(docId) => {
                  // 智能缓存待定位文档的 id，并激活 Tab 跳转至云文档模块
                  localStorage.setItem('kb_selected_id', docId);
                  setActiveTab('knowledge');
                  // 延时发送跨组件自定义事件，确保云文档组件有足够时机就绪并执行自动高亮选中
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('kb-select-doc', { detail: docId }));
                  }, 50);
                }}
              />
            </div>
          )}

          {/* TAB 3: 系统配置控制台仪表盘 (完全去卡片化，带二级 Inner Tab 导航与平铺配置直行设计) */}
          {activeTab === 'settings' && (
            <div className="flex flex-col md:flex-row gap-8 w-full items-start fade-in mt-2">
              
              {/* 左侧：极简二级配置导航 (Inner Borderless Settings Nav) */}
              <div className="flex flex-row md:flex-col gap-1 w-full md:w-[180px] shrink-0 border-b md:border-b-0 md:border-r border-border/10 pb-4 md:pb-0 md:pr-4">
                {(['storage', 'profile', 'network', 'guidelines'] as const)
                  .filter((sub) => sub !== 'storage' || role === 'admin')
                  .map((sub) => {
                  const label = {
                    storage: '基础存储',
                    profile: '极客头像',
                    network: '网络参数',
                    guidelines: '安全指引'
                  }[sub];
                  const icon = {
                    storage: <FolderOpen size={13} />,
                    profile: <Edit3 size={13} />,
                    network: <Cpu size={13} />,
                    guidelines: <Info size={13} />
                  }[sub];
                  const isActive = settingsSubTab === sub;
                  return (
                    <button
                      key={sub}
                      onClick={() => setSettingsSubTab(sub)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border-none ${
                        isActive 
                          ? 'bg-muted/30 text-foreground font-bold' 
                          : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* 右侧：扁平去卡片化流式配置项面板 */}
              <div className="flex-1 w-full flex flex-col gap-6">
                
                {/* SUB TAB 1: 基础存储目录配置 */}
                {settingsSubTab === 'storage' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border/20 pb-3">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-bold text-foreground">默认文件及文档存储目录</h3>
                        <p className="text-[11px] text-muted-foreground">收到的文件及创建的同步云文档，均存放在本端此物理目录中</p>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        就绪
                      </span>
                    </div>

                    <div className="flex flex-col gap-4 py-2">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                        <div className="flex-1 min-w-[200px] pr-4">
                          <h4 className="text-xs font-bold text-foreground">物理落盘绝对路径</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            支持设定绝对路径或以 `./` 开头的根相对路径，请确保系统对其拥有完整的写权限
                          </p>
                        </div>
                        
                        <div className="flex gap-2.5 w-full md:w-auto shrink-0 min-w-[320px]">
                          <div className="relative flex-1 flex items-center">
                            <ShadcnInput
                              type="text"
                              value={storagePath}
                              onChange={(e) => setStoragePath(e.target.value)}
                              placeholder="例如: ./storage"
                              className="w-full border-border/80 pr-10 focus-visible:ring-2 focus-visible:ring-zinc-500/10 focus-visible:border-border-hover transition-all duration-200"
                            />
                            <button
                              onClick={handleSelectDirectory}
                              disabled={isSelectingDir}
                              title="弹出系统文件浏览器选择物理存储路径"
                              className="absolute right-2 text-muted-foreground hover:text-primary hover:bg-muted p-1.5 rounded-md transition-all duration-200"
                            >
                              {isSelectingDir ? (
                                <RefreshCw size={14} className="animate-spin text-primary" />
                              ) : (
                                <FolderOpen size={14} />
                              )}
                            </button>
                          </div>
                          <ShadcnButton 
                            onClick={() => handleSaveConfig()} 
                            disabled={configStatus === 'saving' || !storagePath.trim() || isSelectingDir}
                            className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm"
                          >
                            {configStatus === 'saving' ? '验证中...' : '保存'}
                          </ShadcnButton>
                        </div>
                      </div>

                      {/* 状态反馈提示 */}
                      {configStatus === 'success' && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                          <Check size={14} />
                          存储路径校验通过，修改已成功持久化保存！
                        </div>
                      )}
                      {configStatus === 'error' && (
                        <div className="p-3 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                          <ShieldAlert size={14} />
                          修改失败：{configErrorMsg}
                        </div>
                      )}

                      {absolutePath && (
                        <div className="text-[10px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/10 border-dashed word-break font-mono leading-relaxed mt-2">
                          <strong className="text-foreground">当前服务器绝对落盘路径：</strong> {absolutePath}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB TAB 2: 极客头像与本端身份 */}
                {settingsSubTab === 'profile' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">本端设备身份名片</h3>
                      <p className="text-[11px] text-muted-foreground">自定义你在局域网群组中展示给对等体的个人极客档案</p>
                    </div>

                    <div className="flex flex-col gap-5 py-2">
                      
                      {/* 头像选择行 */}
                      <div className="flex flex-col md:flex-row gap-4 items-start justify-between py-4 border-b border-border/10">
                        <div className="flex-1 pr-4">
                          <h4 className="text-xs font-bold text-foreground">快速选择专属极客头像</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            选择一个最贴近您硬件设备特征或个性的拟物化标志
                          </p>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 shrink-0 min-w-[280px]">
                          {['💻', '🚀', '🐱', '🦊', '🤖', '🍎', '🎨', '⚡'].map((emoji) => {
                            const isSelected = newAvatar === emoji;
                            return (
                              <button
                                key={emoji}
                                onClick={() => setNewAvatar(emoji)}
                                className={`text-sm py-2 bg-muted/20 hover:bg-muted border rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-zinc-800 border-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 shadow-sm font-bold' 
                                    : 'border-border/60'
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 昵称编辑行 */}
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                        <div className="flex-1 pr-4">
                          <h4 className="text-xs font-bold text-foreground">自定义设备昵称</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            设置好昵称后，同一局域网内的邻居节点将立即看到您的设备档案
                          </p>
                        </div>
                        <div className="flex gap-2.5 w-full md:w-auto shrink-0 min-w-[320px]">
                          <ShadcnInput
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            placeholder="输入您的专属极客昵称"
                            maxLength={16}
                            className="flex-1 border-border/80 focus-visible:ring-2 focus-visible:ring-zinc-500/10 focus-visible:border-border-hover transition-all duration-200"
                          />
                          <ShadcnButton 
                            onClick={saveProfile} 
                            disabled={!newNickname.trim() || !!(self && self.nickname === newNickname && self.avatar === newAvatar)}
                            className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm"
                          >
                            同步修改
                          </ShadcnButton>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* SUB TAB 3: 本端极客网络及端口参数 */}
                {settingsSubTab === 'network' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">本端局域网硬件与网络参数</h3>
                      <p className="text-[11px] text-muted-foreground">底层去中心化 P2P 协作通信信道的本地运行物理状态</p>
                    </div>

                    {self && (
                      <div className="flex flex-col gap-2.5 py-2 font-mono">
                        {/* 节点唯一 ID */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">设备唯一标识</span>
                            <span className="text-[10px] text-muted-foreground">群组识别特征符</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px] max-w-[200px] truncate" title={self.id}>
                            {self.id}
                          </span>
                        </div>

                        {/* 网络 IP 地址 */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">本端网络 IP 地址</span>
                            <span className="text-[10px] text-muted-foreground">局域网物理信道端点</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px]">
                            {self.ip}
                          </span>
                        </div>

                        {/* 侦听端口 */}
                        <div className="flex text-xs border-b border-border/10 py-3.5 items-center justify-between">
                          <div className="flex flex-col gap-0.5 font-sans">
                            <span className="text-xs font-bold text-foreground">节点侦听端口</span>
                            <span className="text-[10px] text-muted-foreground">数据流套接字物理通道</span>
                          </div>
                          <span className="text-foreground bg-muted/30 px-2 py-0.5 rounded border border-border/40 text-[10px]">
                            {self.port}
                          </span>
                        </div>

                        {/* 去中心化状态 */}
                        <div className="flex flex-col gap-2 py-3.5">
                          <span className="text-xs font-bold text-foreground font-sans">去中心化服务信道物理状态</span>
                          <div className="flex flex-wrap gap-3 mt-1 font-sans">
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              WebSocket 信道
                            </span>
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              mDNS 服务自组网
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB TAB 4: 协同指引与多播提醒 */}
                {settingsSubTab === 'guidelines' && (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                      <h3 className="text-sm font-bold text-foreground">局域网去中心多播提醒</h3>
                      <p className="text-[11px] text-muted-foreground">快速理解 P2P 协作网络的底层保障机制与常见故障排查</p>
                    </div>

                    <div className="flex gap-4 items-start py-4 border-b border-border/10">
                      <Info size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">去中心化多播发现机制</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Share Home 依赖 mDNS（多播 DNS）广播在局域网内自动寻找其他的协作对等体节点，实现零配置自愈合入网。这需要底层网络支持 IGMP / Multicast，如果您的路由器关闭了这一机制，将无法发现节点。
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start py-4 border-b border-border/10">
                      <Cpu size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1.5">
                        <h4 className="text-xs font-bold text-foreground">防火墙与套接字信道</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          文件极速直传基于本地套接字数据流信道。请确保本端系统防火墙已开放相应的 WebSocket 侦听端口（默认为 3000 及随机高端口），并在防病毒软件中将 Share Home 标记为受信任的应用。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

          {activeTab === 'users' && role === 'admin' && (
            <div className="fade-in flex flex-col gap-6 mt-2">
              <section className="rounded-xl border border-border/60 bg-muted/10 p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <KeyRound size={16} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">普通伙伴通用登录密钥</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        普通用户首次访问只需要输入此密钥。密钥会以加盐哈希形式保存到根目录 `conf/auth.json`。
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleUpdateGuestKeySubmit} className="flex w-full md:w-auto gap-2 md:min-w-[360px]">
                    <ShadcnInput
                      type="password"
                      value={newGuestKeyInput}
                      onChange={(e) => {
                        setNewGuestKeyInput(e.target.value);
                        setGuestKeyStatus('idle');
                        setGuestKeyError('');
                      }}
                      placeholder="输入新的伙伴密钥，至少 6 位"
                      className="rounded-lg border-border/70 bg-background"
                    />
                    <ShadcnButton type="submit" disabled={guestKeyStatus === 'saving'} className="rounded-lg shrink-0">
                      {guestKeyStatus === 'saving' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      保存密钥
                    </ShadcnButton>
                  </form>
                </div>
                {guestKeyStatus === 'success' && (
                  <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 rounded-lg px-3 py-2">
                    普通伙伴登录密钥已更新，新登录用户将使用新密钥验证。
                  </div>
                )}
                {guestKeyStatus === 'error' && guestKeyError && (
                  <div className="mt-4 text-xs text-destructive bg-destructive/10 border border-destructive/15 rounded-lg px-3 py-2">
                    {guestKeyError}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">设备权限表</h3>
                    <p className="text-xs text-muted-foreground mt-1">同一 IP 会固定绑定为同一个设备 ID，默认权限全部开放。</p>
                  </div>
                  <ShadcnButton variant="outline" onClick={fetchDevicesList} className="rounded-lg">
                    <RefreshCw size={14} />
                    刷新列表
                  </ShadcnButton>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/20 text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3 text-[11px] font-bold">设备</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold">IP / 系统</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold">身份</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold">权限</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devicesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                            暂无已登记设备。普通伙伴登录或访问工作台后会出现在这里。
                          </td>
                        </tr>
                      ) : devicesList.map((device) => (
                        <tr key={device.id} className="border-t border-border/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center">
                                <UserRound size={14} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate max-w-[180px]">{device.nickname || '局域网伙伴'}</div>
                                <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{device.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-foreground font-mono">{device.ip}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">{device.os || 'unknown'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${
                              device.role === 'admin'
                                ? 'border-primary/20 bg-primary/10 text-primary'
                                : 'border-border/60 bg-muted/20 text-muted-foreground'
                            }`}>
                              {device.role === 'admin' ? <ShieldCheck size={11} /> : <KeyRound size={11} />}
                              {device.role === 'admin' ? '超级管理员' : '普通伙伴'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {[
                                ['allowUpload', '共享上传', device.permissions?.allowUpload],
                                ['allowEditDoc', '文档编写', device.permissions?.allowEditDoc],
                                ['allowCreateDoc', '新建文档', device.permissions?.allowCreateDoc],
                              ].map(([key, label, enabled]) => (
                                <button
                                  key={String(key)}
                                  onClick={() => handleUpdateDevicePermission(device.id, key as 'allowUpload' | 'allowEditDoc' | 'allowCreateDoc', !enabled)}
                                  disabled={isUpdatingDevicePerm === `${device.id}_${key}`}
                                  className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all ${
                                    enabled
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-muted/20 border-border/60 text-muted-foreground'
                                  }`}
                                >
                                  {isUpdatingDevicePerm === `${device.id}_${key}` ? '保存中' : `${label} ${enabled ? '开' : '关'}`}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${device.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${device.online ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                              {device.online ? '在线' : '离线'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* TAB 5: 管理员专属设置模块 (Premium 极客风去卡片化扁平直行表单设计) */}
          {activeTab === 'admin-settings' && role === 'admin' && (
            <div className="flex flex-col gap-6 w-full items-start fade-in mt-2 max-w-2xl animate-in fade-in duration-200">
              <section className="w-full flex flex-col gap-5">
                <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                  <h3 className="text-sm font-bold text-foreground">修改管理员凭证</h3>
                  <p className="text-[11px] text-muted-foreground">更改系统后台管理员用户名或登录密码，新设置将在提交验证后立即写入磁盘并登出重新登录</p>
                </div>

                <form onSubmit={handleUpdateAdminSettingsSubmit} className="flex flex-col gap-4 py-2 w-full">
                  
                  {/* 行：当前用户名 (只读) */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">当前管理员用户名</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        系统当前的管理员登录账号，不可在这里修改，由磁盘数据同步获取
                      </p>
                    </div>
                    <div className="w-full md:w-[320px] shrink-0">
                      <ShadcnInput
                        type="text"
                        value={adminUsername}
                        disabled
                        className="w-full bg-muted/40 text-muted-foreground border-border/40 cursor-not-allowed font-mono text-xs h-9 rounded-md"
                      />
                    </div>
                  </div>

                  {/* 行：当前密码验证 */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">当前管理员密码 <span className="text-destructive">*</span></h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        为了保障系统安全，进行任何修改前必须验证当前的管理员密码
                      </p>
                    </div>
                    <div className="relative w-full md:w-[320px] shrink-0 flex items-center">
                      <ShadcnInput
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentAdminPass}
                        onChange={(e) => {
                          setCurrentAdminPass(e.target.value);
                          setAdminSettingsStatus('idle');
                          setAdminSettingsError('');
                        }}
                        placeholder="请输入当前密码验证身份"
                        className="w-full border-border/80 pr-10 text-xs h-9 rounded-md"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors"
                      >
                        {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* 行：新管理员用户名 */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">新管理员用户名 <span className="text-destructive">*</span></h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        输入新的管理员登录用户名，允许和当前相同以仅修改密码
                      </p>
                    </div>
                    <div className="w-full md:w-[320px] shrink-0">
                      <ShadcnInput
                        type="text"
                        value={newAdminUser}
                        onChange={(e) => {
                          setNewAdminUser(e.target.value);
                          setAdminSettingsStatus('idle');
                          setAdminSettingsError('');
                        }}
                        placeholder="输入新管理员用户名"
                        className="w-full border-border/80 text-xs font-mono h-9 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  {/* 行：新管理员密码 (选填) */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">新管理员密码</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        留空表示仅修改用户名；若需修改密码，长度至少 6 位
                      </p>
                    </div>
                    <div className="relative w-full md:w-[320px] shrink-0 flex items-center">
                      <ShadcnInput
                        type={showNewPass ? 'text' : 'password'}
                        value={newAdminPass}
                        onChange={(e) => {
                          setNewAdminPass(e.target.value);
                          setAdminSettingsStatus('idle');
                          setAdminSettingsError('');
                        }}
                        placeholder="输入新密码 (至少 6 位)"
                        className="w-full border-border/80 pr-10 text-xs h-9 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors"
                      >
                        {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* 行：确认新密码 */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">确认新密码</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        再次输入新管理员密码以确保输入无误
                      </p>
                    </div>
                    <div className="relative w-full md:w-[320px] shrink-0 flex items-center">
                      <ShadcnInput
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmAdminPass}
                        onChange={(e) => {
                          setConfirmAdminPass(e.target.value);
                          setAdminSettingsStatus('idle');
                          setAdminSettingsError('');
                        }}
                        placeholder="请再次输入新密码"
                        className="w-full border-border/80 pr-10 text-xs h-9 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors"
                      >
                        {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* 状态与控制项 */}
                  <div className="flex flex-col gap-3 mt-2 w-full">
                    {adminSettingsStatus === 'error' && adminSettingsError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                        <ShieldAlert size={14} />
                        修改失败：{adminSettingsError}
                      </div>
                    )}
                    {adminSettingsStatus === 'success' && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                        <Check size={14} />
                        凭证修改通过，安全退出登录中...
                      </div>
                    )}

                    <div className="flex justify-end gap-3 mt-2">
                      <ShadcnButton 
                        type="submit" 
                        disabled={adminSettingsStatus === 'saving'}
                        className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 shadow-sm rounded-lg"
                      >
                        {adminSettingsStatus === 'saving' ? (
                          <>
                            <RefreshCw size={14} className="animate-spin mr-1.5" />
                            保存修改中...
                          </>
                        ) : (
                          '同步保存凭证'
                        )}
                      </ShadcnButton>
                    </div>
                  </div>

                </form>
              </section>

              {/* 二级面板：双因子两步验证 (2FA / TOTP) 极客安全中心 */}
              <section className="w-full flex flex-col gap-5 mt-6 border-t border-border/20 pt-6 animate-in fade-in duration-200">
                <div className="flex flex-col gap-0.5 border-b border-border/20 pb-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck size={16} className="text-primary" />
                    双因子安全两步验证 (2FA)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">通过手机两步验证接收器（如 Google Authenticator）为管理员账号加锁，开启后支持动态验证码快捷免密登录</p>
                </div>

                <div className="flex flex-col gap-4 py-2 w-full">
                  {/* 行：2FA 状态 Switch */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between py-4 border-b border-border/10">
                    <div className="flex-1 pr-4">
                      <h4 className="text-xs font-bold text-foreground">两步验证 (2FA) 状态</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {admin2faEnabled 
                          ? '当前已开启两步验证，管理员登录时可凭动态 2FA 码进行快捷免密码安全登录' 
                          : '当前未开启两步验证。开启后将为您的后台管理数据提供工业级安全防护'
                        }
                      </p>
                    </div>
                    <div className="shrink-0">
                      {admin2faEnabled ? (
                        <ShadcnButton
                          type="button"
                          onClick={() => {
                            setTotp2faError('');
                            setTotp2faStatus('idle');
                            setDisable2faPass('');
                            setShowDisableModal(true);
                          }}
                          className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-lg h-9 text-xs transition-all shadow-sm"
                        >
                          关闭两步验证 (2FA)
                        </ShadcnButton>
                      ) : (
                        !is2faBindingActive && (
                          <ShadcnButton
                            type="button"
                            onClick={handleGet2FaDetails}
                            disabled={totp2faStatus === 'loading'}
                            className="bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg h-9 text-xs shadow-sm font-semibold transition-all"
                          >
                            {totp2faStatus === 'loading' ? '正在生成...' : '立即开启两步验证'}
                          </ShadcnButton>
                        )
                      )}
                    </div>
                  </div>

                  {/* 展开：2FA 绑定向导卡片 */}
                  {is2faBindingActive && !admin2faEnabled && (
                    <div className="p-5 rounded-xl border border-border/60 bg-muted/20 animate-in slide-in-from-top duration-300 flex flex-col gap-5 w-full">
                      <div className="flex items-start justify-between border-b border-border/10 pb-3">
                        <h4 className="text-xs font-bold text-foreground">绑定两步验证接收器</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setIs2faBindingActive(false);
                            setTemp2faSecret('');
                            setTemp2faQrUri('');
                            setTotpVerifyCode('');
                          }}
                          className="text-muted-foreground hover:text-foreground text-xs font-semibold"
                        >
                          取消
                        </button>
                      </div>

                      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
                        <div className="flex-1 flex flex-col gap-3">
                          <span className="text-[11px] text-muted-foreground leading-relaxed">
                            <strong>步骤 1</strong>：使用手机端 2FA 接收器 App（如 Google Authenticator、Microsoft Authenticator 等）扫描右侧二维码，或手动输入秘钥进行配对绑定。
                          </span>
                          
                          {/* 物理秘钥文本 */}
                          <div className="flex flex-col gap-1.5 bg-muted/40 p-3 rounded-lg border border-border/30">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">2FA 手动绑定秘钥 (点击可选中复制)</span>
                            <span className="text-xs font-mono font-bold tracking-wider text-foreground break-all select-all">
                              {temp2faSecret}
                            </span>
                          </div>

                          <span className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                            <strong>步骤 2</strong>：绑定完成后，在下方输入手机 App 上产生的 6 位数字验证码进行双向确认，校验通过后即可正式激活。
                          </span>
                        </div>

                        {/* 二维码显示区 */}
                        {temp2faQrUri && (
                          <div className="w-[180px] h-[180px] bg-white p-2 rounded-lg border border-border/40 shrink-0 flex items-center justify-center shadow-md animate-in zoom-in duration-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={temp2faQrUri} alt="2FA QR Code" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>

                      {/* 二次绑定确认表单 */}
                      <form onSubmit={handleVerifyAndEnable2Fa} className="flex gap-3 mt-2 border-t border-border/10 pt-4">
                        <div className="flex-1">
                          <ShadcnInput
                            type="text"
                            value={totpVerifyCode}
                            onChange={(e) => {
                              setTotpVerifyCode(e.target.value);
                              setTotp2faStatus('idle');
                              setTotp2faError('');
                            }}
                            placeholder="输入 6 位动态验证码确认"
                            maxLength={6}
                            className="w-full border-border/80 text-xs font-mono text-center tracking-widest h-9 rounded-lg"
                            required
                          />
                        </div>
                        <ShadcnButton
                          type="submit"
                          disabled={totp2faStatus === 'loading'}
                          className="bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 hover:dark:bg-zinc-200 px-4 rounded-lg h-9 text-xs shrink-0 shadow-sm"
                        >
                          {totp2faStatus === 'loading' ? '正在验证...' : '确认并激活'}
                        </ShadcnButton>
                      </form>

                      {totp2faStatus === 'error' && totp2faError && (
                        <div className="p-2.5 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-[11px] flex items-center gap-2 animate-in fade-in duration-200">
                          <ShieldAlert size={12} />
                          绑定校验失败：{totp2faError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2FA 状态显示 */}
                  {totp2faStatus === 'success' && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200 mt-2">
                      <Check size={14} />
                      两步验证操作已圆满成功！
                    </div>
                  )}
                  {totp2faStatus === 'error' && totp2faError && !is2faBindingActive && !showDisableModal && (
                    <div className="p-3 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200 mt-2">
                      <ShieldAlert size={14} />
                      两步验证操作失败：{totp2faError}
                    </div>
                  )}
                </div>
              </section>

              {/* 模态弹窗：关闭 2FA 时的静态密码校验 Dialog */}
              {showDisableModal && (
                <div className="fixed top-0 left-0 right-0 bottom-0 z-[10000] bg-background/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200 p-4">
                  <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg animate-in zoom-in duration-200 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Lock size={15} className="text-destructive" />
                        安全确证：关闭两步验证
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                        为了您的系统安全，注销手机 2FA 绑定前，必须验证当前管理员登录密码。
                      </p>
                    </div>

                    <form onSubmit={handleDisable2Fa} className="flex flex-col gap-3 mt-2">
                      <ShadcnInput
                        type="password"
                        value={disable2faPass}
                        onChange={(e) => {
                          setDisable2faPass(e.target.value);
                          setTotp2faStatus('idle');
                          setTotp2faError('');
                        }}
                        placeholder="输入当前管理员密码"
                        className="w-full border-border/80 text-xs h-9 rounded-lg px-3"
                        required
                      />

                      {totp2faStatus === 'error' && totp2faError && (
                        <div className="p-2.5 bg-destructive/10 border border-destructive/15 text-destructive rounded-lg text-[11px] flex items-center gap-2 animate-in fade-in duration-200">
                          <ShieldAlert size={12} />
                          校验失败：{totp2faError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2.5 mt-2 border-t border-border/10 pt-3">
                        <ShadcnButton
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowDisableModal(false);
                            setDisable2faPass('');
                            setTotp2faStatus('idle');
                            setTotp2faError('');
                          }}
                          className="h-8 text-[11px] rounded-lg border-border"
                        >
                          取消
                        </ShadcnButton>
                        <ShadcnButton
                          type="submit"
                          disabled={totp2faStatus === 'loading'}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-[11px] rounded-lg px-3"
                        >
                          {totp2faStatus === 'loading' ? '正在确证...' : '确认注销绑定'}
                        </ShadcnButton>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* 全局局域网极速文件传输中心抽屉 (Drawer) */}
      <Transfer 
        tasks={tasks} 
        incomingRequest={incomingRequest} 
        onAccept={acceptRequest} 
        onReject={rejectRequest} 
        onCancel={cancelTransfer}
        isOpen={isTransferDrawerOpen}
        onClose={() => setIsTransferDrawerOpen(false)}
      />

      {/* 4. 高端数据安全合并迁移确认弹窗 */}
      {showMigrationModal && migrationPaths && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          background: theme === 'dark' ? 'rgba(9, 9, 11, 0.75)' : 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px) saturate(190%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, rgba(128, 128, 128, 0.15))',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: theme === 'dark' 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.08)' 
              : '0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 0 20px rgba(99, 102, 241, 0.04)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative',
          }}>
            {/* 头部区域 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FolderOpen size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>发现历史存储数据</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>检测到您的原有目录中存有数据文件</p>
              </div>
            </div>

            {/* 警示说明框 */}
            <div style={{
              background: 'rgba(128, 128, 128, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '16px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div>
                您即将将默认存储路径更换为：
                <div style={{
                  background: 'rgba(99, 102, 241, 0.05)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--accent-color)',
                  wordBreak: 'break-all',
                  border: '1px solid rgba(99, 102, 241, 0.15)'
                }}>
                  {migrationPaths.newPath}
                </div>
              </div>

              <div>
                原物理存储目录中存有共享文件及协作云文档：
                <div style={{
                  background: 'rgba(128, 128, 128, 0.05)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  marginTop: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-muted)',
                  wordBreak: 'break-all',
                  border: '1px solid var(--border-color)'
                }}>
                  {migrationPaths.oldPath}
                </div>
              </div>

              <div style={{ color: '#fbbf24', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', marginTop: '4px' }}>
                <ShieldAlert size={13} style={{ flexShrink: 0, color: '#fbbf24' }} />
                <span>推荐执行“一键自动迁移”，确保历史共享与云文档在新目录中无缝重现。</span>
              </div>
            </div>

            {/* 行为决策按钮区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {isMigrating ? (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}>
                  {/* 第一行：状态标题 + 实时百分比数值 */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', fontSize: '0.82rem', fontWeight: 600 }}>
                      <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                      <span>正在全速合并搬运历史文件...</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-color)', marginLeft: 'auto' }}>
                      {migrationProgress ? `${migrationProgress.percentage}%` : '0%'}
                    </span>
                  </div>

                  {/* 物理进度条轨道 */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(128, 128, 128, 0.08)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${migrationProgress ? migrationProgress.percentage : 0}%`,
                      background: 'linear-gradient(90deg, var(--accent-color, #2563eb) 0%, rgba(99, 102, 241, 0.8) 100%)',
                      borderRadius: '99px',
                      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)'
                    }} />
                  </div>

                  {/* 底部详细文件名展示 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{
                      display: 'flex',
                      width: '100%',
                      fontFamily: 'monospace'
                    }}>
                      <span>文件处理总进度:</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>
                        {migrationProgress ? `${migrationProgress.current} / ${migrationProgress.total}` : '0 / 0'}
                      </span>
                    </div>
                    
                    <div style={{
                      background: 'rgba(128, 128, 128, 0.05)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }} title={migrationProgress?.currentFile || '准备迁移...'}>
                      <span style={{ color: 'var(--accent-color)', flexShrink: 0 }}>📂</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {migrationProgress ? migrationProgress.currentFile : '建立安全通道...'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleSaveConfig(true)}
                    style={{
                      background: 'var(--accent-color, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 20px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    <Check size={15} />
                    一键自动迁移并应用
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleSaveConfig(false)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(128, 128, 128, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      仅切换路径 (保留现状)
                    </button>
                    <button
                      onClick={() => {
                        setShowMigrationModal(false);
                        setMigrationPaths(null);
                        // 恢复为原配置路径
                        fetchConfig();
                      }}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '1px solid transparent',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      取消修改
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 在线一键热升级控制终端模态框 */}
      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-background border border-border/20 shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col scale-in">
            
            {/* 头部高光 */}
            <div className="bg-gradient-to-r from-accent/5 via-accent/10 to-transparent p-5 border-b border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 animate-bounce flex items-center justify-center">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">在线一键热升级系统</h3>
                  <p className="text-[10px] text-muted-foreground">由极客热重启守护循环与编程式更新引擎驱动</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isUpdatingSystem) {
                    setShowUpdateModal(false);
                    setUpdateLogs([]);
                  }
                }}
                disabled={isUpdatingSystem}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/10 border-none bg-transparent cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            {/* 主体参数展示 */}
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center justify-around bg-muted/20 border border-border/5 rounded-xl p-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">当前部署版本</span>
                  <span className="text-sm font-black font-mono text-muted-foreground">v{updateInfo.currentVersion}</span>
                </div>
                <div className="h-8 w-px bg-border/20"></div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">NPM 最新版本</span>
                  <span className={`text-sm font-black font-mono ${updateInfo.hasUpdate ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>v{updateInfo.latestVersion}</span>
                </div>
              </div>

              {/* 版本状态与指引 */}
              <div className="text-xs text-muted-foreground text-center leading-relaxed px-4">
                {updateInfo.hasUpdate ? (
                  <p>
                    🎉 发现可用的新版本！本次更新将包含**类似 B+ 树启发式拓扑兄弟链自愈、物理路径隔离、前后端鉴权防火墙和共享中心路径绝对对齐**等重大物理安全特性的合并。建议您立即执行在线一键热更新。
                  </p>
                ) : (
                  <p className="text-emerald-500 font-semibold flex items-center justify-center gap-2">
                    ✓ 您的 Share Home 系统已是 NPM 官方最新版本，无需执行任何更新操作。
                  </p>
                )}
              </div>

              {/* 黑客更新日志流终端框 (当开始更新时触发显现) */}
              {(systemUpdateStatus !== 'idle' || updateLogs.length > 0) && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    热升级日志控制台 (NPM Spawner Terminal)
                  </span>
                  <div className="bg-zinc-950 border border-border/10 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-emerald-400 flex flex-col gap-1.5 select-text leading-relaxed">
                    {updateLogs.map((log, idx) => (
                      <div key={idx} className={log.type === 'error' ? 'text-rose-400 font-bold' : ''}>
                        {log.text}
                      </div>
                    ))}
                    {systemUpdateStatus === 'updating' && (
                      <div className="text-amber-500 animate-pulse">[NPM] 正在执行包物理依赖拉取并构建，请耐心等待 10 秒左右...</div>
                    )}
                    {systemUpdateStatus === 'reconnecting' && (
                      <div className="text-sky-400 animate-pulse font-semibold">[SYSTEM] 物理子进程重拉起完毕，正在尝试重新握手心跳...</div>
                    )}
                    {systemUpdateStatus === 'success' && (
                      <div className="text-emerald-400 font-bold">✓ [SYSTEM] 心跳重新连接建立成功！系统已是最新版，控制台即刻关闭...</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 尾部控制 */}
            <div className="p-4 bg-muted/10 border-t border-border/10 flex justify-end gap-3">
              {updateInfo.hasUpdate && (
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setUpdateLogs([]);
                  }}
                  disabled={isUpdatingSystem}
                  className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-muted/20 border-none bg-transparent text-muted-foreground cursor-pointer disabled:opacity-50"
                >
                  暂不更新
                </button>
              )}
              
              {updateInfo.hasUpdate && systemUpdateStatus === 'idle' && (
                <button
                  onClick={handleStartSystemUpdate}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-none cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/10"
                >
                  <Cpu size={12} />
                  立即在线一键热升级
                </button>
              )}

              {systemUpdateStatus === 'updating' && (
                <button
                  disabled
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500/20 text-amber-500/80 border-none flex items-center gap-2 disabled:opacity-80"
                >
                  <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                  物理更新中...
                </button>
              )}

              {systemUpdateStatus === 'reconnecting' && (
                <button
                  disabled
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-500/20 text-sky-500/80 border-none flex items-center gap-2 disabled:opacity-80"
                >
                  <span className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
                  热重启握手中...
                </button>
              )}

              {(systemUpdateStatus === 'success' || systemUpdateStatus === 'failed' || !updateInfo.hasUpdate) && (
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setUpdateLogs([]);
                    setSystemUpdateStatus('idle');
                  }}
                  className={`px-5 py-2 text-xs font-bold rounded-xl border-none cursor-pointer text-white ${systemUpdateStatus === 'success' || !updateInfo.hasUpdate ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                >
                  {systemUpdateStatus === 'success' || !updateInfo.hasUpdate ? '已知晓' : '关闭'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!noticeDialog} onOpenChange={(open) => !open && setNoticeDialog(null)}>
        <DialogContent className="rounded-xl border-border/70 bg-popover p-0 sm:max-w-[420px]" showCloseButton={false}>
          <DialogHeader className="gap-0 border-b border-border/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                noticeDialog?.variant === 'error'
                  ? 'border-destructive/20 bg-destructive/10 text-destructive'
                  : 'border-primary/20 bg-primary/10 text-primary'
              }`}>
                {noticeDialog?.variant === 'error' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold tracking-tight">
                  {noticeDialog?.title}
                </DialogTitle>
                {noticeDialog?.description && (
                  <DialogDescription className="mt-1 text-xs leading-5">
                    {noticeDialog.description}
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>

          {noticeDialog?.permissions && (
            <div className="px-5 py-4">
              <div className="grid gap-2">
                {[
                  ['文件上传/分享', noticeDialog.permissions.allowUpload],
                  ['文档编写', noticeDialog.permissions.allowEditDoc],
                  ['新建云文档', noticeDialog.permissions.allowCreateDoc],
                ].map(([label, enabled]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      enabled
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-destructive/20 bg-destructive/10 text-destructive'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-destructive'}`} />
                      {enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border/50 px-5 py-4">
            <ShadcnButton onClick={() => setNoticeDialog(null)} className="rounded-lg">
              知道了
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
