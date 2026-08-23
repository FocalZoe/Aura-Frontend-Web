// Context: 聊天室內訊息即時搜尋列 (支援上下筆導覽、即時計數與鍵盤快速鍵)
import React, { useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import styles from './ChatSearchBar.module.css';

interface ChatSearchBarProps {
  keyword: string;
  onKeywordChange: (val: string) => void;
  currentIndex: number;
  matchCount: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const ChatSearchBar: React.FC<ChatSearchBarProps> = ({
  keyword,
  onKeywordChange,
  currentIndex,
  matchCount,
  onNext,
  onPrev,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    }
  };

  return (
    <div className={styles.searchBarContainer} onClick={(e) => e.stopPropagation()}>
      <div className={styles.searchIconWrapper}>
        <Search size={16} />
      </div>

      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder="搜尋聊天訊息或檔案名稱..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {keyword.trim() && (
        <span className={styles.counterBadge}>
          {matchCount > 0 ? `${currentIndex + 1} / ${matchCount}` : '無結果'}
        </span>
      )}

      <div className={styles.navBtnGroup}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onPrev}
          disabled={matchCount === 0}
          title="上一筆 (Shift + Enter)"
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onNext}
          disabled={matchCount === 0}
          title="下一筆 (Enter)"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className={styles.divider} />

      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        title="關閉搜尋 (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  );
};
