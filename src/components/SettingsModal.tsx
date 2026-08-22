// Context: SettingsModal 重構 - 套用通用 BaseModal
import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useUIStore } from '../stores/useUIStore';
import { User as UserIcon, Shield, Bell, ShieldOff } from 'lucide-react';
import { BaseModal } from './common/BaseModal';

import { ProfileSettingsTab } from './settings/ProfileSettingsTab';
import { SecurityPinTab } from './settings/SecurityPinTab';
import { NotificationTab } from './settings/NotificationTab';
import { BlockedUsersTab } from './settings/BlockedUsersTab';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onOpenPinModal?: (mode: 'setup' | 'enter' | 'confirm-reset') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen = true,
  onClose,
  onOpenPinModal,
}) => {
  const { user, token, updateUser, API_BASE } = useContext(AuthContext);
  const { notify } = useNotification();
  const { showConfirmModal } = useUIStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'blocked' | 'notification'>('profile');

  if (isOpen === false) return null;

  const handleUpdateProfile = async (accountID: string, displayName: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ account_id: accountID, display_name: displayName }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        updateUser(data.user);
        notify({ message: '個人資料已成功更新！', type: 'success' });
      } else {
        notify({ message: data.error || '更新失敗', type: 'danger' });
      }
    } catch (err: any) {
      notify({ message: err.message || '更新失敗', type: 'danger' });
    }
  };

  const handleTriggerPinModal = (mode: 'setup' | 'enter' | 'confirm-reset') => {
    if (mode === 'confirm-reset') {
      showConfirmModal({
        title: '確認重置 PIN 碼',
        message: '確定要重置您的安全 PIN 碼嗎？這將需要您重新建立 PIN 碼與金鑰備份。',
        danger: true,
        confirmText: '確定重置',
        onConfirm: () => {
          if (onOpenPinModal) onOpenPinModal(mode);
        },
      });
    } else {
      if (onOpenPinModal) {
        onOpenPinModal(mode);
      }
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="個人與安全設定"
      maxWidth="720px"
      height="520px"
    >
      <div className={styles.settingsBody}>
        <div className={styles.settingsSidebar}>
          <button
            className={`${styles.settingsNavItem} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={16} />
            <span>個人帳號</span>
          </button>

          <button
            className={`${styles.settingsNavItem} ${activeTab === 'security' ? styles.active : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={16} />
            <span>安全通訊與 PIN 碼</span>
          </button>

          <button
            className={`${styles.settingsNavItem} ${activeTab === 'blocked' ? styles.active : ''}`}
            onClick={() => setActiveTab('blocked')}
          >
            <ShieldOff size={16} />
            <span>封鎖名單</span>
          </button>

          <button
            className={`${styles.settingsNavItem} ${activeTab === 'notification' ? styles.active : ''}`}
            onClick={() => setActiveTab('notification')}
          >
            <Bell size={16} />
            <span>通知與提醒</span>
          </button>
        </div>

        <div className={styles.settingsContent}>
          {activeTab === 'profile' && (
            <ProfileSettingsTab user={user} onUpdateProfile={handleUpdateProfile} />
          )}

          {activeTab === 'security' && (
            <SecurityPinTab
              user={user}
              onOpenPinModal={handleTriggerPinModal}
            />
          )}

          {activeTab === 'blocked' && (
            <BlockedUsersTab token={token} notify={notify} />
          )}

          {activeTab === 'notification' && <NotificationTab />}
        </div>
      </div>
    </BaseModal>
  );
};

