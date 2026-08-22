// Context: GroupMembersModal 重構 - 支援群組頭像裁切修改、群內專屬暱稱設置與成員名片聯動
import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Users, UserMinus, LogOut, Trash2, UserPlus, ChevronDown, Camera, Loader2, Save } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient, getApiBase } from '../services/apiClient';
import { uploadToIPFS } from '../utils/ipfs';
import { Group, User } from '../types';
import { BaseModal } from './common/BaseModal';
import { Avatar } from './common/Avatar';
import { AvatarCropModal } from './common/AvatarCropModal';
import styles from './GroupMembersModal.module.css';

interface GroupMembersModalProps {
  currentUserId: number;
  token: string | null;
  notify?: (options: any, type?: any) => void;
  onViewProfile?: (user: User) => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ currentUserId, token, notify, onViewProfile }) => {
  const { showGroupMembersModal, setShowGroupMembersModal, showConfirmModal } = useUIStore();
  const { activeGroup, setActiveGroup, friends, updateGroupInStore, removeGroup, setGroups } = useChatStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // 群內專屬暱稱狀態
  const [myNickname, setMyNickname] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  // 群組頭像裁切狀態
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (activeGroup && currentUserId) {
      const myMember = (activeGroup.members || []).find((m) => m.user_id === currentUserId);
      setMyNickname(myMember?.nickname || '');
    }
  }, [activeGroup, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!showGroupMembersModal || !activeGroup) return null;

  const activeGroupForModal = activeGroup;
  const isOwner = currentUserId === activeGroupForModal.owner_id;

  const existingMemberUserIds = (activeGroupForModal.members || []).map((m) => m.user_id);
  const availableFriends = friends.filter((f) => !existingMemberUserIds.includes(f.id));
  const selectedFriend = availableFriends.find((f) => f.id === selectedFriendId);

  // 頭像更換流程
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

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!token) return;
    setUploadingAvatar(true);
    try {
      const buffer = new Uint8Array(await croppedBlob.arrayBuffer());
      const cid = await uploadToIPFS(buffer, getApiBase());
      await apiClient.put(`/groups/${activeGroupForModal.id}/avatar`, { avatar: cid }, token);

      const [updatedGroup, updatedGroupsList] = await Promise.all([
        apiClient.get<Group>(`/groups/${activeGroupForModal.id}`, token),
        apiClient.get<Group[]>('/groups', token),
      ]);
      setGroups(updatedGroupsList);
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      notify?.('群組頭像已更新成功！', 'success');
    } catch (err: any) {
      console.error('更新群組頭像失敗:', err);
      notify?.(err.message || '更新群組頭像失敗', 'danger');
    } finally {
      setUploadingAvatar(false);
      setCropFile(null);
    }
  };

  // 儲存群內專屬暱稱
  const handleSaveNickname = async () => {
    if (!token) return;
    setSavingNickname(true);
    try {
      await apiClient.put(
        `/groups/${activeGroupForModal.id}/nickname`,
        { nickname: myNickname.trim() },
        token
      );
      const [updatedGroup, updatedGroupsList] = await Promise.all([
        apiClient.get<Group>(`/groups/${activeGroupForModal.id}`, token),
        apiClient.get<Group[]>('/groups', token),
      ]);
      setGroups(updatedGroupsList);
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      notify?.('群內專屬暱稱已更新！', 'success');
    } catch (err: any) {
      notify?.(err.message || '更新群內暱稱失敗', 'danger');
    } finally {
      setSavingNickname(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedFriendId || !token) return;
    try {
      await apiClient.post(
        `/groups/${activeGroupForModal.id}/members`,
        { user_id: selectedFriendId },
        token
      );
      const [updatedGroup, updatedGroupsList] = await Promise.all([
        apiClient.get<Group>(`/groups/${activeGroupForModal.id}`, token),
        apiClient.get<Group[]>('/groups', token),
      ]);
      setGroups(updatedGroupsList);
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      setSelectedFriendId(null);
      setShowAddSection(false);
      setIsSelectOpen(false);
      notify?.('成功新增成員至群組', 'success');
    } catch (err: any) {
      notify?.(err.message || '新增成員失敗', 'danger');
    }
  };

  const handleRemoveMemberConfirm = (memberUserId: number, memberName: string) => {
    showConfirmModal({
      title: '移除成員確認',
      message: `確定要將「${memberName}」移出群組嗎？`,
      danger: true,
      confirmText: '確定移除',
      onConfirm: () => handleRemoveMember(memberUserId, memberName),
    });
  };

  const handleRemoveMember = async (memberUserId: number, memberName: string) => {
    if (!token) return;
    try {
      await apiClient.delete(`/groups/${activeGroupForModal.id}/members/${memberUserId}`, token);
      const [updatedGroup, updatedGroupsList] = await Promise.all([
        apiClient.get<Group>(`/groups/${activeGroupForModal.id}`, token),
        apiClient.get<Group[]>('/groups', token),
      ]);
      setGroups(updatedGroupsList);
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      notify?.(`已將「${memberName}」移出群組`, 'info');
    } catch (err: any) {
      notify?.(err.message || '移除成員失敗', 'danger');
    }
  };

  const handleLeaveGroupConfirm = () => {
    showConfirmModal({
      title: '退出群組確認',
      message: `確定要退出「${activeGroupForModal.name}」群組嗎？`,
      danger: true,
      confirmText: '確定退出',
      onConfirm: handleLeaveGroup,
    });
  };

  const handleLeaveGroup = async () => {
    if (!token) return;
    try {
      await apiClient.post(`/groups/${activeGroupForModal.id}/leave`, {}, token);
      const updatedGroupsList = await apiClient.get<Group[]>('/groups', token);
      setGroups(updatedGroupsList);
      removeGroup(activeGroupForModal.id);
      setActiveGroup(null);
      setShowGroupMembersModal(false);
      notify?.('已退出群組', 'info');
    } catch (err: any) {
      notify?.(err.message || '退出群組失敗', 'danger');
    }
  };

  const handleDeleteGroupConfirm = () => {
    showConfirmModal({
      title: '解散群組確認',
      message: `確定要解散「${activeGroupForModal.name}」群組嗎？所有成員將無法繼續在此群組發送訊息。`,
      danger: true,
      confirmText: '確定解散',
      onConfirm: handleDeleteGroup,
    });
  };

  const handleDeleteGroup = async () => {
    if (!token) return;
    try {
      await apiClient.delete(`/groups/${activeGroupForModal.id}`, token);
      const updatedGroupsList = await apiClient.get<Group[]>('/groups', token);
      setGroups(updatedGroupsList);
      removeGroup(activeGroupForModal.id);
      setActiveGroup(null);
      setShowGroupMembersModal(false);
      notify?.('已成功解散群組', 'info');
    } catch (err: any) {
      notify?.(err.message || '解散群組失敗', 'danger');
    }
  };

  return (
    <>
      <BaseModal
        isOpen={showGroupMembersModal}
        onClose={() => setShowGroupMembersModal(false)}
        title="群組詳情與成員管理"
        icon={<Users size={20} />}
        maxWidth="480px"
      >
        {/* 群組資訊頂部區塊 (頭像 + 名稱) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'relative',
              cursor: 'pointer',
              borderRadius: '50%',
              overflow: 'hidden',
              width: '64px',
              height: '64px',
              flexShrink: 0,
            }}
            title="點擊更換群組頭像"
          >
            <Avatar
              src={activeGroupForModal.avatar}
              name={activeGroupForModal.name}
              fallbackSeed={activeGroupForModal.name}
              size={64}
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
                opacity: uploadingAvatar ? 1 : 0.75,
              }}
            >
              {uploadingAvatar ? <Loader2 size={20} className="spin" /> : <Camera size={18} />}
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarFileChange}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {activeGroupForModal.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {activeGroupForModal.members?.length || 0} 位成員 • {isOwner ? '您是群主' : '一般成員'}
            </span>
          </div>
        </div>

        {/* 群內專屬暱稱設定區塊 */}
        <div style={{ margin: '14px 0', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            我在本群的專屬暱稱 (僅限本群成員可見)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="uiInput"
              placeholder="自訂在群內的顯示名稱..."
              value={myNickname}
              onChange={(e) => setMyNickname(e.target.value)}
              maxLength={30}
              style={{ flex: 1, height: '36px', fontSize: '0.86rem' }}
            />
            <button
              type="button"
              className="uiBtnPrimary"
              onClick={handleSaveNickname}
              disabled={savingNickname}
              style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            >
              {savingNickname ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              <span>設定</span>
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              群組成員 ({activeGroupForModal.members?.length || 0} 人)
            </span>
            {isOwner && (
              <button className={styles.inviteBtn} onClick={() => setShowAddSection(!showAddSection)}>
                <UserPlus size={14} />
                <span>邀請成員</span>
              </button>
            )}
          </div>

          {showAddSection && isOwner && (
            <div className={styles.addMemberBox} ref={dropdownRef}>
              <div
                className={styles.customSelectTrigger}
                onClick={() => setIsSelectOpen(!isSelectOpen)}
              >
                {selectedFriend ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Avatar
                      src={selectedFriend.avatar}
                      name={selectedFriend.display_name || selectedFriend.account_id}
                      fallbackSeed={selectedFriend.display_name || selectedFriend.account_id}
                      size={24}
                    />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {selectedFriend.display_name || selectedFriend.account_id} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>(@{selectedFriend.account_id})</span>
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    選擇要邀請的好友...
                  </span>
                )}
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--text-secondary)',
                    transform: isSelectOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0,
                  }}
                />
              </div>

              {isSelectOpen && (
                <div className={styles.customSelectMenu}>
                  {availableFriends.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      無可邀請的好友
                    </div>
                  ) : (
                    availableFriends.map((f) => (
                      <div
                        key={f.id}
                        className={`${styles.customSelectOption} ${selectedFriendId === f.id ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setSelectedFriendId(f.id);
                          setIsSelectOpen(false);
                        }}
                      >
                        <Avatar
                          src={f.avatar}
                          name={f.display_name || f.account_id}
                          fallbackSeed={f.display_name || f.account_id}
                          size={28}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {f.display_name || f.account_id}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            @{f.account_id}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                className="uiBtnPrimary"
                onClick={handleAddMember}
                disabled={!selectedFriendId}
                style={{ height: '42px', padding: '0 16px', whiteSpace: 'nowrap' }}
              >
                加入
              </button>
            </div>
          )}

          <div className={styles.memberList}>
            {(activeGroupForModal.members || []).map((m) => {
              const u = m.user;
              const globalName = u?.display_name || u?.account_id || `User #${m.user_id}`;
              const displayName = m.nickname ? `${m.nickname} (${globalName})` : globalName;
              const isGroupOwner = m.role === 'owner' || m.user_id === activeGroupForModal.owner_id;

              return (
                <div key={m.id} className={styles.memberItem}>
                  <div className={styles.memberUser}>
                    <Avatar
                      src={u?.avatar}
                      name={globalName}
                      fallbackSeed={u?.display_name || u?.account_id}
                      size={36}
                      onClick={() => {
                        if (u && onViewProfile) {
                          onViewProfile(u);
                        }
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {m.nickname || globalName}{' '}
                        {isGroupOwner && (
                          <span className={styles.ownerBadge}>
                            群主
                          </span>
                        )}
                      </span>
                      {m.nickname && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          原名: {globalName}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOwner && !isGroupOwner && (
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveMemberConfirm(m.user_id, globalName)}
                      title="移出群組"
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          {!isOwner ? (
            <button className="uiBtnDanger" onClick={handleLeaveGroupConfirm} style={{ width: '100%' }}>
              <LogOut size={16} style={{ marginRight: '6px' }} />
              退出群組
            </button>
          ) : (
            <button className="uiBtnDanger" onClick={handleDeleteGroupConfirm} style={{ width: '100%' }}>
              <Trash2 size={16} style={{ marginRight: '6px' }} />
              解散群組
            </button>
          )}
        </div>
      </BaseModal>

      {/* 獨立群組頭像裁切彈窗 */}
      <AvatarCropModal
        isOpen={Boolean(cropFile)}
        imageFile={cropFile}
        onClose={() => setCropFile(null)}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};

