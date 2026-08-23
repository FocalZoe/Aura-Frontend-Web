import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Smile, Sparkles, Image as ImageIcon, Store, ExternalLink, Palette } from 'lucide-react';
import styles from './EmojiPickerPopover.module.css';

interface EmojiPickerPopoverProps {
  x: number;
  y: number;
  isOpen: boolean;
  mode?: 'reaction' | 'input';
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker?: (sticker: { id: string; emoji: string; label: string }) => void;
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
      '🐡', '🐠', '🐟', '🐬', '🐳', '鯊', '🐊'
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
  mode = 'reaction',
  onClose,
  onSelectEmoji,
  onSelectSticker,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [mainTab, setMainTab] = useState<'emoji' | 'stickers' | 'custom_emoji'>('emoji');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('smileys');

  // 若切換為 reaction 模式，強制鎖定在 emoji
  useEffect(() => {
    if (mode === 'reaction') {
      setMainTab('emoji');
    }
  }, [mode]);

  // 點擊外部關閉
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
    const width = 340;
    const height = mode === 'reaction' ? 380 : 440;
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
  }, [x, y, mode]);

  // 搜尋過濾
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((emoji) => emoji.includes(query)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery]);

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
      {/* 模式判斷：僅在輸入模式 (mode="input") 下顯示 LINE 風格三大主系統 Tabs */}
      {mode === 'input' && (
        <div className={styles.mainSystemTabs}>
          <button
            type="button"
            className={`${styles.mainTabBtn} ${mainTab === 'emoji' ? styles.mainTabBtnActive : ''}`}
            onClick={() => setMainTab('emoji')}
          >
            <Smile size={14} />
            <span>表情 Emoji</span>
          </button>
          <button
            type="button"
            className={`${styles.mainTabBtn} ${mainTab === 'stickers' ? styles.mainTabBtnActive : ''}`}
            onClick={() => setMainTab('stickers')}
          >
            <ImageIcon size={14} />
            <span>貼圖 Stickers</span>
          </button>
          <button
            type="button"
            className={`${styles.mainTabBtn} ${mainTab === 'custom_emoji' ? styles.mainTabBtnActive : ''}`}
            onClick={() => setMainTab('custom_emoji')}
          >
            <Sparkles size={14} />
            <span>表情貼 Custom</span>
          </button>
        </div>
      )}

      {/* 頂部搜尋列 (Emoji 模式下呈現) */}
      {mainTab === 'emoji' && (
        <div className={styles.searchHeader}>
          <div className={styles.searchInputWrapper}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="搜尋表情符號..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Emoji 分類快速導航 Tabs */}
      {mainTab === 'emoji' && !searchQuery && (
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

      {/* 滾動內容主體 */}
      <div ref={scrollBodyRef} className={styles.emojiGridBody}>
        {/* Tab 1: 標準 Emoji 網格 */}
        {mainTab === 'emoji' && (
          filteredCategories.length === 0 ? (
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
          )
        )}

        {/* Tab 2: 貼圖 Stickers (含創作者貼圖商店 Placeholder) */}
        {mainTab === 'stickers' && (
          <div style={{ padding: '4px 0' }}>
            {/* 創作者市場宣傳卡片 Placeholder */}
            <div className={styles.creatorMarketCard}>
              <div className={styles.marketHeader}>
                <span className={styles.marketTitle}>
                  <Store size={15} color="#38bdf8" />
                  <span>Aura 貼圖商店 & 創作者市集</span>
                </span>
                <span className={styles.marketBadge}>即將登場</span>
              </div>
              <span className={styles.marketDesc}>
                在創作者網站自製專屬貼圖並上架商店，與全球用戶分享並賺取收益！
              </span>
              <div className={styles.marketFooter}>
                <span className={styles.marketTag}>#創作者分成 #原創貼圖</span>
                <button type="button" className={styles.marketBtn} onClick={() => {}}>
                  前往創作者中心
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Palette size={32} color="var(--accent-color, #38bdf8)" style={{ opacity: 0.8, marginBottom: '8px' }} />
              <div>尚未擁有貼圖包</div>
              <div style={{ fontSize: '0.74rem', marginTop: '4px', opacity: 0.8 }}>
                未來可於貼圖商店選購或在創作者中心上架專屬貼圖
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: 表情貼 Custom Emoji (含創作者表情貼市集 Placeholder) */}
        {mainTab === 'custom_emoji' && (
          <div style={{ padding: '4px 0' }}>
            {/* 創作者表情貼宣傳卡片 Placeholder */}
            <div className={styles.creatorMarketCard}>
              <div className={styles.marketHeader}>
                <span className={styles.marketTitle}>
                  <Sparkles size={15} color="#ec4899" />
                  <span>Aura 表情貼商店 (Custom Emoji)</span>
                </span>
                <span className={styles.marketBadge}>即將登場</span>
              </div>
              <span className={styles.marketDesc}>
                微型行內表情貼可在文字中穿插使用，創作者可自訂繪製並上架販售。
              </span>
              <div className={styles.marketFooter}>
                <span className={styles.marketTag}>#行內表情貼 #主題商店</span>
                <button type="button" className={styles.marketBtn} onClick={() => {}}>
                  探索表情貼市集
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Sparkles size={32} color="#ec4899" style={{ opacity: 0.8, marginBottom: '8px' }} />
              <div>尚未擁有自訂表情貼</div>
              <div style={{ fontSize: '0.74rem', marginTop: '4px', opacity: 0.8 }}>
                未來可在表情貼商店選購或在文字中穿插使用
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
