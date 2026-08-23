// Context: 訊息氣泡組件 (包含右鍵選單觸發、連續截圖勾選、收回提示、Emoji 膠囊、通話卡片與 Avatar 名片)
import React from 'react';
import { Message, User } from '../../types';
import { AlertCircle, Phone, PhoneOff, CheckCircle2, Circle } from 'lucide-react';
import { LinkEmbed } from './LinkEmbed';
import { Avatar } from '../common/Avatar';
import { useChatStore } from '../../stores/useChatStore';
import styles from '../ChatWindow.module.css';

interface MessageBubbleProps {
  msg: Message;
  currentUserId: number;
  currentUser?: User;
  partnerUser?: User;
  senderUser?: User;
  isGroup?: boolean;
  groupNickname?: string;
  groupMembersMap?: Record<number, { user?: User; nickname?: string }>;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
  onReaction?: (messageId: number, emoji: string) => void;
  onViewProfile?: (user: User) => void;
  onContextMenu?: (e: React.MouseEvent, msg: Message) => void;
  onViewReactions?: (message: Message) => void;
  isScreenshotMode?: boolean;
  isSelectedForScreenshot?: boolean;
  onToggleSelectScreenshot?: (msg: Message) => void;
  highlightKeyword?: string;
  isSearchHighlighted?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  currentUserId,
  currentUser,
  partnerUser,
  senderUser,
  isGroup = false,
  groupNickname,
  groupMembersMap,
  renderIPFSFileCard,
  onReaction,
  onViewProfile,
  onContextMenu,
  onViewReactions,
  isScreenshotMode = false,
  isSelectedForScreenshot = false,
  onToggleSelectScreenshot,
  highlightKeyword,
  isSearchHighlighted = false,
}) => {
  const isSelf = Number(msg.sender_id) === Number(currentUserId);
  const isError = msg.error === true;
  const isIPFSPayload = !!msg.filePayload;
  const isRecalled = msg.is_recalled || msg.content === '[RECALLED]';
  const { getUserDisplayName } = useChatStore();

  // 系統置中公告訊息 (無氣泡、小字、膠囊微光樣式)
  if (msg.is_system) {
    return (
      <div id={`message-${msg.id}`} className={styles.systemMsgRow}>
        <div className={styles.systemMsgPill}>
          {msg.content}
        </div>
      </div>
    );
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const extractUrls = (text: string): string[] => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const highlightText = (text: string) => {
    if (!highlightKeyword || !highlightKeyword.trim()) return text;
    const regex = new RegExp(`(${highlightKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className={styles.searchHighlightText}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.msgInlineLink}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return highlightText(part);
    });
  };

  const renderMessageContent = (content: string) => {
    if (
      content.includes('📞 通話') ||
      content.includes('📹 視訊通話') ||
      content.includes('📞 語音通話')
    ) {
      const parts = content.split('\n');
      let durationStr = '';
      if (parts.length >= 2) {
        durationStr = parts[1].trim();
      } else {
        const match = content.match(/\((.*?)\)/);
        if (match) durationStr = match[1];
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Phone size={16} />
            <span>{parts[0]}</span>
          </div>
          {durationStr && (
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              通話時長: {durationStr}
            </span>
          )}
        </div>
      );
    } else if (
      content.includes('未接來電') ||
      content.includes('未接語音來電') ||
      content.includes('未接視訊來電')
    ) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f87171' }}>
          <PhoneOff size={16} />
          <span>未接來電</span>
        </div>
      );
    } else if (
      content.includes('已拒絕來電') ||
      content.includes('已拒絕語音通話') ||
      content.includes('已拒絕視訊通話')
    ) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f87171' }}>
          <PhoneOff size={16} />
          <span>已拒絕來電</span>
        </div>
      );
    }

    const detectedUrls = extractUrls(content);

    return (
      <div className={styles.msgContentWrapper}>
        <div className={styles.msgTextBody}>{renderTextWithLinks(content)}</div>
        {detectedUrls.length > 0 && !isSelf && (
          <div className={styles.msgEmbedsContainer}>
            {detectedUrls.map((url, i) => (
              <LinkEmbed key={i} url={url} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const bubbleClasses = [
    styles.msgBubble,
    isSelf ? styles.msgBubbleSelf : styles.msgBubbleOther,
    isIPFSPayload ? styles.msgBubbleImage : '',
    isError ? styles.msgBubbleError : '',
    isRecalled ? styles.recalledBubble : '',
  ]
    .filter(Boolean)
    .join(' ');

  interface ReactionUserDetail {
    id: number;
    avatar?: string;
    displayName: string;
    fallbackSeed: string;
  }

  const reactionMap = (msg.reactions || []).reduce<
    Record<string, { count: number; users: ReactionUserDetail[]; reactedByMe: boolean }>
  >((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, users: [], reactedByMe: false };
    }
    acc[r.emoji].count += 1;
    if (Number(r.user_id) === Number(currentUserId)) {
      acc[r.emoji].reactedByMe = true;
    }

    let avatar = r.user?.avatar;
    let displayName = r.user?.display_name || r.user?.account_id || `User_${r.user_id}`;
    let fallbackSeed = r.user?.display_name || r.user?.account_id || `User_${r.user_id}`;

    if (groupMembersMap && groupMembersMap[r.user_id]) {
      const gm = groupMembersMap[r.user_id];
      if (gm.user?.avatar) avatar = gm.user.avatar;
      if (gm.nickname) displayName = gm.nickname;
      else if (gm.user?.display_name) displayName = gm.user.display_name;
      if (gm.user?.display_name || gm.user?.account_id) {
        fallbackSeed = gm.user.display_name || gm.user.account_id;
      }
    } else if (currentUser && Number(r.user_id) === Number(currentUser.id)) {
      avatar = currentUser.avatar;
      displayName = getUserDisplayName(currentUser);
      fallbackSeed = currentUser.display_name || currentUser.account_id || `User_${currentUser.id}`;
    } else if (partnerUser && Number(r.user_id) === Number(partnerUser.id)) {
      avatar = partnerUser.avatar;
      displayName = getUserDisplayName(partnerUser);
      fallbackSeed = partnerUser.display_name || partnerUser.account_id;
    }

    acc[r.emoji].users.push({
      id: r.user_id,
      avatar,
      displayName,
      fallbackSeed,
    });

    return acc;
  }, {});

  const displayUser = senderUser || partnerUser || msg.sender;
  const finalDisplayName = groupNickname || (displayUser ? getUserDisplayName(displayUser) : `用戶 #${msg.sender_id}`);

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (isScreenshotMode && onToggleSelectScreenshot) {
      e.stopPropagation();
      onToggleSelectScreenshot(msg);
    }
  };

  const handleBubbleContextMenu = (e: React.MouseEvent) => {
    if (isScreenshotMode) return;
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, msg);
    }
  };

  return (
    <div
      id={`message-${msg.id}`}
      className={`${styles.msgRow} ${isSelf ? styles.msgRowSelf : styles.msgRowOther}`}
      style={{
        background: isScreenshotMode && isSelectedForScreenshot ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
        borderRadius: '8px',
        transition: 'background 0.15s ease',
        cursor: isScreenshotMode ? 'pointer' : 'default',
      }}
      onClick={handleBubbleClick}
    >
      {/* 截圖模式 Checkbox */}
      {isScreenshotMode && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          {isSelectedForScreenshot ? (
            <CheckCircle2 size={20} color="var(--accent-color)" />
          ) : (
            <Circle size={20} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
          )}
        </div>
      )}

      <div className={`${styles.msgBubbleContainer} ${isSearchHighlighted ? styles.msgHighlightGlow : ''}`}>
        {/* 群組內他人發送訊息顯示發送者名字/群內暱稱 */}
        {!isSelf && isGroup && (
          <div
            className={styles.msgSenderName}
            onClick={(e) => {
              if (displayUser && onViewProfile) {
                e.stopPropagation();
                onViewProfile(displayUser);
              }
            }}
          >
            {finalDisplayName}
          </div>
        )}

        {/* 核心氣泡行 (包含頭像底部切齊、氣泡、外部時間靠底對齊) */}
        <div className={styles.msgBubbleRow}>
          {/* 他人訊息展示頭像 (底部對齊氣泡) */}
          {!isSelf && (
            <div
              className={styles.msgAvatarWrapper}
              onClick={(e) => {
                if (isScreenshotMode) return;
                if (displayUser && onViewProfile) {
                  e.stopPropagation();
                  onViewProfile(displayUser);
                }
              }}
              title={`點擊查看 ${finalDisplayName} 的個人名片`}
            >
              <Avatar
                src={displayUser?.avatar}
                name={finalDisplayName}
                fallbackSeed={displayUser?.display_name || displayUser?.account_id || `User_${msg.sender_id}`}
                size={32}
              />
            </div>
          )}

          {/* 自己發送之訊息：時間在氣泡左邊外面 (靠底對齊) */}
          {isSelf && !isRecalled && (
            <div className={styles.msgMetaOutsideLeft}>
              {formatTime(msg.timestamp)}
              {msg.is_edited && <span className={styles.msgEditedBadge}>(已編輯)</span>}
            </div>
          )}

          {/* 氣泡本體 */}
          <div className={bubbleClasses} onContextMenu={handleBubbleContextMenu}>
            {isError && <AlertCircle size={16} style={{ flexShrink: 0 }} />}
            {isRecalled ? (
              <span>{isSelf ? '您已收回一則訊息' : `${finalDisplayName || '對方'} 已收回一則訊息`}</span>
            ) : (
              msg.filePayload && renderIPFSFileCard ? (
                renderIPFSFileCard(msg)
              ) : (
                renderMessageContent(msg.content)
              )
            )}
          </div>

          {/* 他人發送之訊息：時間在氣泡右邊外面 (靠底對齊) */}
          {!isSelf && !isRecalled && (
            <div className={styles.msgMetaOutsideRight}>
              {formatTime(msg.timestamp)}
              {msg.is_edited && <span className={styles.msgEditedBadge}>(已編輯)</span>}
            </div>
          )}
        </div>

        {/* 訊息下方已獲得的表情反應膠囊 */}
        {!isRecalled && Object.keys(reactionMap).length > 0 && (
          <div className={`${styles.reactionsWrapper} ${isSelf ? styles.reactionsWrapperSelf : styles.reactionsWrapperOther}`}>
            {Object.entries(reactionMap).map(([emoji, data]) => {
              const showAvatars = !isGroup || data.count <= 2;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`${styles.reactionPill} ${data.reactedByMe ? styles.reactionPillActive : ''}`}
                  onClick={(e) => {
                    if (isScreenshotMode) return;
                    e.stopPropagation();
                    if (onViewReactions) {
                      onViewReactions(msg);
                    } else if (msg.id && onReaction) {
                      onReaction(msg.id, emoji);
                    }
                  }}
                  title={data.reactedByMe ? '點擊檢視反應名單 / 取消反應' : '點擊檢視反應名單'}
                >
                  <span>{emoji}</span>

                  {showAvatars ? (
                    <div className={styles.reactionAvatars}>
                      {data.users.map((u) => (
                        <div key={u.id} className={styles.reactionAvatarItem}>
                          <Avatar
                            src={u.avatar}
                            name={u.displayName}
                            fallbackSeed={u.fallbackSeed}
                            size={16}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>{data.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};



