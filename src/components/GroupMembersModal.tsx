// Context: GroupMembersModal 升級 - 支援成員名單/媒體庫 TAB、全體可改任何人群內暱稱、群組頭像裁切與成員名片聯動
import React, { useState, useRef, useEffect, ChangeEvent, useMemo } from 'react';
import { Users, UserMinus, LogOut, Trash2, UserPlus, ChevronDown, Camera, Loader2, Save, FileText, Image as ImageIcon, Film, Music, Download, Edit3, X, Check } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient, getApiBase } from '../services/apiClient';
import { uploadToIPFS, getIPFSGatewayUrl } from '../utils/ipfs';
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
  const { activeGroup, setActiveGroup, friends, updateGroupInStore, removeGroup, setGroups, groupMessages } = useChatStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'members' | 'media'>('members');
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // 就地修改成員群內暱稱狀態
  const [editingMemberUserId, setEditingMemberUserId] = useState<number | null>(null);
  const [tempNickname, setTempNickname] = useState('');
  const [savingNicknameId, setSavingNicknameId] = useState<number | null>(null);

  // 群組頭像裁切狀態
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 聚合本群所有傳送過的媒體與檔案
  const groupMediaFiles = useMemo(() => {
    if (!activeGroup) return [];
    return groupMessages
      .filter((gm) => gm.filePayload)
      .map((gm) => ({
        msgId: gm.id,
        sender: gm.sender,
        senderId: gm.sender_id,
        timestamp: gm.timestamp,
        payload: gm.filePayload!,
      }));
  }, [groupMessages, activeGroup]);

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

  // 儲存指定成員的群內專屬暱稱 (任何人皆可修改任何人)
  const handleSaveMemberNickname = async (targetUserId: number) => {
    if (!token) return;
    setSavingNicknameId(targetUserId);
    try {
      await apiClient.put(
        `/groups/${activeGroupForModal.id}/nickname`,
        { user_id: targetUserId, nickname: tempNickname.trim() },
        token
      );
      const [updatedGroup, updatedGroupsList] = await Promise.all([
        apiClient.get<Group>(`/groups/${activeGroupForModal.id}`, token),
        apiClient.get<Group[]>('/groups', token),
      ]);
      setGroups(updatedGroupsList);
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      setEditingMemberUserId(null);
      notify?.('成員群內暱稱已成功更新！', 'success');
    } catch (err: any) {
      notify?.(err.message || '更新暱稱失敗', 'danger');
    } finally {
      setSavingNicknameId(null);
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

      const updatedGroup = await apiClient.get<Group>(
        `/groups/${activeGroupForModal.id}`,
        token
      );
      updateGroupInStore(updatedGroup);
      setActiveGroup(updatedGroup);
      setSelectedFriendId(null);
      setShowAddSection(false);
      notify?.('已發送群組邀請給好友', 'success');
    } catch (err: any) {
      notify?.(err.message || '邀請成員失敗', 'danger');
    }
  };

  const handleRemoveMember = async (targetUserId: number, targetName: string) => {
    if (!token) return;
    showConfirmModal({
      title: '移出成員',
      message: `確定要將「${targetName}」從群組中移出嗎？`,
      confirmText: '確認移出',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(
            `/groups/${activeGroupForModal.id}/members/${targetUserId}`,
            token
          );
          const updatedGroup = await apiClient.get<Group>(
            `/groups/${activeGroupForModal.id}`,
            token
          );
          updateGroupInStore(updatedGroup);
          setActiveGroup(updatedGroup);
          notify?.(`已將「${targetName}」移出群組`, 'success');
        } catch (err: any) {
          notify?.(err.message || '移出成員失敗', 'danger');
        }
      },
    });
  };

  const handleLeaveGroup = async () => {
    if (!token) return;
    showConfirmModal({
      title: '退出群組',
      message: `確定要退出「${activeGroupForModal.name}」嗎？`,
      confirmText: '確認退出',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.post(
            `/groups/${activeGroupForModal.id}/leave`,
            {},
            token
          );
          removeGroup(activeGroupForModal.id);
          setShowGroupMembersModal(false);
          notify?.('已成功退出群組', 'success');
        } catch (err: any) {
          notify?.(err.message || '退出群組失敗', 'danger');
        }
      },
    });
  };

  const handleDeleteGroup = async () => {
    if (!token) return;
    showConfirmModal({
      title: '解散群組',
      message: `確定要解散「${activeGroupForModal.name}」嗎？此操作將解散群組並清除所有成員。`,
      confirmText: '確認解散',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(
            `/groups/${activeGroupForModal.id}`,
            token
          );
          removeGroup(activeGroupForModal.id);
          setShowGroupMembersModal(false);
          notify?.('群組已成功解散', 'success');
        } catch (err: any) {
          notify?.(err.message || '解散群組失敗', 'danger');
        }
      },
    });
  };

  return (
    <>
      <BaseModal
        isOpen={showGroupMembersModal}
        onClose={() => setShowGroupMembersModal(false)}
        title={activeGroupForModal.name}
        maxWidth="500px"
      >
        {/* 群組頂部 Banner 與頭像 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'relative',
              cursor: 'pointer',
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            title="點擊更換群組頭像"
          >
            <Avatar
              src={activeGroupForModal.avatar}
              name={activeGroupForModal.name}
              fallbackSeed={activeGroupForModal.name}
              size={60}
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {activeGroupForModal.name}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {activeGroupForModal.members?.length || 0} 位成員 • {isOwner ? '您是群主' : '一般成員'}
            </span>
          </div>
        </div>

        {/* TAB 分頁切換 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <button
            type="button"
            className={`uiBtnSecondary ${activeTab === 'members' ? 'uiBtnPrimary' : ''}`}
            onClick={() => setActiveTab('members')}
            style={{ flex: 1, height: '36px', fontSize: '0.86rem' }}
          >
            <Users size={16} />
            <span>成員名單 ({activeGroupForModal.members?.length || 0})</span>
          </button>
          <button
            type="button"
            className={`uiBtnSecondary ${activeTab === 'media' ? 'uiBtnPrimary' : ''}`}
            onClick={() => setActiveTab('media')}
            style={{ flex: 1, height: '36px', fontSize: '0.86rem' }}
          >
            <ImageIcon size={16} />
            <span>媒體與檔案 ({groupMediaFiles.length})</span>
          </button>
        </div>

        {/* Tab 1: 成員名單 */}
        {activeTab === 'members' && (
          <div style={{ marginBottom: '16px' }}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>成員名單 (點擊名字可改暱稱)</span>
              {isOwner && (
                <button className={styles.inviteBtn} onClick={() => setShowAddSection(!showAddSection)}>
                  <UserPlus size={14} />
                  <span>邀請好友</span>
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
                        {selectedFriend.display_name || selectedFriend.account_id}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>選擇要邀請的好友...</span>
                  )}
                  <ChevronDown size={18} />
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
                          <Avatar src={f.avatar} name={f.display_name || f.account_id} size={28} />
                          <span>{f.display_name || f.account_id}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <button className="uiBtnPrimary" onClick={handleAddMember} disabled={!selectedFriendId} style={{ height: '42px' }}>
                  加入
                </button>
              </div>
            )}

            <div className={styles.memberList}>
              {(activeGroupForModal.members || []).map((m) => {
                const u = m.user;
                const globalName = u?.display_name || u?.account_id || `User #${m.user_id}`;
                const isGroupOwner = m.role === 'owner' || m.user_id === activeGroupForModal.owner_id;
                const isEditing = editingMemberUserId === m.user_id;

                return (
                  <div key={m.id} className={styles.memberItem}>
                    <div className={styles.memberUser}>
                      <Avatar
                        src={u?.avatar}
                        name={globalName}
                        fallbackSeed={u?.display_name || u?.account_id}
                        size={36}
                        onClick={() => u && onViewProfile && onViewProfile(u)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              className="uiInput"
                              value={tempNickname}
                              onChange={(e) => setTempNickname(e.target.value)}
                              placeholder={`設定群內暱稱...`}
                              autoFocus
                              style={{ height: '30px', padding: '0 8px', fontSize: '0.82rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMemberNickname(m.user_id)}
                              disabled={savingNicknameId === m.user_id}
                              style={{ color: 'var(--token-success)' }}
                              title="儲存暱稱"
                            >
                              {savingNicknameId === m.user_id ? <Loader2 size={15} className="spin" /> : <Check size={16} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMemberUserId(null)}
                              style={{ color: 'var(--text-muted)' }}
                              title="取消"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                            onClick={() => {
                              setEditingMemberUserId(m.user_id);
                              setTempNickname(m.nickname || '');
                            }}
                            title="點擊修改此成員群內暱稱"
                          >
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {m.nickname || globalName}
                            </span>
                            {isGroupOwner && <span className={styles.ownerBadge}>群主</span>}
                            <Edit3 size={12} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          </div>
                        )}
                        {!isEditing && m.nickname && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            原名: {globalName}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOwner && m.user_id !== currentUserId && (
                      <button
                        className={styles.removeMemberBtn}
                        onClick={() => handleRemoveMember(m.user_id, m.nickname || globalName)}
                        title="移出群組"
                      >
                        <UserMinus size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: 媒體與檔案庫 */}
        {activeTab === 'media' && (
          <div style={{ minHeight: '180px', maxHeight: '320px', overflowY: 'auto' }}>
            {groupMediaFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                本群尚無傳送過之媒體或檔案
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '4px' }}>
                {groupMediaFiles.map((item, i) => {
                  const isImg = item.payload.mime?.startsWith('image/');
                  const url = getIPFSGatewayUrl(item.payload.cid);
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        height: '90px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isImg ? (
                        <a href={url} target="_blank" rel="noreferrer" style={{ width: '100%', height: '100%' }}>
                          <img src={url} alt={item.payload.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit', padding: '6px' }}
                        >
                          <FileText size={22} color="var(--accent-color)" />
                          <span style={{ fontSize: '0.7rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.payload.name}
                          </span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 底部操作區 (解散/退出) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          {isOwner ? (
            <button className="uiBtnDanger" onClick={handleDeleteGroup}>
              <Trash2 size={16} />
              <span>解散群組</span>
            </button>
          ) : (
            <button className="uiBtnDanger" onClick={handleLeaveGroup}>
              <LogOut size={16} />
              <span>退出群組</span>
            </button>
          )}
        </div>
      </BaseModal>

      {/* 群組頭像裁切彈窗 */}
      <AvatarCropModal
        isOpen={Boolean(cropFile)}
        imageFile={cropFile}
        onClose={() => setCropFile(null)}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};
