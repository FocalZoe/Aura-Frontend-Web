// Context: 獨立全表情符號浮動選取器 (全套 Emoji 分組、關鍵字搜尋、游標定位與邊界自適應)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import styles from './EmojiPickerPopover.module.css';

interface EmojiPickerPopoverProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: '笑臉與表情',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣',
      '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰',
      '😍', '🤩', '😘', '😗', '😚', '😙', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶',
      '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
      '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
      '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫',
      '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
      '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
      '👽', '👾', '🤖'
    ],
  },
  {
    id: 'gestures',
    name: '手勢與人物',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌',
      '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
      '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐',
      '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪',
      '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
      '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️'
    ],
  },
  {
    id: 'hearts',
    name: '愛心與浪漫',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎',
      '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '💋', '💌',
      '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻'
    ],
  },
  {
    id: 'animals',
    name: '動物與自然',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻',
      '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸',
      '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅',
      '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
      '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🐢',
      '🐍', '🦎', '🐙', '🦑', '🦐', '🦞', '🦀',
      '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊'
    ],
  },
  {
    id: 'food',
    name: '食物與飲料',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉',
      '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
      '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔',
      '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄',
      '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖',
      '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗',
      '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪',
      '🌮', '🌯', '🫔', '🥙', '🧆', '🍜', '🍝',
      '🍣', '🍱', '🍦', '🍧', '🍨', '🍩', '🍪',
      '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭',
      '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻'
    ],
  },
  {
    id: 'activities',
    name: '活動與運動',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐',
      '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒',
      '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁',
      '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹',
      '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂',
      '🏋️', '🤼', '🤸', '🤺', '🤾', '🧗', '🎯',
      '🎮', '🕹️', '🎰', '🎲', '🧩', '🎨', '🎬',
      '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺'
    ],
  },
  {
    id: 'objects',
    name: '物品與科技',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🏮', '🪔', '📱', '📲', '💻',
      '⌨️', '🖥️', '🖨️', '🖱️', '💽', '💾', '💿',
      '📀', '📷', '📸', '📹', '🎥', '📽️', '🎞️',
      '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️',
      '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛',
      '⏳', '📡', '🔋', '🔌', '💎', '🔑', '🗝️',
      '🔨', '🪓', '🔧', '🪛', '🔩', '⚙️', '🗜️',
      '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️'
    ],
  },
  {
    id: 'symbols',
    name: '符號與標誌',
    icon: '✨',
    emojis: [
      '✨', '⭐', '🌟', '💫', '💥', '🔥', '⚡',
      '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌧️',
      '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️',
      '💨', '💧', '💦', '🫧', '☂️', '☔', '⛱️',
      '⚡', '🌀', '🌊', '💯', '💢', '♨️', '💈',
      '🛑', '⛔', '🚫', '⚠️', '🚸', '🔰', '♻️',
      '✅', '❌', '❓', '❗', '💤', '🎵', '🎶'
    ],
  },
];

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  x,
  y,
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('smileys');

  // 點擊外部自動關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // 自適應視窗邊界定位
  const adjustedPosition = useMemo(() => {
    const width = 320;
    const height = 380;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + width > winWidth - 12) {
      posX = winWidth - width - 12;
    }
    if (posY + height > winHeight - 12) {
      posY = winHeight - height - 12;
    }

    return { x: Math.max(12, posX), y: Math.max(12, posY) };
  }, [x, y]);

  // 搜尋過濾
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((emoji) => emoji.includes(query)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery]);

  // 點擊分類導覽 Tab 跳轉到對應分組
  const handleScrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const targetElement = document.getElementById(`emoji-cat-${catId}`);
    if (targetElement && scrollBodyRef.current) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={styles.popoverContainer}
      style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 頂部搜尋列 */}
      <div className={styles.searchHeader}>
        <div className={styles.searchInputWrapper}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="搜尋全部表情符號..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 分類快速導航 Tabs */}
      {!searchQuery && (
        <div className={styles.categoryTabs}>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catBtnActive : ''}`}
              onClick={() => handleScrollToCategory(cat.id)}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji 網格主體 */}
      <div ref={scrollBodyRef} className={styles.emojiGridBody}>
        {filteredCategories.length === 0 ? (
          <div className={styles.emptyTip}>找不到符合的表情符號</div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id} id={`emoji-cat-${cat.id}`} className={styles.categoryGroup}>
              <span className={styles.categoryTitle}>{cat.name}</span>
              <div className={styles.emojiGrid}>
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.emojiItem}
                    onClick={() => {
                      onSelectEmoji(emoji);
                      onClose();
                    }}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
