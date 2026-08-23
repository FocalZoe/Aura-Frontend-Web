// Context: [App核心架構] 全域狀態與初始化管理，直連 Zustand Stores 與 WebSocket/E2EE 服務
import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';
import { useChatStore } from './stores/useChatStore';
import { websocketService } from './services/websocketService';
import { e2eeService } from './services/e2eeService';
import { apiClient } from './services/apiClient';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { PinModal } from './components/PinModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CallModal } from './components/Call/CallModal';
import { UserProfileModal } from './components/UserProfileModal';
import { useUIStore } from './stores/useUIStore';
import { 
  getLocalPrivateKey, 
  saveLocalPrivateKey, 
  clearLocalPrivateKey, 
  generateECDHKeyPair, 
  exportPublicKey, 
  encryptPrivateKey, 
  decryptPrivateKey, 
  arrayBufferToBase64 
} from './utils/crypto';
import { User } from './types';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/global.css';
import styles from './styles/App.module.css';

const ChatApp: React.FC = () => {
  const { token, user, loading, updateUser, API_BASE } = useContext(AuthContext);
  // Context: [單欄切換] 直接響應式訂閱 Zustand Store，確保好友、群組與陌生訊息均能無縫觸發單欄切換
  const activeChatUser = useChatStore((s: any) => s.activeChatUser);
  const activeGroup = useChatStore((s: any) => s.activeGroup);
  const friends = useChatStore((s: any) => s.friends);
  const selectedProfileUser = useUIStore((s: any) => s.selectedProfileUser);
  const profileModalSource = useUIStore((s: any) => s.profileModalSource);
  const setSelectedProfileUser = useUIStore((s: any) => s.setSelectedProfileUser);
  const { setFriends, setFriendsMap, setIncomingStrangerUsers, setSentStrangerUsers } = useChatStore();
  const hasActiveChat = Boolean(activeChatUser || activeGroup);
  
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'enter' | 'confirm-reset' | null>(null);
  const [pinError, setPinError] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const fetchInitialData = async (authToken: string) => {
    try {
      const friendsData = await apiClient.get<User[]>('/friends', authToken);
      if (Array.isArray(friendsData)) {
        const map: Record<number, string> = {};
        friendsData.forEach((f) => {
          if (f.public_key) map[f.id] = f.public_key;
        });
        setFriendsMap(map);
        setFriends(friendsData);
      }
    } catch (e) {
      console.error('[App] 獲取好友列表失敗:', e);
    }

    try {
      const [inc, sent] = await Promise.all([
        apiClient.get<User[]>('/messages/strangers/incoming', authToken),
        apiClient.get<User[]>('/messages/strangers/sent', authToken),
      ]);
      if (Array.isArray(inc)) setIncomingStrangerUsers(inc);
      if (Array.isArray(sent)) setSentStrangerUsers(sent);
    } catch (e) {
      console.error('[App] 獲取陌生人名單失敗:', e);
    }
  };

  useEffect(() => {
    if (token && user) {
      websocketService.connect(token, user.id);
      fetchInitialData(token);
    } else {
      websocketService.disconnect();
      e2eeService.clearCache();
    }
  }, [token, user?.id]);

  useEffect(() => {
    const checkKeyPair = async () => {
      if (!token || !user) {
        setPinModalMode(null);
        return;
      }

      try {
        const localPrivateKey = await getLocalPrivateKey(user.id);
        if (!user.has_backup_key) {
          setPinModalMode('setup');
        } else if (!localPrivateKey) {
          setPinModalMode('enter');
        } else {
          setPinModalMode(null);
        }
      } catch (err) {
        console.error('檢查金鑰對狀態失敗:', err);
      }
    };

    checkKeyPair();
  }, [token, user]);

  // Context: 修正 PIN 設定與輸入時加密解密私鑰之參數與 API 終端
  const handlePinSubmit = async (pin: string | null) => {
    if (!token || !user || !pin) return;
    setPinError('');

    try {
      if (pinModalMode === 'setup') {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = arrayBufferToBase64(salt.buffer);

        const keyPair = await generateECDHKeyPair();
        const pubKeyPem = await exportPublicKey(keyPair.publicKey);
        const { encrypted_private_key, iv } = await encryptPrivateKey(keyPair.privateKey, pin, saltBase64);

        const combinedEncryptedPrivateKey = `${encrypted_private_key}:${iv}`;

        const res = await fetch(`${API_BASE}/users/keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            public_key: pubKeyPem,
            encrypted_private_key: combinedEncryptedPrivateKey,
            key_salt: saltBase64
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || errData.message || '備份金鑰失敗');
        }

        await saveLocalPrivateKey(user.id, keyPair.privateKey);
        updateUser({
          ...user,
          public_key: pubKeyPem,
          encrypted_private_key: combinedEncryptedPrivateKey,
          key_salt: saltBase64,
          has_backup_key: true
        });
        await fetchInitialData(token);
        setPinModalMode(null);

      } else if (pinModalMode === 'enter') {
        const encryptedPrivKeyStr = user.encrypted_private_key;
        const saltBase64 = user.key_salt;

        if (!encryptedPrivKeyStr || !saltBase64) {
          throw new Error('帳號缺乏遠端備份金鑰資料，請重置 PIN 碼');
        }

        const [encryptedBase64, ivBase64] = encryptedPrivKeyStr.includes(':')
          ? encryptedPrivKeyStr.split(':')
          : [encryptedPrivKeyStr, ''];

        const privateKey = await decryptPrivateKey(encryptedBase64, pin, saltBase64, ivBase64);
        await saveLocalPrivateKey(user.id, privateKey);
        await fetchInitialData(token);
        setPinModalMode(null);
      }
    } catch (err: any) {
      console.error('PIN 驗證/設定處理失敗:', err);
      setPinError(err.message || 'PIN 碼不正確，解密失敗');
    }
  };

  const handleConfirmReset = async () => {
    if (!user) return;
    try {
      await clearLocalPrivateKey(user.id);
      updateUser({ ...user, has_backup_key: false, public_key: '' });
      setPinModalMode('setup');
    } catch (err) {
      console.error('清除本地金鑰失敗:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: '500' }}>
        載入中...
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <div className={styles.appGlow} />

      {!token ? (
        <Login />
      ) : (
        <div className={`${styles.mainPanel} ${hasActiveChat ? styles.hasActiveChat : ''} glass`}>
          <Sidebar onOpenSettings={() => setShowSettingsModal(true)} />
          <ChatWindow />
        </div>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onOpenPinModal={(mode) => setPinModalMode(mode)}
      />

      {pinModalMode && (
        <PinModal 
          mode={pinModalMode} 
          onSubmit={handlePinSubmit} 
          onCancelReset={() => setPinModalMode('confirm-reset')}
          onConfirmReset={handleConfirmReset}
          error={pinError}
        />
      )}

      <ConfirmModal />
      {/* Context: 掛載即時語音與視訊通話 Modal */}
      <CallModal />

      {/* Context: [全域名片/對話詳情] 掛載個人名片/對話詳情 Modal */}
      <UserProfileModal
        userProfile={selectedProfileUser}
        source={profileModalSource}
        onClose={() => setSelectedProfileUser(null)}
        isFriend={
          !!selectedProfileUser &&
          friends.some((f: any) => f.id === selectedProfileUser.id)
        }
        onFriendChange={() => token && fetchInitialData(token)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ChatApp />
    </ErrorBoundary>
  );
};

export default App;

