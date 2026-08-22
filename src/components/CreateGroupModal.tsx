// Context: CreateGroupModal 重構 - 支援成員頭像完整渲染與群組頭像設置裁切
import React, { useState, useRef, ChangeEvent } from 'react';
import { Users, Check, Camera, Loader2 } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient, getApiBase } from '../services/apiClient';
import { uploadToIPFS } from '../utils/ipfs';
import { Group } from '../types';
import { BaseModal } from './common/BaseModal';
import { Avatar } from './common/Avatar';
import { AvatarCropModal } from './common/AvatarCropModal';
import styles from './CreateGroupModal.module.css';

interface CreateGroupModalProps {
  token: string | null;
  notify?: (msg: string, type?: 'danger' | 'warning' | 'info' | 'success') => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ token, notify }) => {
  const { showCreateGroupModal, setShowCreateGroupModal } = useUIStore();
  const { friends, addGroup, setActiveGroup } = useChatStore();

  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupAvatarCid, setGroupAvatarCid] = useState('');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!showCreateGroupModal) return null;

  const toggleUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      notify?.('請選擇圖片格式檔案 (.jpg, .png, .webp 等)', 'warning');
      return;
    }

    setCropFile(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob, previewDataUrl: string) => {
    setAvatarPreviewUrl(previewDataUrl);
    setUploadingAvatar(true);
    try {
      const buffer = new Uint8Array(await croppedBlob.arrayBuffer());
      const cid = await uploadToIPFS(buffer, getApiBase());
      setGroupAvatarCid(cid);
      notify?.('群組頭像已就緒！', 'success');
    } catch (err: any) {
      console.error('上傳群組頭像失敗:', err);
      notify?.(err.message || '上傳頭像失敗', 'danger');
    } finally {
      setUploadingAvatar(false);
      setCropFile(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newGroup = await apiClient.post<Group>(
        '/groups',
        {
          name: groupName.trim(),
          member_ids: selectedUserIds,
        },
        token
      );

      // 若有設置群組頭像，接續更新
      if (groupAvatarCid && newGroup.id) {
        try {
          await apiClient.put(`/groups/${newGroup.id}/avatar`, { avatar: groupAvatarCid }, token);
          newGroup.avatar = groupAvatarCid;
        } catch (avatarErr) {
          console.warn('群組頭像同步失敗:', avatarErr);
        }
      }

      addGroup(newGroup);
      setActiveGroup(newGroup);
      setShowCreateGroupModal(false);
      setGroupName('');
      setSelectedUserIds([]);
      setGroupAvatarCid('');
      setAvatarPreviewUrl('');
      notify?.(`成功建立群組「${newGroup.name}」`, 'success');
    } catch (err: any) {
      notify?.(err.message || '建立群組失敗', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BaseModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        title="建立新群組"
        icon={<Users size={20} />}
        maxWidth="440px"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 群組頭像上傳 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: '50%',
                overflow: 'hidden',
                width: '56px',
                height: '56px',
                flexShrink: 0,
              }}
              title="點擊設定群組頭像"
            >
              <Avatar
                src={avatarPreviewUrl || groupAvatarCid}
                name={groupName || 'Group'}
                fallbackSeed={groupName || 'NewGroup'}
                size={56}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  opacity: uploadingAvatar ? 1 : 0.8,
                }}
              >
                {uploadingAvatar ? <Loader2 size={18} className="spin" /> : <Camera size={16} />}
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFileChange}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                群組頭像
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                點擊圖示可選取並即時裁切群組大頭貼
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              群組名稱 (選填，未填預設由成員名字組合)
            </label>
            <input
              type="text"
              className="uiInput"
              placeholder="例如：專案討論群..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              選擇初始群組成員 ({selectedUserIds.length} 人已選)
            </label>
            <div className={styles.memberSelectionList}>
              {friends.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  尚無好友可邀請，請先新增好友
                </div>
              ) : (
                friends.map((friend) => {
                  const isSelected = selectedUserIds.includes(friend.id);
                  const displayName = friend.display_name || `@${friend.account_id}`;
                  return (
                    <div
                      key={friend.id}
                      className={`${styles.memberItem} ${isSelected ? styles.selected : ''}`}
                      onClick={() => toggleUser(friend.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar
                          src={friend.avatar}
                          name={displayName}
                          fallbackSeed={friend.display_name || friend.account_id}
                          size={34}
                        />
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {displayName}
                        </span>
                      </div>
                      <div className={styles.checkCircle}>
                        {isSelected && <Check size={13} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="uiBtnSecondary"
              style={{ flex: 1 }}
              onClick={() => setShowCreateGroupModal(false)}
            >
              取消
            </button>
            <button
              type="submit"
              className="uiBtnPrimary"
              style={{ flex: 1 }}
              disabled={loading || uploadingAvatar}
            >
              {loading ? '建立中...' : '建立群組'}
            </button>
          </div>
        </form>
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

