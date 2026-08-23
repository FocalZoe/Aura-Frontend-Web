// Context: 聊天室頂部標頭組件 (統一 36px 圓形毛玻璃按鈕、語意色彩、功能對齊與無跨模組依賴)

import React from 'react';
import { User, Group } from '../../types';
import { UserPlus, Info, Phone, Video, ArrowLeft, Camera, Search } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useChatStore } from '../../stores/useChatStore';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  activeChatUser?: User | null;
  activeGroup?: Group | null;
  isUserOnline?: boolean;
  isStranger?: boolean;
  onSendFriendRequest?: () => void;
  onViewProfile?: () => void;
  onOpenGroupModal?: () => void;
  onStartAudioCall?: () => void;
  onStartVideoCall?: () => void;
  onStartScreenshot?: () => void;
  onToggleSearch?: () => void;
  onBack?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChatUser,
  activeGroup,
  isUserOnline = false,
  isStranger = false,
  onSendFriendRequest,
  onViewProfile,
  onOpenGroupModal,
  onStartAudioCall,
  onStartVideoCall,
  onStartScreenshot,
  onToggleSearch,
  onBack,
}) => {
  const { getUserDisplayName } = useChatStore();

  // 1. 群組聊天標頭模式
  if (activeGroup) {
    const memberCount = activeGroup.members?.length || 0;
    return (
      <div className={styles.chatHeader}>
        <div className={styles.leftSection}>
          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              title="返回列表"
              aria-label="返回列表"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className={styles.chatUserDetail} onClick={onOpenGroupModal} title="點擊檢視群組詳情">
            <Avatar
              src={activeGroup.avatar}
              name={activeGroup.name}
              fallbackSeed={activeGroup.name}
              size={40}
            />
            <div className={styles.userInfoCol}>
              <h4 className={styles.userName}>{activeGroup.name}</h4>
              <span
                className={styles.userStatus}
                style={{
                  color: activeGroup.is_removed ? '#ef4444' : 'var(--text-muted)',
                  fontWeight: activeGroup.is_removed ? 600 : 400,
                }}
              >
                {activeGroup.is_removed ? '已被移出群組' : `${memberCount} 位成員`}
              </span>
            </div>
          </div>
        </div>

        {/* 標頭右側動作按鈕群 (完全對稱標準 4 大按鈕) */}
        <div className={styles.actionsGroup}>
          {/* 搜尋訊息 */}
          {onToggleSearch && (
            <button
              className={styles.actionBtn}
              onClick={onToggleSearch}
              title="搜尋對話記錄"
              aria-label="搜尋對話記錄"
            >
              <Search size={18} />
            </button>
          )}

          {/* 群組語音通話 (綠色) */}
          {onStartAudioCall && !activeGroup.is_removed && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnAudio}`}
              onClick={onStartAudioCall}
              title="發起群組語音通話"
              aria-label="發起群組語音通話"
            >
              <Phone size={18} />
            </button>
          )}

          {/* 群組視訊通話 (紫色) */}
          {onStartVideoCall && !activeGroup.is_removed && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnVideo}`}
              onClick={onStartVideoCall}
              title="發起群組視訊通話"
              aria-label="發起群組視訊通話"
            >
              <Video size={18} />
            </button>
          )}

          {/* 群組詳情資訊 */}
          {onOpenGroupModal && (
            <button
              className={styles.actionBtn}
              onClick={onOpenGroupModal}
              title="群組設定與成員"
              aria-label="群組設定與成員"
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. 一對一私聊標頭模式
  if (!activeChatUser) return null;

  const displayName = getUserDisplayName(activeChatUser);

  return (
    <>
      <div className={styles.chatHeader}>
        <div className={styles.leftSection}>
          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              title="返回列表"
              aria-label="返回列表"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className={styles.chatUserDetail} onClick={onViewProfile} title="點擊檢視個人名片">
            <Avatar
              src={activeChatUser.avatar}
              name={displayName}
              fallbackSeed={activeChatUser.display_name || activeChatUser.account_id}
              size={40}
              isOnline={!isStranger ? isUserOnline : undefined}
            />
            <div className={styles.userInfoCol}>
              <div className={styles.nameRow}>
                <h4 className={styles.userName}>{displayName}</h4>
                <span className={styles.userHandle}>@{activeChatUser.account_id}</span>
                {isStranger && <span className={styles.strangerTagBadge}>陌生人</span>}
              </div>
              {!isStranger && (
                <span className={styles.userStatus}>
                  {isUserOnline ? '在線上' : '離線'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 標頭右側動作按鈕群 (完全對稱標準 4 大按鈕) */}
        <div className={styles.actionsGroup}>
          {/* 搜尋訊息 */}
          {onToggleSearch && (
            <button
              className={styles.actionBtn}
              onClick={onToggleSearch}
              title="搜尋對話記錄"
              aria-label="搜尋對話記錄"
            >
              <Search size={18} />
            </button>
          )}

          {/* 一對一語音通話 (綠色) */}
          {onStartAudioCall && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnAudio}`}
              onClick={onStartAudioCall}
              title={isStranger ? '發起語音通話 (需先加為好友)' : '發起語音通話'}
              aria-label="發起語音通話"
            >
              <Phone size={18} />
            </button>
          )}

          {/* 一對一視訊通話 (紫色) */}
          {onStartVideoCall && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnVideo}`}
              onClick={onStartVideoCall}
              title={isStranger ? '發起視訊通話 (需先加為好友)' : '發起視訊通話'}
              aria-label="發起視訊通話"
            >
              <Video size={18} />
            </button>
          )}

          {/* 個人名片詳情 */}
          {onViewProfile && (
            <button
              className={styles.actionBtn}
              onClick={onViewProfile}
              title="個人名片詳情"
              aria-label="個人名片詳情"
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 陌生人訊息防護提示條 */}
      {isStranger && (
        <div className={styles.strangerBanner}>
          <div className={styles.strangerBannerText}>
            <span>此用戶不在您的聯絡人名單中。</span>
          </div>
          {onSendFriendRequest && (
            <button className={styles.strangerAddBtn} onClick={onSendFriendRequest}>
              <UserPlus size={14} />
              <span>加為聯絡人</span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
