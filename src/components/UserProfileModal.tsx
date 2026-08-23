// Context: [用戶名片系統] 支援使用者名片/媒體庫 Tabs、點擊名字就地改備註暱稱、用戶ID限制與個人名片化風格
import React, { useContext, useState, useEffect, useRef, FormEvent, ChangeEvent, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { User } from '../types';
import { Avatar } from './common/Avatar';
import { AvatarCropModal } from './common/AvatarCropModal';
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
  Image as ImageIcon,
  FileText,
  User as UserIcon,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import { uploadToIPFS, getIPFSGatewayUrl } from '../utils/ipfs';
import { apiClient, getApiBase } from '../services/apiClient';
import { MediaGalleryCard } from './chat/MediaGalleryCard';
import styles from './UserProfileModal.module.css';

interface UserProfileModalProps {
  userProfile: User | null;
  source?: 'chat_header' | 'default';
  onClose: () => void;
  isFriend: boolean;
  onFriendChange: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userProfile,
  source = 'default',
  onClose,
  isFriend,
  onFriendChange,
}) => {
  const { token, user: currentUser, updateUser, API_BASE } = useContext(AuthContext);
  const { setActiveChatUser, onlineUsers, pendingRequests, messages, setUserAlias } = useChatStore();
  const { notify } = useNotification();

  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));
  const isSelf = Boolean(currentUser && userProfile && currentUser.id === userProfile.id);

  const [activeTab, setActiveTab] = useState<'profile' | 'media'>('profile');
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [isPendingSent, setIsPendingSent] = useState<boolean>(false);

  // 僅在聊天室頂部開啟時才呈現 Tab 分頁
  const showTabs = !isSelf && source === 'chat_header';

  // 標題判定：自己為編輯個人資料；頂部開啟為對話詳情；其餘為使用者名片
  const modalTitle = isSelf
    ? '編輯個人資料'
    : source === 'chat_header'
    ? '對話詳情'
    : '使用者名片';

  // 自己編輯表單狀態
  const [editAccountID, setEditAccountID] = useState<string>('');
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [avatarCid, setAvatarCid] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // 裁切彈窗狀態
  const [cropFile, setCropFile] = useState<File | null>(null);

  // 好友備註暱稱就地編輯狀態
  const [isEditingAlias, setIsEditingAlias] = useState<boolean>(false);
  const [customAlias, setCustomAlias] = useState<string>('');
  const [savingAlias, setSavingAlias] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (userProfile) {
      setEditAccountID(userProfile.account_id || '');
      setEditDisplayName(userProfile.display_name || '');
      setEditBio(userProfile.bio || '');
      setAvatarCid(userProfile.avatar || '');
      setPreviewUrl('');
      setCropFile(null);
      setIsEditingAlias(false);

      const hasPending = pendingRequests.some((p) => p.id === userProfile.id);
      setIsPendingSent(hasPending);

      if (!isSelf) {
        const existing = useChatStore.getState().userAliases[userProfile.id] || '';
        setCustomAlias(existing);
      }
    }
  }, [userProfile, pendingRequests, isSelf]);

  // 聚合雙方對話中的所有媒體與檔案
  const conversationMediaFiles = useMemo(() => {
    if (!userProfile || isSelf) return [];
    return messages
      .filter((m) => {
        const isRelated =
          (m.sender_id === userProfile.id && m.receiver_id === currentUser?.id) ||
          (m.sender_id === currentUser?.id && m.receiver_id === userProfile.id);
        return isRelated && m.filePayload;
      })
      .map((m) => ({
        msgId: m.id,
        timestamp: m.timestamp,
        payload: m.filePayload!,
      }));
  }, [messages, userProfile, currentUser, isSelf]);

  // 選擇頭像檔案
  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      notify({ message: '請選擇圖片格式檔案 (.jpg, .png, .webp 等)', type: 'warning' });
      return;
    }

    setCropFile(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob, previewDataUrl: string) => {
    setPreviewUrl(previewDataUrl);
    setUploadingAvatar(true);
    try {
      const buffer = new Uint8Array(await croppedBlob.arrayBuffer());
      const cid = await uploadToIPFS(buffer, API_BASE || getApiBase());
      setAvatarCid(cid);
      notify({ message: '大頭貼已更新完成，點擊儲存即可生效！', type: 'success' });
    } catch (err: any) {
      console.error('上傳頭像失敗:', err);
      notify({ message: err.message || '更新頭像失敗', type: 'danger' });
    } finally {
      setUploadingAvatar(false);
      setCropFile(null);
    }
  };

  // 儲存自己個人資料 (包含 account_id 正則驗證)
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser) return;

    const trimmedAccountID = editAccountID.trim();
    const accountIDRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!accountIDRegex.test(trimmedAccountID)) {
      notify({ message: '用戶 ID 僅允許英文大小寫字母、數字、下底線 _ 與點號 .（3~30 字元）', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.put<any>(
        '/users/profile',
        {
          account_id: trimmedAccountID,
          display_name: editDisplayName.trim(),
          bio: editBio.trim(),
          avatar: avatarCid,
        },
        token
      );

      const updatedUser = res?.user || res;
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

  // 儲存好友備註暱稱
  const handleSaveAlias = async () => {
    if (!token || !userProfile) return;
    setSavingAlias(true);
    try {
      const trimmed = customAlias.trim();
      await apiClient.put(`/friends/${userProfile.id}/alias`, { alias: trimmed }, token);
      setUserAlias(userProfile.id, trimmed);
      setIsEditingAlias(false);
      notify({ message: trimmed ? '已更新好友備註暱稱！' : '已清除好友備註暱稱', type: 'success' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '更新備註暱稱失敗', type: 'danger' });
    } finally {
      setSavingAlias(false);
    }
  };

  const handleAddFriend = async () => {
    if (!token || !userProfile) return;
    setLoading(true);
    try {
      await apiClient.post('/friends/request', { target_user_id: userProfile.id }, token);
      setIsPendingSent(true);
      notify({ message: '好友邀請已送出！', type: 'success' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '發送好友邀請失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!token || !userProfile) return;
    setLoading(true);
    try {
      await apiClient.delete(`/friends/${userProfile.id}`, token);
      notify({ message: `已將 ${userProfile.display_name || userProfile.account_id} 從好友名單移除`, type: 'info' });
      onFriendChange();
      onClose();
    } catch (err: any) {
      notify({ message: err.message || '移除好友失敗', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!userProfile) return;
    setActiveChatUser(userProfile);
    onClose();
  };

  if (!userProfile) return null;

  const online = isUserOnline(userProfile.id);
  const effectiveDisplayName = isSelf
    ? currentUser?.display_name || currentUser?.account_id
    : customAlias || userProfile.display_name || userProfile.account_id;

  return (
    <>
      <BaseModal
        isOpen={Boolean(userProfile)}
        onClose={onClose}
        title={modalTitle}
        maxWidth="460px"
      >
        {/* TAB 分頁切換 (僅在聊天室頂部開啟時提供名片與媒體庫切換) */}
        {showTabs && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <button
              type="button"
              className={`uiBtnSecondary ${activeTab === 'profile' ? 'uiBtnPrimary' : ''}`}
              onClick={() => setActiveTab('profile')}
              style={{ flex: 1, height: '36px', fontSize: '0.86rem' }}
            >
              <UserIcon size={16} />
              <span>個人資料</span>
            </button>
            <button
              type="button"
              className={`uiBtnSecondary ${activeTab === 'media' ? 'uiBtnPrimary' : ''}`}
              onClick={() => setActiveTab('media')}
              style={{ flex: 1, height: '36px', fontSize: '0.86rem' }}
            >
              <ImageIcon size={16} />
              <span>媒體與檔案 ({conversationMediaFiles.length})</span>
            </button>
          </div>
        )}

        {/* Tab 1 (或一般模式): 使用者名片 / 編輯個人資料 */}
        {(!showTabs || activeTab === 'profile') && (
          <div className={styles.profileContainer}>
            {/* 名片頂部頭像區塊 */}
            {isSelf ? (
              <div
                className={styles.avatarEditWrapper}
                onClick={() => fileInputRef.current?.click()}
                title="點擊更換大頭貼 (支援即時裁切)"
              >
                <Avatar
                  src={previewUrl || avatarCid || currentUser?.avatar}
                  name={editDisplayName || currentUser?.account_id || ''}
                  fallbackSeed={currentUser?.account_id}
                  size={86}
                />
                {/* 懸停暗黑遮罩 */}
                <div className={styles.avatarHoverOverlay}>
                  {uploadingAvatar ? <Loader2 size={24} className="spin" /> : <Camera size={24} />}
                </div>
                {/* 右下角相機按鈕徽章 */}
                <div className={styles.cameraBadge}>
                  <Camera size={14} />
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
              <div className={styles.avatarDisplayWrapper}>
                <Avatar
                  src={userProfile.avatar}
                  name={effectiveDisplayName}
                  fallbackSeed={userProfile.display_name || userProfile.account_id}
                  size={86}
                  isOnline={isFriend ? online : undefined}
                />
              </div>
            )}

            {/* 模式 A：自己的個人資料編輯 */}
            {isSelf ? (
              <form onSubmit={handleSaveProfile} className={styles.editForm}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>用戶 ID (英文大小寫、數字、_ 與 .)</label>
                  <input
                    type="text"
                    className="uiInput"
                    placeholder="輸入用戶 ID..."
                    value={editAccountID}
                    onChange={(e) => setEditAccountID(e.target.value)}
                    maxLength={30}
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
                  <span>個人資料受到端到端架構隱私保護</span>
                </div>

                <div className={styles.actionGroup}>
                  <button type="button" className={`uiBtnSecondary ${styles.flexBtn}`} onClick={onClose}>
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
                {/* 點擊名字就地編輯備註 */}
                {isEditingAlias ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', width: '100%' }}>
                    <input
                      type="text"
                      className="uiInput"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                      placeholder="設定好友備註暱稱..."
                      autoFocus
                      style={{ height: '36px', maxWidth: '240px' }}
                    />
                    <button
                      type="button"
                      className="uiBtnPrimary"
                      onClick={handleSaveAlias}
                      disabled={savingAlias}
                      style={{ height: '36px', padding: '0 12px' }}
                    >
                      {savingAlias ? <Loader2 size={14} className="spin" /> : <Check size={16} />}
                    </button>
                    <button
                      type="button"
                      className="uiBtnSecondary"
                      onClick={() => setIsEditingAlias(false)}
                      style={{ height: '36px', padding: '0 10px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={styles.nameRow}
                    onClick={() => setIsEditingAlias(true)}
                    title="點擊修改好友備註暱稱"
                  >
                    <h4 className={styles.profileName}>{effectiveDisplayName}</h4>
                    <Edit3 size={14} color="var(--text-muted)" />
                  </div>
                )}

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
                  <span>私人專屬通訊，守護您的每一則對話隱私</span>
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

                  <button className={`uiBtnSecondary ${styles.flexBtn}`} onClick={handleStartChat}>
                    <MessageSquare size={16} />
                    <span>{isFriend ? '發送訊息' : '發送陌生訊息'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: 媒體與檔案庫 (僅在頂部開啟的對話詳情模式下可見) */}
        {showTabs && activeTab === 'media' && (
          <div style={{ minHeight: '180px', maxHeight: '320px', overflowY: 'auto' }}>
            {conversationMediaFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                雙方對話中尚無傳送過之媒體或檔案
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '4px' }}>
                {conversationMediaFiles.map((item, i) => (
                  <MediaGalleryCard
                    key={i}
                    payload={item.payload}
                    partnerId={userProfile?.id}
                    currentUserId={currentUser?.id || 0}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </BaseModal>

      {/* 獨立頭像裁切彈窗 */}
      <AvatarCropModal
        isOpen={Boolean(cropFile)}
        imageFile={cropFile}
        onClose={() => setCropFile(null)}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};
