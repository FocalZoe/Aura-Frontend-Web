// TEAM_012: GroupMembersModal 重構 - 套用通用 BaseModal
import React, { useState, useRef, useEffect } from 'react';
import { Users, UserMinus, LogOut, Trash2, UserPlus, ChevronDown } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient } from '../services/apiClient';
import { Group } from '../types';
import { BaseModal } from './common/BaseModal';
import styles from './GroupMembersModal.module.css';

interface GroupMembersModalProps {
  currentUserId: number;
  token: string | null;
  notify?: (msg: string, type?: 'danger' | 'warning' | 'info' | 'success') => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ currentUserId, token, notify }) => {
  const { showGroupMembersModal, setShowGroupMembersModal, showConfirmModal } = useUIStore();
  const { activeGroup, setActiveGroup, friends, updateGroupInStore, removeGroup, setGroups } = useChatStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

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
    <BaseModal
      isOpen={showGroupMembersModal}
      onClose={() => setShowGroupMembersModal(false)}
      title={activeGroupForModal.name}
      icon={<Users size={20} />}
      maxWidth="460px"
    >
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
                  <div className={styles.selectAvatar}>
                    {(selectedFriend.display_name || selectedFriend.account_id).charAt(0).toUpperCase()}
                  </div>
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
                      <div className={styles.selectAvatar}>
                        {(f.display_name || f.account_id).charAt(0).toUpperCase()}
                      </div>
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
            const name = u?.display_name || u?.account_id || `User #${m.user_id}`;
            const isGroupOwner = m.role === 'owner' || m.user_id === activeGroupForModal.owner_id;

            return (
              <div key={m.id} className={styles.memberItem}>
                <div className={styles.memberUser}>
                  <div className={styles.avatar}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.9rem' }}>
                    {name}{' '}
                    {isGroupOwner && (
                      <span className={styles.ownerBadge}>
                        群主
                      </span>
                    )}
                  </span>
                </div>

                {isOwner && !isGroupOwner && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemoveMemberConfirm(m.user_id, name)}
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
  );
};
