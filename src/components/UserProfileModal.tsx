// Context: [用戶名片] 個人名片彈窗，支援好友關係操作與發起對話
import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { User } from '../types';
import { UserPlus, UserMinus, MessageSquare, ShieldCheck, AtSign } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './UserProfileModal.module.css';

interface UserProfileModalProps {
  userProfile: User | null;
  onClose: () => void;
  isFriend: boolean;
  onFriendChange: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userProfile,
  onClose,
  isFriend,
  onFriendChange
}) => {
  const { token, API_BASE } = useContext(AuthContext);
  const { setActiveChatUser, onlineUsers } = useChatStore();
  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));
  const { notify } = useNotification();

  const [loading, setLoading] = useState<boolean>(false);

  if (!userProfile) return null;

  const handleAddFriend = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_id: userProfile.account_id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '發送好友邀請失敗');
      }
      notify({ message: '好友邀請已成功發送', type: 'success' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '發送好友邀請失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/friends/reject/${userProfile.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '移除好友失敗');
      }
      notify({ message: '已將該使用者從好友名單中移除', type: 'info' });
      onFriendChange();
      onClose();
    } catch (err: any) {
      notify({ message: err.message || '移除好友失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    setActiveChatUser(userProfile);
    onClose();
  };

  const online = isFriend && isUserOnline(userProfile.id);
  const displayName = userProfile.display_name || userProfile.account_id;

  return (
    <BaseModal
      isOpen={Boolean(userProfile)}
      onClose={onClose}
      title="使用者個人資料"
      maxWidth="420px"
    >
      <div className={styles.profileWrapper}>
        <div className={styles.avatarLarge}>
          {displayName.charAt(0).toUpperCase()}
        </div>

        <h4 className={styles.profileName}>
          {displayName}
        </h4>
        <div className={styles.profileTag}>
          <AtSign size={14} />
          <span>{userProfile.account_id}</span>
        </div>

        <div className={styles.badgeGroup}>
          <span className={`${styles.statusBadge} ${isFriend ? styles.isFriend : ''}`}>
            {isFriend ? '好友' : '非好友 / 陌生人'}
          </span>
          {isFriend && (
            <span className={`${styles.statusBadge} ${online ? styles.online : ''}`}>
              {online ? '在線上' : '離線'}
            </span>
          )}
        </div>

        <div className={styles.infoBox}>
          <ShieldCheck size={18} className={styles.shieldIcon} />
          <span>全程端對端加密保護您的對話隱私與數據安全</span>
        </div>

        <div className={styles.actionGroup}>
          {isFriend ? (
            <button
              className={`uiBtnDanger ${styles.flexBtn}`}
              onClick={handleRemoveFriend}
              disabled={loading}
            >
              <UserMinus size={16} />
              <span>移除好友</span>
            </button>
          ) : (
            <button
              className={`uiBtnPrimary ${styles.flexBtn}`}
              onClick={handleAddFriend}
              disabled={loading}
            >
              <UserPlus size={16} />
              <span>新增好友</span>
            </button>
          )}

          <button
            className={`uiBtnSecondary ${styles.flexBtn}`}
            onClick={handleStartChat}
          >
            <MessageSquare size={16} />
            <span>發送訊息</span>
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
