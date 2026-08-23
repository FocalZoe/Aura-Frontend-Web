import React, { useRef, useEffect } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  currentUser?: User;
  partnerUser?: User;
  isGroup?: boolean;
  groupMembersMap?: Record<number, { user?: User; nickname?: string }>;
  loading?: boolean;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
  onReaction?: (messageId: number, emoji: string) => void;
  onViewProfile?: (user: User) => void;
  onContextMenu?: (e: React.MouseEvent, msg: Message) => void;
  onViewReactions?: (message: Message) => void;
  isScreenshotMode?: boolean;
  selectedRange?: { start: number; end: number } | null;
  onToggleSelectScreenshot?: (msg: Message, index: number) => void;
  highlightKeyword?: string;
  highlightedMessageId?: number | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  currentUser,
  partnerUser,
  isGroup = false,
  groupMembersMap,
  loading = false,
  renderIPFSFileCard,
  onReaction,
  onViewProfile,
  onContextMenu,
  onViewReactions,
  isScreenshotMode = false,
  selectedRange = null,
  onToggleSelectScreenshot,
  highlightKeyword,
  highlightedMessageId,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // 監聽滾動觸發無感向上載入歷史訊息
  const handleScroll = () => {
    if (!containerRef.current || !onLoadMore || !hasMore || loadingMore) return;
    if (containerRef.current.scrollTop <= 40) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
      onLoadMore();
    }
  };

  // 向上加載後保持平穩無感滾動位置
  useEffect(() => {
    if (containerRef.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        containerRef.current.scrollTop += diff;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!isScreenshotMode && !loading && isInitialLoadRef.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      isInitialLoadRef.current = false;
    }
  }, [messages, isScreenshotMode, loading]);

  if (loading && messages.length === 0) {
    return (
      <div className={styles.chatSkeletonList}>
        <div className={styles.chatLoadingBadge}>
          <span className={styles.spin}>✦</span>
          <span>正在安全載入端到端加密訊息...</span>
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowOther}`}>
          <div className={styles.chatSkeletonAvatar} />
          <div className={styles.chatSkeletonBubble} style={{ width: '160px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowSelf}`}>
          <div className={styles.chatSkeletonBubble} style={{ width: '220px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowOther}`}>
          <div className={styles.chatSkeletonAvatar} />
          <div className={styles.chatSkeletonBubble} style={{ width: '130px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowSelf}`}>
          <div className={styles.chatSkeletonBubble} style={{ width: '190px' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={isScreenshotMode ? styles.chatMessagesScreenshotMode : styles.chatMessages}
    >
      {/* 頂部向上加載指示器 */}
      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          載入更多歷史訊息中...
        </div>
      )}

      {messages.map((msg, idx) => {
        const isSelected = !!(
          selectedRange &&
          idx >= selectedRange.start &&
          idx <= selectedRange.end
        );

        let selectedPosition: 'single' | 'first' | 'middle' | 'last' | undefined = undefined;
        if (selectedRange && isSelected) {
          if (selectedRange.start === selectedRange.end) {
            selectedPosition = 'single';
          } else if (idx === selectedRange.start) {
            selectedPosition = 'first';
          } else if (idx === selectedRange.end) {
            selectedPosition = 'last';
          } else {
            selectedPosition = 'middle';
          }
        }

        const memberInfo = groupMembersMap ? groupMembersMap[msg.sender_id] : undefined;
        const senderUser = memberInfo?.user || msg.sender;
        const groupNickname = memberInfo?.nickname;

        return (
          <MessageBubble
            key={msg.id || idx}
            msg={msg}
            currentUserId={currentUserId}
            currentUser={currentUser}
            partnerUser={partnerUser}
            senderUser={senderUser}
            isGroup={isGroup}
            groupNickname={groupNickname}
            groupMembersMap={groupMembersMap}
            renderIPFSFileCard={renderIPFSFileCard}
            onReaction={onReaction}
            onViewProfile={onViewProfile}
            onContextMenu={onContextMenu}
            onViewReactions={onViewReactions}
            isScreenshotMode={isScreenshotMode}
            isSelectedForScreenshot={isSelected}
            selectedPosition={selectedPosition}
            onToggleSelectScreenshot={() => onToggleSelectScreenshot && onToggleSelectScreenshot(msg, idx)}
            highlightKeyword={highlightKeyword}
            isSearchHighlighted={highlightedMessageId === msg.id}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
