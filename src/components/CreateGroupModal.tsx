// Context: CreateGroupModal 重構 - 套用通用 BaseModal
import React, { useState } from 'react';
import { Users, Check } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient } from '../services/apiClient';
import { Group } from '../types';
import { BaseModal } from './common/BaseModal';
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
  const [loading, setLoading] = useState(false);

  if (!showCreateGroupModal) return null;

  const toggleUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
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

      addGroup(newGroup);
      setActiveGroup(newGroup);
      setShowCreateGroupModal(false);
      setGroupName('');
      setSelectedUserIds([]);
      notify?.(`成功建立群組「${newGroup.name}」`, 'success');
    } catch (err: any) {
      notify?.(err.message || '建立群組失敗', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={showCreateGroupModal}
      onClose={() => setShowCreateGroupModal(false)}
      title="建立新群組"
      icon={<Users size={20} />}
      maxWidth="440px"
    >
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                return (
                  <div
                    key={friend.id}
                    className={`${styles.memberItem} ${isSelected ? styles.selected : ''}`}
                    onClick={() => toggleUser(friend.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--accent-color)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        {(friend.display_name || friend.account_id || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {friend.display_name || `@${friend.account_id}`}
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
            disabled={loading}
          >
            {loading ? '建立中...' : '建立群組'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

