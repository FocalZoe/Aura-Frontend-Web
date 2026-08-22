import React from 'react';
import { User } from '../../types';
import { Settings, Sun, Moon, LogOut, UserCheck, Users } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import styles from '../Sidebar.module.css';

interface SidebarHeaderProps {
  user: User | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onOpenSettings?: () => void;
  onOpenPendingModal: () => void;
  pendingCount: number;
  logout: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  user,
  theme,
  toggleTheme,
  onOpenSettings,
  onOpenPendingModal,
  pendingCount,
  logout,
}) => {
  const { setShowCreateGroupModal, showConfirmModal } = useUIStore();
  const displayName = user?.display_name || user?.account_id || '';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogoutConfirm = () => {
    showConfirmModal({
      title: '確認登出帳號',
      message: '確定要登出 Focal Aura 系統嗎？登出後需重新登入以存取通訊。',
      danger: true,
      confirmText: '登出',
      onConfirm: () => {
        logout();
      },
    });
  };

  return (
    <div className={styles.sidebarHeader}>
      <div className={styles.userProfile}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.profileInfo}>
          <h3>{displayName}</h3>
          <p>@{user?.account_id}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className={styles.themeToggleBtn}
          title="建立新群組"
          onClick={() => setShowCreateGroupModal(true)}
        >
          <Users size={18} />
        </button>

        {pendingCount > 0 && (
          <button
            className={styles.themeToggleBtn}
            style={{ position: 'relative' }}
            title="好友邀請待處理"
            onClick={onOpenPendingModal}
          >
            <UserCheck size={18} />
            <span className={styles.pendingBadge}>
              {pendingCount}
            </span>
          </button>
        )}

        <button className={styles.themeToggleBtn} onClick={toggleTheme} title="切換主題">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className={styles.themeToggleBtn} onClick={onOpenSettings} title="個人設定">
          <Settings size={18} />
        </button>
        <button className={styles.themeToggleBtn} onClick={handleLogoutConfirm} title="登出">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};
