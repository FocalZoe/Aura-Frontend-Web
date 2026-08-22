// Context: 訊息表情反應名單彈窗 (BaseModal、Emoji 分頁篩選與成員名片聯動)
import React, { useState, useMemo } from 'react';
import { Smile, Users } from 'lucide-react';
import { Message, User, ReactionItem } from '../../types';
import { BaseModal } from '../common/BaseModal';
import { Avatar } from '../common/Avatar';
import styles from './MessageReactionsModal.module.css';

interface MessageReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  groupMembersMap?: Record<number, { user?: User; nickname?: string }>;
  currentUser?: User | null;
  partnerUser?: User | null;
  onViewProfile?: (user: User) => void;
}

export const MessageReactionsModal: React.FC<MessageReactionsModalProps> = ({
  isOpen,
  onClose,
  message,
  groupMembersMap,
  currentUser,
  partnerUser,
  onViewProfile,
}) => {
  const [activeTab, setActiveTab] = useState<string>('all');

  const reactions: ReactionItem[] = message?.reactions || [];

  // 計算所有反應資料並豐富使用者資訊
  const enrichedReactions = useMemo(() => {
    return reactions.map((r) => {
      let resolvedUser: User | undefined = r.user;
      let nickname: string | undefined;

      if (groupMembersMap && groupMembersMap[r.user_id]) {
        resolvedUser = groupMembersMap[r.user_id].user || resolvedUser;
        nickname = groupMembersMap[r.user_id].nickname;
      } else if (currentUser && Number(currentUser.id) === Number(r.user_id)) {
        resolvedUser = currentUser;
      } else if (partnerUser && Number(partnerUser.id) === Number(r.user_id)) {
        resolvedUser = partnerUser;
      }

      const displayName =
        nickname ||
        resolvedUser?.display_name ||
        resolvedUser?.account_id ||
        `用戶 #${r.user_id}`;

      return {
        ...r,
        resolvedUser,
        nickname,
        displayName,
      };
    });
  }, [reactions, groupMembersMap, currentUser, partnerUser]);

  // 表情分組統計
  const emojiTabs = useMemo(() => {
    const map: Record<string, number> = {};
    reactions.forEach((r) => {
      map[r.emoji] = (map[r.emoji] || 0) + 1;
    });
    return Object.entries(map).map(([emoji, count]) => ({ emoji, count }));
  }, [reactions]);

  // 依當前 Tab 篩選後的列表
  const filteredReactions = useMemo(() => {
    if (activeTab === 'all') return enrichedReactions;
    return enrichedReactions.filter((r) => r.emoji === activeTab);
  }, [enrichedReactions, activeTab]);

  if (!isOpen || !message) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`訊息表情反應 (${reactions.length})`}
      icon={<Smile size={20} />}
      maxWidth="420px"
    >
      <div className={styles.modalBody}>
        {/* 表情分類 Tabs */}
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>全部</span>
            <span>{reactions.length}</span>
          </button>

          {emojiTabs.map(({ emoji, count }) => (
            <button
              key={emoji}
              type="button"
              className={`${styles.tabBtn} ${activeTab === emoji ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(emoji)}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>

        {/* 成員列表 */}
        <div className={styles.userList}>
          {filteredReactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              尚無表情反應
            </div>
          ) : (
            filteredReactions.map((item, idx) => (
              <div
                key={`${item.user_id}_${item.emoji}_${idx}`}
                className={styles.userItem}
                onClick={() => {
                  if (item.resolvedUser && onViewProfile) {
                    onViewProfile(item.resolvedUser);
                  }
                }}
                title={`點擊查看 ${item.displayName} 的名片`}
              >
                <div className={styles.userInfo}>
                  <Avatar
                    src={item.resolvedUser?.avatar}
                    name={item.displayName}
                    fallbackSeed={item.resolvedUser?.display_name || item.resolvedUser?.account_id || `User_${item.user_id}`}
                    size={36}
                  />
                  <div className={styles.userTexts}>
                    <span className={styles.userName}>{item.displayName}</span>
                    <span className={styles.userAccount}>
                      @{item.resolvedUser?.account_id || item.user_id}
                    </span>
                  </div>
                </div>

                <div className={styles.emojiBadge}>{item.emoji}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </BaseModal>
  );
};
