// Context: 訊息氣泡組件 (包含 Emoji 表情反應、Lucide 通話紀錄卡片、Link Embed 與發送者 Avatar 名片)
import React, { useState } from 'react';
import { Message, User, ReactionItem } from '../../types';
import { AlertCircle, Phone, PhoneOff } from 'lucide-react';
import { LinkEmbed } from './LinkEmbed';
import { Avatar } from '../common/Avatar';
import styles from '../ChatWindow.module.css';

interface MessageBubbleProps {
  msg: Message;
  currentUserId: number;
  partnerUser?: User;
  senderUser?: User;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
  onReaction?: (messageId: number, emoji: string) => void;
  onViewProfile?: (user: User) => void;
}

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  currentUserId,
  partnerUser,
  senderUser,
  renderIPFSFileCard,
  onReaction,
  onViewProfile,
}) => {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const isSelf = Number(msg.sender_id) === Number(currentUserId);
  const isError = msg.error === true;
  const isIPFSPayload = !!msg.filePayload;

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
      return part;
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
            <span>通話</span>
          </div>
          {durationStr && (
            <div style={{ fontSize: '0.8rem', color: isSelf ? 'rgba(255,255,255,0.78)' : 'rgba(148,163,184,0.9)', fontWeight: 500, paddingLeft: '22px' }}>
              {durationStr}
            </div>
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
        {detectedUrls.length > 0 && (
          <div className={styles.msgLinkEmbedsContainer}>
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
    isError ? styles.msgBubbleError : '',
    isIPFSPayload ? styles.msgBubbleImage : '',
  ].filter(Boolean).join(' ');

  // 聚合 Emoji 反應統計
  const reactionMap = (msg.reactions || []).reduce<Record<string, { count: number; users: number[]; reactedByMe: boolean }>>(
    (acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, users: [], reactedByMe: false };
      }
      acc[r.emoji].count += 1;
      acc[r.emoji].users.push(r.user_id);
      if (Number(r.user_id) === Number(currentUserId)) {
        acc[r.emoji].reactedByMe = true;
      }
      return acc;
    },
    {}
  );

  const displayUser = senderUser || partnerUser;

  return (
    <div
      className={`${styles.msgRow} ${isSelf ? styles.msgRowSelf : styles.msgRowOther}`}
      onMouseEnter={() => setShowPicker(true)}
      onMouseLeave={() => setShowPicker(false)}
    >
      {/* 他人發送之訊息展示頭像 */}
      {!isSelf && displayUser && (
        <div
          className={styles.msgAvatarWrapper}
          onClick={() => onViewProfile && onViewProfile(displayUser)}
          title={`點擊查看 ${displayUser.display_name || displayUser.account_id} 的個人名片`}
        >
          <Avatar
            src={displayUser.avatar}
            name={displayUser.display_name || displayUser.account_id}
            size={32}
          />
        </div>
      )}

      <div className={styles.msgBubbleContainer}>
        {/* 表情反應懸停快捷列 */}
        {showPicker && msg.id && onReaction && (
          <div className={`${styles.reactionPickerBar} ${isSelf ? styles.reactionPickerBarSelf : styles.reactionPickerBarOther}`}>
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactionPickerEmoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReaction(msg.id!, emoji);
                  setShowPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className={bubbleClasses}>
          {isError && <AlertCircle size={16} style={{ flexShrink: 0 }} />}
          <div>
            {msg.filePayload && renderIPFSFileCard ? (
              renderIPFSFileCard(msg)
            ) : (
              renderMessageContent(msg.content)
            )}
            <span className={styles.msgMeta}>{formatTime(msg.timestamp)}</span>
          </div>
        </div>

        {/* 訊息下方已獲得的表情反應膠囊 */}
        {Object.keys(reactionMap).length > 0 && (
          <div className={`${styles.reactionsWrapper} ${isSelf ? styles.reactionsWrapperSelf : styles.reactionsWrapperOther}`}>
            {Object.entries(reactionMap).map(([emoji, data]) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.reactionPill} ${data.reactedByMe ? styles.reactionPillActive : ''}`}
                onClick={() => msg.id && onReaction && onReaction(msg.id, emoji)}
                title={data.reactedByMe ? '點擊取消反應' : '點擊新增此反應'}
              >
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



