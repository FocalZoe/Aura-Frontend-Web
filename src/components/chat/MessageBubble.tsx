// Context: 訊息氣泡組件 (包含 Lucide 通話紀錄卡片、網址 Link Embed 預覽與微灰時間字形)
import React from 'react';
import { Message, User } from '../../types';
import { AlertCircle, Phone, PhoneOff } from 'lucide-react';
import { LinkEmbed } from './LinkEmbed';
import styles from '../ChatWindow.module.css';

interface MessageBubbleProps {
  msg: Message;
  currentUserId: number;
  partnerUser?: User;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  currentUserId,
  renderIPFSFileCard,
}) => {
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

  // 提取文字中的所有 HTTP/HTTPS URL
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
        {/* Context: [網址 Embed] 當訊息中包含 URL 時渲染 LinkEmbed 卡片 */}
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

  return (
    <div className={`${styles.msgRow} ${isSelf ? styles.msgRowSelf : styles.msgRowOther}`}>
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
    </div>
  );
};


