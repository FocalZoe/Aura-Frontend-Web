// Context: [對話截圖領域 Hook] 封裝連續範圍選取、雙向擴展/收縮、匿名模式與彈窗狀態

import { useState } from 'react';
import { Message } from '../types';

export function useChatScreenshot(currentMessages: Message[]) {
  const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(false);
  const [screenshotRange, setScreenshotRange] = useState<{ start: number; end: number } | null>(null);
  const [isAnonymousScreenshot, setIsAnonymousScreenshot] = useState<boolean>(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState<boolean>(false);

  // 啟動對話截圖
  const handleStartScreenshot = (initialMsg?: Message) => {
    setIsScreenshotMode(true);
    if (initialMsg && initialMsg.id) {
      const idx = currentMessages.findIndex((m) => m.id === initialMsg.id);
      if (idx !== -1) {
        setScreenshotRange({ start: idx, end: idx });
        return;
      }
    }
    if (currentMessages.length > 0) {
      setScreenshotRange({ start: 0, end: currentMessages.length - 1 });
    }
  };

  // 點擊訊息切換/擴展連續範圍
  const handleToggleSelectScreenshot = (msg: Message, clickedIndex?: number) => {
    const idx = typeof clickedIndex === 'number' ? clickedIndex : currentMessages.findIndex((m) => m.id === msg.id);
    if (idx === -1) return;

    if (!screenshotRange) {
      setScreenshotRange({ start: idx, end: idx });
      return;
    }

    if (idx < screenshotRange.start) {
      setScreenshotRange({ start: idx, end: screenshotRange.end });
    } else if (idx > screenshotRange.end) {
      setScreenshotRange({ start: screenshotRange.start, end: idx });
    } else {
      // 點擊既有區間內：收縮範圍
      const distStart = idx - screenshotRange.start;
      const distEnd = screenshotRange.end - idx;
      if (distStart <= distEnd) {
        setScreenshotRange({ start: idx + 1 > screenshotRange.end ? idx : idx + 1, end: screenshotRange.end });
      } else {
        setScreenshotRange({ start: screenshotRange.start, end: idx - 1 < screenshotRange.start ? idx : idx - 1 });
      }
    }
  };

  // 取消截圖模式
  const handleCancelScreenshot = () => {
    setIsScreenshotMode(false);
    setScreenshotRange(null);
  };

  // 產生截圖預覽
  const handleGenerateScreenshot = () => {
    if (!screenshotRange) return;
    setShowScreenshotModal(true);
  };

  return {
    isScreenshotMode,
    screenshotRange,
    isAnonymousScreenshot,
    setIsAnonymousScreenshot,
    showScreenshotModal,
    setShowScreenshotModal,
    handleStartScreenshot,
    handleToggleSelectScreenshot,
    handleCancelScreenshot,
    handleGenerateScreenshot,
  };
}
