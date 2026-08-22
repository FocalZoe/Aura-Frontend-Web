import React, { useRef, useEffect } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import styles from '../ChatWindow.module.css';

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  partnerUser?: User;
  renderIPFSFileCard?: (msg: Message) => React.ReactNode;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  partnerUser,
  renderIPFSFileCard,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.chatMessages}>
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id || idx}
          msg={msg}
          currentUserId={currentUserId}
          partnerUser={partnerUser}
          renderIPFSFileCard={renderIPFSFileCard}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
