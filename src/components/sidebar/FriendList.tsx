import React from 'react';
import { User, Group } from '../../types';
import { Users } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useChatStore } from '../../stores/useChatStore';
import styles from '../Sidebar.module.css';

interface FriendListProps {
  currentTab: 'chats' | 'groups' | 'strangers';
  chatUsers: User[];
  groups: Group[];
  friends: User[];
  activeChatUser: User | null;
  activeGroup: Group | null;
  onSelectChat: (user: User) => void;
  onSelectGroup: (group: Group) => void;
  onContextMenuUser: (e: React.MouseEvent, user: User) => void;
  onContextMenuGroup: (e: React.MouseEvent, group: Group) => void;
  isUserOnline: (userId: number) => boolean;
  unreadCounts: Record<number, number>;
  onViewProfile?: (user: User) => void;
}

export const FriendList: React.FC<FriendListProps> = ({
  currentTab,
  chatUsers,
  groups,
  friends,
  activeChatUser,
  activeGroup,
  onSelectChat,
  onSelectGroup,
  onContextMenuUser,
  onContextMenuGroup,
  isUserOnline,
  unreadCounts,
  onViewProfile,
}) => {
  const friendIds = new Set(friends.map((f) => f.id));

  if (currentTab === 'groups') {
    if (groups.length === 0) {
      return (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          尚無加入的群組，點擊底部的群組圖示建立新群組！
        </div>
      );
    }

    return (
      <div className={styles.userList}>
        {groups.map((group) => {
          const isSelected = activeGroup?.id === group.id;
          const memberCount = group.members?.length || 0;
          const groupUnread = useChatStore.getState().groupUnreadCounts[group.id] || 0;

          return (
            <div
              key={`group_${group.id}`}
              className={`${styles.userItem} ${isSelected ? styles.userItemActive : ''}`}
              onClick={() => onSelectGroup(group)}
              onContextMenu={(e) => onContextMenuGroup(e, group)}
            >
              <div
                className={styles.userAvatar}
                style={{
                  background: 'var(--accent-color, #6366f1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} />
              </div>

              <div className={styles.userInfo}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={styles.userName}>{group.name}</span>
                  {groupUnread > 0 && <span className={styles.unreadBadge}>{groupUnread}</span>}
                </div>
                <span className={styles.userStatus} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {memberCount} 位成員
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (chatUsers.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        尚無單聊對話，點擊上方的搜尋按鈕開始聊天吧！
      </div>
    );
  }

  return (
    <div className={styles.userList}>
      {chatUsers.map((item) => {
        const isSelected = activeChatUser?.id === item.id;
        const isFriend = friendIds.has(item.id);
        const online = isUserOnline(item.id);
        const unread = unreadCounts[item.id] || 0;
        const displayName = item.display_name || item.account_id;

        return (
          <div
            key={`user_${item.id}`}
            className={`${styles.userItem} ${isSelected ? styles.userItemActive : ''}`}
            onClick={() => onSelectChat(item)}
            onContextMenu={(e) => onContextMenuUser(e, item)}
          >
            <Avatar
              src={item.avatar}
              name={displayName}
              size={40}
              isOnline={isFriend ? online : undefined}
              onClick={(e) => {
                if (onViewProfile) {
                  e.stopPropagation();
                  onViewProfile(item);
                }
              }}
            />

            <div className={styles.userInfo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.userName}>{displayName}</span>
                {unread > 0 && <span className={styles.unreadBadge}>{unread}</span>}
              </div>
              <span className={`${styles.userStatus} ${!isFriend ? styles.strangerChatTag : ''}`}>
                @{item.account_id} {!isFriend ? '(陌生人)' : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
