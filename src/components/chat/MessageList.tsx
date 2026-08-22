import React, { useRef, useEffect } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import styles from '../ChatWindow.module.css';

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
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isScreenshotMode && !loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScreenshotMode, loading]);

  if (loading && messages.length === 0) {
    return (
      <div className={styles.chatSkeletonList}>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowOther}`}>
          <div className={styles.chatSkeletonAvatar} />
          <div className={styles.chatSkeletonBubble} style={{ width: '180px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowSelf}`}>
          <div className={styles.chatSkeletonBubble} style={{ width: '240px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowOther}`}>
          <div className={styles.chatSkeletonAvatar} />
          <div className={styles.chatSkeletonBubble} style={{ width: '140px' }} />
        </div>
        <div className={`${styles.chatSkeletonRow} ${styles.chatSkeletonRowSelf}`}>
          <div className={styles.chatSkeletonBubble} style={{ width: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatMessages}>
      {messages.map((msg, idx) => {
        const isSelected = !!(
          selectedRange &&
          idx >= selectedRange.start &&
          idx <= selectedRange.end
        );

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
            onToggleSelectScreenshot={() => onToggleSelectScreenshot && onToggleSelectScreenshot(msg, idx)}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
