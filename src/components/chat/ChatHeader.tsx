// Context: [手機RWD] 支援手機端返回列表導航、個人名片 Avatar、自訂備註暱稱與對話截圖按鈕
import React from 'react';
import { User, Group } from '../../types';
import { UserPlus, Users, Info, Phone, Video, ArrowLeft, Camera } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { useChatStore } from '../../stores/useChatStore';
import styles from '../ChatWindow.module.css';
import sidebarStyles from '../Sidebar.module.css';

interface ChatHeaderProps {
  activeChatUser?: User | null;
  activeGroup?: Group | null;
  isUserOnline?: boolean;
  isStranger?: boolean;
  onSendFriendRequest?: () => void;
  onViewProfile?: () => void;
  onOpenGroupModal?: () => void;
  onStartAudioCall?: () => void; // 語音通話觸發器
  onStartVideoCall?: () => void; // 視訊通話觸發器
  onStartScreenshot?: () => void; // 對話截圖觸發器
  onBack?: () => void;          // 手機端返回列表回呼
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
  onBack,
}) => {
  const { getUserDisplayName } = useChatStore();

  if (activeGroup) {
    const memberCount = activeGroup.members?.length || 0;
    return (
      <div className={styles.chatHeader} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              title="返回列表"
              aria-label="返回列表"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className={styles.chatUserDetail} onClick={onOpenGroupModal} style={{ cursor: 'pointer' }}>
            <div className={sidebarStyles.avatar} style={{ background: 'var(--accent-color, #6366f1)', color: '#fff' }}>
              <Users size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 className={styles.userName} style={{ margin: 0 }}>{activeGroup.name}</h4>
              <span
                className={styles.userStatus}
                style={{
                  fontSize: '0.78rem',
                  color: activeGroup.is_removed ? '#ef4444' : 'var(--text-muted)',
                  fontWeight: activeGroup.is_removed ? 600 : 400,
                }}
              >
                {activeGroup.is_removed ? '已被移出群組' : `${memberCount} 位成員`}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onStartScreenshot && (
            <button
              className={sidebarStyles.themeToggleBtn}
              onClick={onStartScreenshot}
              title="對話連續截圖 (可匿名)"
              style={{ width: '34px', height: '34px' }}
            >
              <Camera size={18} />
            </button>
          )}

          <button
            className={sidebarStyles.themeToggleBtn}
            onClick={onOpenGroupModal}
            title="檢視群組詳情"
            style={{ width: '34px', height: '34px' }}
          >
            <Info size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (!activeChatUser) return null;

  const displayName = getUserDisplayName(activeChatUser);

  return (
    <>
      <div className={styles.chatHeader} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              title="返回列表"
              aria-label="返回列表"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className={styles.chatUserDetail} onClick={onViewProfile} style={{ cursor: 'pointer' }}>
            <Avatar
              src={activeChatUser.avatar}
              name={displayName}
              size={40}
              isOnline={!isStranger ? isUserOnline : undefined}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 className={styles.userName} style={{ margin: 0 }}>{displayName}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  @{activeChatUser.account_id}
                </span>
                {isStranger && <span className={styles.strangerTagBadge}>陌生人</span>}
              </div>
              {!isStranger && (
                <span className={styles.userStatus} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {isUserOnline ? '在線上' : '離線'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onStartScreenshot && (
            <button
              className={sidebarStyles.themeToggleBtn}
              onClick={onStartScreenshot}
              title="對話連續截圖 (可匿名)"
              style={{ width: '34px', height: '34px' }}
            >
              <Camera size={18} />
            </button>
          )}

          {/* Context: [通話限制] 陌生訊息對話隱藏通話按鈕（手機版寬度亦由 CSS 隱藏） */}
          {!isStranger && (
            <div className={styles.callButtonsGroup} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onStartAudioCall && (
                <button
                  className={sidebarStyles.themeToggleBtn}
                  onClick={onStartAudioCall}
                  title="發起語音通話"
                  style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                >
                  <Phone size={18} color="#10b981" />
                </button>
              )}

              {onStartVideoCall && (
                <button
                  className={sidebarStyles.themeToggleBtn}
                  onClick={onStartVideoCall}
                  title="發起視訊通話"
                  style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                >
                  <Video size={18} color="#6366f1" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isStranger && (
        <div className={styles.strangerBanner}>
          <div className={styles.strangerBannerText}>
            <UserPlus size={16} className="accent" />
            <span>此使用者尚不在您的好友名單中</span>
          </div>
          {onSendFriendRequest && (
            <button className={styles.strangerAddBtn} onClick={onSendFriendRequest}>
              加為好友
            </button>
          )}
        </div>
      )}
    </>
  );
};
