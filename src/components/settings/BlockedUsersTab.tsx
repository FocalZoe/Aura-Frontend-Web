import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { ShieldOff, UserX } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useUIStore } from '../../stores/useUIStore';
import { Avatar } from '../common/Avatar';
import styles from '../SettingsModal.module.css';

interface BlockedUsersTabProps {
  token: string | null;
  notify?: (options: any) => void;
}

export const BlockedUsersTab: React.FC<BlockedUsersTabProps> = ({ token, notify }) => {
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { showConfirmModal } = useUIStore();

  const fetchBlockedUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient.get<User[]>('/blocks', token);
      setBlockedUsers(data || []);
    } catch (err: any) {
      console.error('抓取封鎖名單失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [token]);

  const handleUnblockConfirm = (targetUser: User) => {
    const name = targetUser.display_name || targetUser.account_id;
    showConfirmModal({
      title: '確認解除封鎖',
      message: `確定要解除封鎖「${name}」嗎？解除後將恢復與對方的訊息互動。`,
      danger: false,
      confirmText: '解除封鎖',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/blocks/${targetUser.id}`, token);
          setBlockedUsers(blockedUsers.filter((u) => u.id !== targetUser.id));
          notify?.({ message: `已成功解除對「${name}」的封鎖`, type: 'success' });
        } catch (err: any) {
          notify?.({ message: err.message || '解除封鎖失敗', type: 'danger' });
        }
      },
    });
  };

  return (
    <div className={styles.settingsTabForm}>
      <div className={styles.securityInfoBox}>
        <ShieldOff size={24} className={styles.accentIcon} />
        <div>
          <h4>封鎖名單管理</h4>
          <p>此處列出已被您封鎖的使用者。被封鎖的使用者將無法向您發送訊息與好友邀請。</p>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        {loading ? (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
            載入封鎖名單中...
          </p>
        ) : blockedUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <UserX size={36} style={{ marginBottom: '8px', opacity: 0.6 }} />
            <p style={{ fontSize: '0.9rem' }}>目前的封鎖名單為空</p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '240px',
              overflowY: 'auto',
            }}
          >
            {blockedUsers.map((u) => {
              const name = u.display_name || u.account_id;
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar
                      src={u.avatar}
                      name={name}
                      fallbackSeed={name}
                      size={36}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{u.account_id}</div>
                    </div>
                  </div>

                  <button
                    className="uiBtnSecondary"
                    onClick={() => handleUnblockConfirm(u)}
                    style={{ height: '32px', padding: '0 12px', fontSize: '0.82rem' }}
                  >
                    解除封鎖
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
