// TEAM_012: UserSearchModal 重構 - 套用通用 BaseModal
import React, { useContext, useState, FormEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { User } from '../types';
import { Search, UserPlus, UserMinus, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './UserSearchModal.module.css';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: User[];
  onFriendChange: () => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  friends,
  onFriendChange
}) => {
  const { token, API_BASE } = useContext(AuthContext);
  const { setActiveChatUser } = useContext(SocketContext);
  const { notify } = useNotification();

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [results, setResults] = useState<User[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !token) return;

    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      notify({ message: '搜尋失敗', type: 'danger' });
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const isUserFriend = (targetId: number): boolean => {
    return friends.some(f => f.id === targetId);
  };

  const handleAddFriend = async (targetUser: User) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_id: targetUser.account_id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '發送好友邀請失敗');
      }
      notify({ message: '好友邀請已發送！', type: 'success' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '發送好友邀請失敗', type: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async (targetUser: User) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/friends/reject/${targetUser.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '移除好友失敗');
      }
      notify({ message: `已移除好友 ${targetUser.display_name || targetUser.account_id}`, type: 'info' });
      onFriendChange();
    } catch (err: any) {
      notify({ message: err.message || '移除好友失敗', type: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartChat = async (targetUser: User) => {
    setActiveChatUser(targetUser);
    onClose();
  };

  const getDisplayName = (u: User) => u.display_name || u.account_id;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="搜尋使用者"
      icon={<Search size={20} />}
      maxWidth="480px"
    >
      <form onSubmit={handleSearch} className={styles.searchFormRow}>
        <div className={styles.searchInputBox}>
          <Search size={16} className={styles.searchInputIcon} />
          <input
            type="text"
            placeholder="輸入好友 ID 即可搜尋..."
            className={styles.searchField}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            required
          />
        </div>
        <button type="submit" className={`uiBtnPrimary ${styles.nowrapBtn}`} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : '尋找好友'}
        </button>
      </form>

      {searched && (
        <div className={styles.resultsContainer}>
          {results.length === 0 ? (
            <div className={styles.emptyResult}>
              <AlertCircle size={36} opacity={0.4} />
              <h4>查無此帳號 ID</h4>
              <p className={styles.emptySubtitle}>請檢查輸入之帳號 ID 是否正確</p>
            </div>
          ) : (
            <div className={styles.resultsList}>
              {results.map((targetUser) => {
                const isFriend = isUserFriend(targetUser.id);
                const displayName = getDisplayName(targetUser);
                return (
                  <div key={targetUser.id} className={styles.userCardItem}>
                    <div className={styles.userCardHeader}>
                      <div className={styles.userAvatar}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.userMeta}>
                        <h4>{displayName}</h4>
                        <div className={styles.userSubMeta}>
                          <span>@{targetUser.account_id}</span>
                          <span className={`${styles.statusBadge} ${isFriend ? styles.isFriend : ''}`}>
                            {isFriend ? '好友' : '非好友'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardActionRow}>
                      {isFriend ? (
                        <button
                          className={`uiBtnDanger ${styles.actionBtn}`}
                          onClick={() => handleRemoveFriend(targetUser)}
                          disabled={actionLoading}
                        >
                          <UserMinus size={15} />
                          <span>移除好友</span>
                        </button>
                      ) : (
                        <button
                          className={`uiBtnPrimary ${styles.actionBtn}`}
                          onClick={() => handleAddFriend(targetUser)}
                          disabled={actionLoading}
                        >
                          <UserPlus size={15} />
                          <span>新增好友</span>
                        </button>
                      )}

                      <button
                        className={`uiBtnSecondary ${styles.actionBtn}`}
                        onClick={() => handleStartChat(targetUser)}
                      >
                        <MessageSquare size={15} />
                        <span>{isFriend ? '發送訊息' : '發送陌生訊息'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
};
