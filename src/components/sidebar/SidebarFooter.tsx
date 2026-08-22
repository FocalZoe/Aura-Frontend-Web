// Context: [側邊欄底部工具列] 集中管理搜尋、群組建立、好友邀請、主題切換、設定與危險登出按鈕
import React from 'react';
import { Search, Users, UserCheck, Sun, Moon, Settings, LogOut } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import styles from '../Sidebar.module.css';

interface SidebarFooterProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onOpenSettings?: () => void;
  onOpenPendingModal: () => void;
  onOpenSearchModal: () => void;
  pendingCount: number;
  logout: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  theme,
  toggleTheme,
  onOpenSettings,
  onOpenPendingModal,
  onOpenSearchModal,
  pendingCount,
  logout,
}) => {
  const { setShowCreateGroupModal, showConfirmModal } = useUIStore();

  const handleLogoutConfirm = () => {
    showConfirmModal({
      title: '確認登出帳號',
      message: '確定要登出 Aura 系統嗎？登出後需重新登入以存取通訊。',
      danger: true,
      confirmText: '登出帳號',
      onConfirm: () => {
        logout();
      },
    });
  };

  return (
    <div className={styles.sidebarFooter}>
      <div className={styles.footerActionGroup}>
        <button
          className={styles.footerBtn}
          title="搜尋使用者或好友 ID"
          onClick={onOpenSearchModal}
        >
          <Search size={18} />
          <span>搜尋</span>
        </button>

        <button
          className={styles.footerBtn}
          title="建立新群組"
          onClick={() => setShowCreateGroupModal(true)}
        >
          <Users size={18} />
          <span>群組</span>
        </button>

        <button
          className={`${styles.footerBtn} ${pendingCount > 0 ? styles.footerBtnActive : ''}`}
          style={{ position: 'relative' }}
          title={pendingCount > 0 ? `有 ${pendingCount} 個好友邀請待處理` : '好友邀請'}
          onClick={onOpenPendingModal}
        >
          <UserCheck size={18} />
          <span>邀請</span>
          {pendingCount > 0 && (
            <span className={styles.pendingBadge}>
              {pendingCount}
            </span>
          )}
        </button>

        <button
          className={styles.footerBtn}
          onClick={toggleTheme}
          title={`切換為${theme === 'dark' ? '淺色' : '深色'}主題`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>主題</span>
        </button>

        <button
          className={styles.footerBtn}
          onClick={onOpenSettings}
          title="個人與系統設定"
        >
          <Settings size={18} />
          <span>設定</span>
        </button>
      </div>

      <button
        className={`uiBtnDangerOutline ${styles.logoutBtn}`}
        onClick={handleLogoutConfirm}
        title="登出帳號"
      >
        <LogOut size={16} />
        <span>登出</span>
      </button>
    </div>
  );
};
