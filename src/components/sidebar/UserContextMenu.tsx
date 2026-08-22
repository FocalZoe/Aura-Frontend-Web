import React from 'react';
import { User, Group } from '../../types';
import { User as UserIcon, UserPlus, UserMinus, ShieldAlert, Trash2, Users, LogOut } from 'lucide-react';
import styles from '../Sidebar.module.css';

interface UserContextMenuProps {
  contextMenu: { x: number; y: number; targetUser?: User; targetGroup?: Group } | null;
  onViewProfile?: (user: User) => void;
  onSendFriendRequest?: (accountID: string) => void;
  onConfirmDeleteFriend?: (user: User) => void;
  onConfirmBlockUser?: (user: User) => void;
  onConfirmRemoveChatroom?: (id: number, isGroup?: boolean) => void;
  onViewGroupMembers?: (group: Group) => void;
  onConfirmLeaveGroup?: (group: Group) => void;
  onConfirmDeleteGroup?: (group: Group) => void;
  isFriend?: boolean;
  currentUserId?: number;
}

export const UserContextMenu: React.FC<UserContextMenuProps> = ({
  contextMenu,
  onViewProfile,
  onSendFriendRequest,
  onConfirmDeleteFriend,
  onConfirmBlockUser,
  onConfirmRemoveChatroom,
  onViewGroupMembers,
  onConfirmLeaveGroup,
  onConfirmDeleteGroup,
  isFriend = false,
  currentUserId,
}) => {
  if (!contextMenu) return null;

  const targetUser = contextMenu.targetUser;
  const targetGroup = contextMenu.targetGroup;

  return (
    <div
      className={styles.contextMenu}
      style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {targetUser && (
        <>
          {onViewProfile && (
            <button className={styles.contextMenuItem} onClick={() => onViewProfile(targetUser)}>
              <UserIcon size={16} />
              <span>檢視個人資料</span>
            </button>
          )}

          {!isFriend && onSendFriendRequest && (
            <button className={styles.contextMenuItem} onClick={() => onSendFriendRequest(targetUser.account_id)}>
              <UserPlus size={16} />
              <span>加為好友</span>
            </button>
          )}

          {isFriend && onConfirmDeleteFriend && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmDeleteFriend(targetUser)}>
              <UserMinus size={16} />
              <span>刪除好友</span>
            </button>
          )}

          {onConfirmBlockUser && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmBlockUser(targetUser)}>
              <ShieldAlert size={16} />
              <span>封鎖使用者</span>
            </button>
          )}

          {onConfirmRemoveChatroom && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmRemoveChatroom(targetUser.id, false)}>
              <Trash2 size={16} />
              <span>移除聊天室</span>
            </button>
          )}
        </>
      )}

      {targetGroup && (
        <>
          {onViewGroupMembers && (
            <button className={styles.contextMenuItem} onClick={() => onViewGroupMembers(targetGroup)}>
              <Users size={16} />
              <span>檢視群組成員</span>
            </button>
          )}

          {currentUserId !== targetGroup.owner_id && onConfirmLeaveGroup && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmLeaveGroup(targetGroup)}>
              <LogOut size={16} />
              <span>退出群組</span>
            </button>
          )}

          {currentUserId === targetGroup.owner_id && onConfirmDeleteGroup && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmDeleteGroup(targetGroup)}>
              <Trash2 size={16} />
              <span>解散群組</span>
            </button>
          )}

          {onConfirmRemoveChatroom && (
            <button className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`} onClick={() => onConfirmRemoveChatroom(targetGroup.id, true)}>
              <Trash2 size={16} />
              <span>移除聊天室</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
