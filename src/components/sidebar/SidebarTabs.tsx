import React from 'react';
import { MessageSquare, Users, MessageCircle, Search } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import styles from '../Sidebar.module.css';

interface SidebarTabsProps {
  currentTab: 'chats' | 'groups' | 'strangers';
  setCurrentTab: (tab: 'chats' | 'groups' | 'strangers') => void;
  incomingStrangerCount: number;
  onOpenSearchModal: () => void;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  currentTab,
  setCurrentTab,
  incomingStrangerCount,
  onOpenSearchModal,
}) => {
  const groupUnreadCounts = useChatStore((state) => state.groupUnreadCounts);
  const totalGroupUnreads = Object.values(groupUnreadCounts).reduce((acc, cur) => acc + cur, 0);

  return (
    <>
      <div className={styles.sidebarNavTabs}>
        <button
          className={`${styles.navTab} ${currentTab === 'chats' ? styles.navTabActive : ''}`}
          onClick={() => setCurrentTab('chats')}
        >
          <MessageSquare size={16} />
          <span>好友</span>
        </button>

        <button
          className={`${styles.navTab} ${currentTab === 'groups' ? styles.navTabActive : ''}`}
          onClick={() => setCurrentTab('groups')}
        >
          <Users size={16} />
          <span>群組</span>
          {totalGroupUnreads > 0 && (
            <span className={styles.unreadBadge}>{totalGroupUnreads}</span>
          )}
        </button>

        <button
          className={`${styles.navTab} ${currentTab === 'strangers' ? styles.navTabActive : ''}`}
          onClick={() => setCurrentTab('strangers')}
        >
          <MessageCircle size={16} />
          <span>陌生訊息</span>
          {incomingStrangerCount > 0 && (
            <span className={styles.unreadBadge}>{incomingStrangerCount}</span>
          )}
        </button>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          type="button"
          className={styles.searchNavButton}
          onClick={onOpenSearchModal}
          title="搜尋使用者或好友 ID"
        >
          <Search size={16} className={styles.searchIcon} />
          <span>搜尋使用者 / 好友 ID</span>
        </button>
      </div>
    </>
  );
};
