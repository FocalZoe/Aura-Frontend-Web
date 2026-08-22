// TEAM_012: App.tsx 全域 CSS Modules 遷移
import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';
import { SocketContext } from './context/SocketContext';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { PinModal } from './components/PinModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { CallModal } from './components/Call/CallModal';
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
import './styles/global.css';
import styles from './styles/App.module.css';

const ChatApp: React.FC = () => {
  const { token, user, loading, updateUser, API_BASE } = useContext(AuthContext);
  const { fetchFriendsMap } = useContext(SocketContext);
  
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'enter' | 'confirm-reset' | null>(null);
  const [pinError, setPinError] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

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

  // TEAM_013: 修正 PIN 設定與輸入時加密解密私鑰之參數與 API 終端
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
        await fetchFriendsMap();
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
        await fetchFriendsMap();
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
        <div className={`${styles.mainPanel} glass`}>
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
      {/* TEAM_014: 掛載即時語音與視訊通話 Modal */}
      <CallModal />
    </div>
  );
};

export default ChatApp;
