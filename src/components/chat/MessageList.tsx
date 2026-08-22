import React, { useRef, useEffect } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import styles from '../ChatWindow.module.css';

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  partnerUser?: User;
  isGroup?: boolean;
  groupMembersMap?: Record<number, { user?: User; nickname?: string }>;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
  onReaction?: (messageId: number, emoji: string) => void;
  onViewProfile?: (user: User) => void;
  onContextMenu?: (e: React.MouseEvent, msg: Message) => void;
  isScreenshotMode?: boolean;
  selectedRange?: { start: number; end: number } | null;
  onToggleSelectScreenshot?: (msg: Message, index: number) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  partnerUser,
  isGroup = false,
  groupMembersMap,
  renderIPFSFileCard,
  onReaction,
  onViewProfile,
  onContextMenu,
  isScreenshotMode = false,
  selectedRange = null,
  onToggleSelectScreenshot,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isScreenshotMode) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScreenshotMode]);

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
            partnerUser={partnerUser}
            senderUser={senderUser}
            isGroup={isGroup}
            groupNickname={groupNickname}
            renderIPFSFileCard={renderIPFSFileCard}
            onReaction={onReaction}
            onViewProfile={onViewProfile}
            onContextMenu={onContextMenu}
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
