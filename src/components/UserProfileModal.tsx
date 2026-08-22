// Context: [用戶名片系統] 個人資料彈窗，支援自己資料/簽名/頭像編輯與他人好友/待處理/訊息互動
import React, { useContext, useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { User } from '../types';
import { Avatar } from './common/Avatar';
import { 
  UserPlus, 
  UserMinus, 
  MessageSquare, 
  ShieldCheck, 
  AtSign, 
  Camera, 
  Clock, 
  Save, 
  Loader2, 
  Edit3 
} from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import { uploadToIPFS } from '../utils/ipfs';
import { apiClient, getApiBase } from '../services/apiClient';
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
  onFriendChange,
}) => {
  const { token, user: currentUser, updateUser, API_BASE } = useContext(AuthContext);
  const { setActiveChatUser, onlineUsers, pendingRequests } = useChatStore();
  const { notify } = useNotification();

  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));
  const isSelf = Boolean(currentUser && userProfile && currentUser.id === userProfile.id);

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [isPendingSent, setIsPendingSent] = useState<boolean>(false);

  // 編輯表單狀態
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [avatarCid, setAvatarCid] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (userProfile) {
      setEditDisplayName(userProfile.display_name || '');
      setEditBio(userProfile.bio || '');
      setAvatarCid(userProfile.avatar || '');

      // 檢查是否處於待處理好友狀態
      const hasPending = pendingRequests.some((p) => p.id === userProfile.id);
      setIsPendingSent(hasPending);
    }
  }, [userProfile, pendingRequests]);

  if (!userProfile) return null;

  // 上傳更換大頭貼
  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      notify({ message: '請選擇圖片格式檔案 (.jpg, .png, .webp 等)', type: 'warning' });
      return;
    }

    setUploadingAvatar(true);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const cid = await uploadToIPFS(buffer, API_BASE || getApiBase());
      setAvatarCid(cid);
      notify({ message: '大頭貼已上傳至 IPFS，點擊儲存即可生效！', type: 'success' });
    } catch (err: any) {
      console.error('上傳頭像失敗:', err);
      notify({ message: err.message || '上傳頭像失敗', type: 'danger' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // 儲存自己個人資料
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser) return;

    setLoading(true);
    try {
      const updatedUser = await apiClient.put<User>(
        '/users/profile',
        {
          account_id: currentUser.account_id,
          display_name: editDisplayName.trim(),
          bio: editBio.trim(),
          avatar: avatarCid,
        },
        token
      );

      updateUser(updatedUser);
      notify({ message: '個人資料已成功更新！', type: 'success' });
      onFriendChange();
      onClose();
    } catch (err: any) {
      notify({ message: err.message || '更新個人資料失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // 新增好友
  const handleAddFriend = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiClient.post('/friends/request', { account_id: userProfile.account_id }, token);
      setIsPendingSent(true);
      notify({ message: '好友邀請已成功送出！', type: 'success' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '發送好友邀請失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // 移除好友
  const handleRemoveFriend = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiClient.post(`/friends/reject/${userProfile.id}`, {}, token);
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
  const displayName = isSelf
    ? editDisplayName || currentUser?.account_id
    : userProfile.display_name || userProfile.account_id;

  return (
    <BaseModal
      isOpen={Boolean(userProfile)}
      onClose={onClose}
      title={isSelf ? '編輯個人資料' : '使用者名片'}
      maxWidth={isSelf ? '460px' : '420px'}
    >
      <div className={styles.profileWrapper}>
        {/* 頭像區域 */}
        {isSelf ? (
          <div
            className={styles.avatarUploadWrapper}
            onClick={() => fileInputRef.current?.click()}
            title="點擊更換大頭貼"
          >
            <Avatar
              src={avatarCid || userProfile.avatar}
              name={displayName}
              size={80}
            />
            <div className={styles.avatarUploadOverlay}>
              {uploadingAvatar ? (
                <Loader2 size={20} className="spin" />
              ) : (
                <>
                  <Camera size={18} />
                  <span>更換頭像</span>
                </>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFileChange}
            />
          </div>
        ) : (
          <Avatar
            src={userProfile.avatar}
            name={displayName}
            size={76}
            isOnline={isFriend ? online : undefined}
          />
        )}

        {/* 模式 A：自己的個人資料編輯 */}
        {isSelf ? (
          <form onSubmit={handleSaveProfile} className={styles.editForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>帳號 ID (唯一標識碼)</label>
              <input
                type="text"
                className="uiInput"
                value={`@${currentUser?.account_id}`}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>顯示名稱 (暱稱)</label>
              <input
                type="text"
                className="uiInput"
                placeholder="輸入您的顯示暱稱..."
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                maxLength={40}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>個性簽名 / 個人狀態 (Bio)</label>
              <textarea
                className="uiInput"
                placeholder="寫點什麼介紹自己吧..."
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                maxLength={160}
                style={{ resize: 'none' }}
              />
            </div>

            <div className={styles.infoBox}>
              <ShieldCheck size={18} className={styles.shieldIcon} />
              <span>您的資料由 Web3 去中心化與端到端加密協議嚴格保護</span>
            </div>

            <div className={styles.actionGroup}>
              <button
                type="button"
                className={`uiBtnSecondary ${styles.flexBtn}`}
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="submit"
                className={`uiBtnPrimary ${styles.flexBtn}`}
                disabled={loading || uploadingAvatar}
              >
                {loading ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                <span>儲存修改</span>
              </button>
            </div>
          </form>
        ) : (
          /* 模式 B：他人的個人名片 */
          <>
            <h4 className={styles.profileName}>{displayName}</h4>
            <div className={styles.profileTag}>
              <AtSign size={14} />
              <span>{userProfile.account_id}</span>
            </div>

            <div className={styles.badgeGroup}>
              <span className={`${styles.statusBadge} ${isFriend ? styles.isFriend : ''}`}>
                {isFriend ? '好友' : '非好友'}
              </span>
              {isFriend && (
                <span className={`${styles.statusBadge} ${online ? styles.online : ''}`}>
                  {online ? '在線上' : '離線'}
                </span>
              )}
            </div>

            {/* 個性簽名展示 */}
            <div className={styles.bioCard}>
              {userProfile.bio ? (
                userProfile.bio
              ) : (
                <span className={styles.bioCardEmpty}>這個人很神秘，還沒有填寫個性簽名。</span>
              )}
            </div>

            <div className={styles.infoBox}>
              <ShieldCheck size={18} className={styles.shieldIcon} />
              <span>全程端對端加密保護對話隱私與金鑰安全</span>
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
              ) : isPendingSent ? (
                <button
                  className={`uiBtnSecondary ${styles.flexBtn}`}
                  disabled
                  style={{ opacity: 0.75, cursor: 'not-allowed' }}
                >
                  <Clock size={16} />
                  <span>邀請處理中</span>
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
                <span>{isFriend ? '發送訊息' : '發送陌生訊息'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
};

