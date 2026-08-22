import React from 'react';
import { User } from '../../types';
import { MessageSquareX } from 'lucide-react';
import styles from '../Sidebar.module.css';

interface StrangerListProps {
  incomingStrangerUsers: User[];
  activeChatUser: User | null;
  onSelectChat: (user: User) => void;
  unreadCounts: Record<number, number>;
  onContextMenu: (e: React.MouseEvent, user: User) => void;
}

export const StrangerList: React.FC<StrangerListProps> = ({
  incomingStrangerUsers,
  activeChatUser,
  onSelectChat,
  unreadCounts,
  onContextMenu,
}) => {
  if (incomingStrangerUsers.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        <MessageSquareX size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
        <div>目前沒有未回覆的陌生人訊息</div>
      </div>
    );
  }

  return (
    <div className={styles.userList}>
      {incomingStrangerUsers.map((stranger) => {
        const isSelected = activeChatUser?.id === stranger.id;
        const unread = unreadCounts[stranger.id] || 0;
        const displayName = stranger.display_name || stranger.account_id;
        const initial = displayName.charAt(0).toUpperCase();

        return (
          <div
            key={stranger.id}
            className={`${styles.userItem} ${isSelected ? styles.userItemActive : ''}`}
            onClick={() => onSelectChat(stranger)}
            onContextMenu={(e) => onContextMenu(e, stranger)}
          >
            <div className={`${styles.userAvatar} ${styles.strangerAvatar}`}>
              {initial}
            </div>

            <div className={styles.userInfo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.userName}>{displayName}</span>
                {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
              </div>
              <span className={`${styles.userStatus} ${styles.strangerChatTag}`}>@{stranger.account_id} (陌生人)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
