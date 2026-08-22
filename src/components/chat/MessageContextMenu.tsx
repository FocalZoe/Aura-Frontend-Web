// Context: [訊息氣泡右鍵選單] 整合快捷 Emoji、查看表情名單、獨立全表情彈窗觸發、對話截圖、複製文字、30 分鐘內編輯/收回與單方刪除
import React, { useEffect, useRef } from 'react';
import { Message, User } from '../../types';
import { Copy, Edit2, RotateCcw, Trash2, Camera, SmilePlus, Smile } from 'lucide-react';
import styles from './MessageContextMenu.module.css';

export interface MessageContextMenuProps {
  x: number;
  y: number;
  message: Message;
  currentUserId: number;
  onClose: () => void;
  onReaction: (messageId: number, emoji: string) => void;
  onStartScreenshot: (message: Message) => void;
  onCopy: (content: string) => void;
  onEdit?: (message: Message) => void;
  onRecall?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onViewReactions?: (message: Message) => void;
  onOpenFullEmojiPicker?: (message: Message, x: number, y: number) => void;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  x,
  y,
  message,
  currentUserId,
  onClose,
  onReaction,
  onStartScreenshot,
  onCopy,
  onEdit,
  onRecall,
  onDelete,
  onViewReactions,
  onOpenFullEmojiPicker,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelf = Number(message.sender_id) === Number(currentUserId);
  const isRecalled = message.is_recalled || message.content === '[RECALLED]';
  const hasReactions = Boolean(message.reactions && message.reactions.length > 0);

  // 判斷是否在 30 分鐘以內
  const isWithin30Min = React.useMemo(() => {
    if (!message.timestamp) return false;
    try {
      const msgTime = new Date(message.timestamp).getTime();
      const now = Date.now();
      return now - msgTime <= 30 * 60 * 1000;
    } catch {
      return false;
    }
  }, [message.timestamp]);

  // 點擊選單外部自動關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 自適應視窗邊界調整座標
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 220;
    const menuHeight = 240;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + menuWidth > winWidth - 10) {
      posX = winWidth - menuWidth - 10;
    }
    if (posY + menuHeight > winHeight - 10) {
      posY = winHeight - menuHeight - 10;
    }

    return { x: Math.max(10, posX), y: Math.max(10, posY) };
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={styles.menuContainer}
      style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 頂部快捷表情反應列 + 游標旁彈出全套表情按鈕 */}
      {message.id && !isRecalled && (
        <div className={styles.emojiRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.emojiBtn}
              onClick={() => {
                onReaction(message.id!, emoji);
                onClose();
              }}
              title={`反應 ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <button
            type="button"
            className={styles.moreEmojiBtn}
            onClick={(e) => {
              if (onOpenFullEmojiPicker) {
                onOpenFullEmojiPicker(message, e.clientX, e.clientY);
              }
              onClose();
            }}
            title="全部表情符號 (游標旁展開)"
          >
            <SmilePlus size={16} />
          </button>
        </div>
      )}

      <div className={styles.menuDivider} />

      {/* 查看表情反應 (若有表情反應) */}
      {hasReactions && onViewReactions && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onViewReactions(message);
            onClose();
          }}
        >
          <Smile size={15} color="var(--accent-color)" />
          <span>查看表情反應 ({message.reactions?.length})</span>
        </button>
      )}

      {/* 對話截圖 */}
      <button
        type="button"
        className={styles.menuItem}
        onClick={() => {
          onStartScreenshot(message);
          onClose();
        }}
      >
        <Camera size={15} />
        <span>對話截圖</span>
      </button>

      {/* 複製文字 */}
      {!isRecalled && message.content && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onCopy(message.content);
            onClose();
          }}
        >
          <Copy size={15} />
          <span>複製訊息</span>
        </button>
      )}

      {/* 編輯訊息 (限 30 分鐘以內發送者本人) */}
      {isSelf && isWithin30Min && !isRecalled && onEdit && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onEdit(message);
            onClose();
          }}
        >
          <Edit2 size={15} />
          <span>編輯訊息</span>
        </button>
      )}

      {/* 收回訊息 (限 30 分鐘以內發送者本人) */}
      {isSelf && isWithin30Min && !isRecalled && onRecall && (
        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onRecall(message);
            onClose();
          }}
        >
          <RotateCcw size={15} />
          <span>收回訊息</span>
        </button>
      )}

      {/* 刪除訊息 (單方本地刪除) */}
      {onDelete && (
        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onDelete(message);
            onClose();
          }}
        >
          <Trash2 size={15} />
          <span>刪除訊息</span>
        </button>
      )}
    </div>
  );
};
