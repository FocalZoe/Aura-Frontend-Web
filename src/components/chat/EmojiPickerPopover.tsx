// Context: 獨立 Emoji / 貼圖 / 顏文字全能浮動選取器 (支援主系統分頁、全套 Emoji、日系顏文字、主題貼圖、即時搜尋與邊界自適應)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Smile, Sparkles, Image as ImageIcon } from 'lucide-react';
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

const KAOMOJI_LIST = [
  '(｡♥‿♥｡)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(✿◠‿◠)', '(つ≧▽≦)つ',
  '(•‿•)', '(｡•̀ᴗ-)✧', '(づ｡◕‿‿◕｡)づ', 'ʕ•ᴥ•ʔ',
  '(ノಠ益ಠ)ノ彡┻━┻', '¯\\_(ツ)_/¯', '(╯°□°)╯︵ ┻━┻', '(⊙_⊙)',
  '(ಥ﹏ಥ)', '(╥﹏╥)', '(T_T)', '(ง •̀_•́)ง',
  '(•̀o•́)ง', '(◕‿◕✿)', '(^人^)', '(~˘▾˘)~',
  '(*^▽^*)', '(o^▽^o)', '٩(◕‿◕｡)۶', '(´∀｀*)'
];

const STICKER_PACKS = [
  { id: 'aura_cat_1', emoji: '🐱', label: '嗨！' },
  { id: 'aura_cat_2', emoji: '😻', label: '大心' },
  { id: 'aura_cat_3', emoji: '😹', label: '笑哭' },
  { id: 'aura_cat_4', emoji: '😿', label: '委屈' },
  { id: 'aura_dog_1', emoji: '🐶', label: '期待' },
  { id: 'aura_dog_2', emoji: '🐕', label: '衝啊' },
  { id: 'aura_dog_3', emoji: '🐾', label: '讚啦' },
  { id: 'aura_dog_4', emoji: '🦴', label: '開動' },
  { id: 'aura_fox_1', emoji: '🦊', label: '聰明' },
  { id: 'aura_bear_1', emoji: '🐻', label: '抱抱' },
  { id: 'aura_panda_1', emoji: '🐼', label: '發呆' },
  { id: 'aura_rabbit_1', emoji: '🐰', label: '蹦蹦跳' },
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
  const [mainTab, setMainTab] = useState<'emoji' | 'stickers' | 'kaomoji'>('emoji');
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
    const width = 340;
    const height = 420;
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

  const filteredKaomoji = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return KAOMOJI_LIST;
    return KAOMOJI_LIST.filter((k) => k.includes(query));
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
      {/* 頂部主系統分頁 Tabs (LINE 風格) */}
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
          className={`${styles.mainTabBtn} ${mainTab === 'kaomoji' ? styles.mainTabBtnActive : ''}`}
          onClick={() => setMainTab('kaomoji')}
        >
          <Sparkles size={14} />
          <span>顏文字 Kaomoji</span>
        </button>
      </div>

      {/* 頂部搜尋列 */}
      <div className={styles.searchHeader}>
        <div className={styles.searchInputWrapper}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={
              mainTab === 'emoji'
                ? '搜尋表情符號...'
                : mainTab === 'kaomoji'
                ? '搜尋日系顏文字...'
                : '搜尋貼圖...'
            }
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

        {mainTab === 'kaomoji' && (
          filteredKaomoji.length === 0 ? (
            <div className={styles.emptyTip}>找不到符合的顏文字</div>
          ) : (
            <div className={styles.kaomojiGrid}>
              {filteredKaomoji.map((kao) => (
                <button
                  key={kao}
                  type="button"
                  className={styles.kaomojiItem}
                  onClick={() => {
                    onSelectEmoji(kao);
                    onClose();
                  }}
                  title={kao}
                >
                  {kao}
                </button>
              ))}
            </div>
          )
        )}

        {mainTab === 'stickers' && (
          <div className={styles.stickerGrid}>
            {STICKER_PACKS.map((stk) => (
              <button
                key={stk.id}
                type="button"
                className={styles.stickerItem}
                onClick={() => {
                  onSelectEmoji(stk.emoji);
                  onClose();
                }}
                title={stk.label}
              >
                <span className={styles.stickerEmoji}>{stk.emoji}</span>
                <span className={styles.stickerLabel}>{stk.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
