// Context: [用戶搜尋] 使用者搜尋彈窗，支援快速查找並開啟個人資料名片
import React, { useContext, useState, FormEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { User } from '../types';
import { Avatar } from './common/Avatar';
import { Search, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './UserSearchModal.module.css';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: User[];
  onViewProfile: (user: User) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  friends,
  onViewProfile
}) => {
  const { token, API_BASE } = useContext(AuthContext);
  const { notify } = useNotification();

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [results, setResults] = useState<User[]>([]);

  if (!isOpen) return null;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !token) return;

    setLoading(true);
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
      setSearched(true);
    } catch (err: any) {
      notify({ message: '搜尋使用者失敗，請檢查網路連線', type: 'danger' });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isUserFriend = (id: number) => friends.some((f) => f.id === id);
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
                      <Avatar
                        src={targetUser.avatar}
                        name={displayName}
                        size={44}
                      />
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
                      <button
                        type="button"
                        className={`uiBtnPrimary ${styles.actionBtn}`}
                        onClick={() => {
                          onClose();
                          onViewProfile(targetUser);
                        }}
                        style={{ width: '100%', height: '38px' }}
                      >
                        <UserCheck size={16} />
                        <span>查看個人資料</span>
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
