// Context: [聊天搜尋領域 Hook] 封裝訊息關鍵字匹配、上下一筆定位導航與 DOM 釘死脈衝跳轉

import { useState, useMemo, useEffect } from 'react';
import { Message } from '../types';

export function useChatSearch(currentMessages: Message[]) {
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchCurrentMatchIndex, setSearchCurrentMatchIndex] = useState<number>(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  // 搜尋關鍵字匹配 (排除檔案/語音訊息，僅搜尋純文字)
  const matchedMessageIds = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return [];
    return currentMessages
      .filter((m) => {
        if (m.filePayload || (m.content && m.content.startsWith('[IPFS_FILE]'))) return false;
        if (m.content && m.content.toLowerCase().includes(q)) return true;
        return false;
      })
      .map((m) => m.id!)
      .filter(Boolean);
  }, [currentMessages, searchKeyword]);

  // 跳至指定搜尋結果
  const jumpToMatchedMessage = (index: number) => {
    if (matchedMessageIds.length === 0) return;
    const boundedIndex = (index + matchedMessageIds.length) % matchedMessageIds.length;
    setSearchCurrentMatchIndex(boundedIndex);
    const targetId = matchedMessageIds[boundedIndex];
    setHighlightedMessageId(targetId);

    const el = document.getElementById(`message-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
    }, 800);
  };

  useEffect(() => {
    if (matchedMessageIds.length > 0) {
      jumpToMatchedMessage(0);
    } else {
      setHighlightedMessageId(null);
    }
  }, [matchedMessageIds.length, searchKeyword]);

  const closeSearch = () => {
    setShowSearch(false);
    setSearchKeyword('');
    setHighlightedMessageId(null);
  };

  return {
    showSearch,
    setShowSearch,
    searchKeyword,
    setSearchKeyword,
    searchCurrentMatchIndex,
    matchedMessageIds,
    highlightedMessageId,
    jumpToMatchedMessage,
    closeSearch,
  };
}
