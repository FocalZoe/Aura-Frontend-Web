// Context: [對話截圖] 截圖模式控制列 (支援連續區間計數、匿名模式切換與生成)
import React from 'react';
import { Camera, X, Shield, ShieldOff, Check } from 'lucide-react';
import styles from './ScreenshotToolbar.module.css';

interface ScreenshotToolbarProps {
  selectedCount: number;
  startIndex: number;
  endIndex: number;
  isAnonymous: boolean;
  onToggleAnonymous: () => void;
  onGenerate: () => void;
  onCancel: () => void;
}

export const ScreenshotToolbar: React.FC<ScreenshotToolbarProps> = ({
  selectedCount,
  startIndex,
  endIndex,
  isAnonymous,
  onToggleAnonymous,
  onGenerate,
  onCancel,
}) => {
  return (
    <div className={styles.toolbarWrapper}>
      <div className={styles.infoSection}>
        <div className={styles.badge}>截圖模式</div>
        <span className={styles.countText}>
          {selectedCount > 0
            ? `已連續選取 ${selectedCount} 則對話 (第 ${startIndex + 1} ~ ${endIndex + 1} 則)`
            : '點擊訊息氣泡以選擇截圖範圍'}
        </span>
      </div>

      <div className={styles.actionSection}>
        {/* 匿名模式開關 */}
        <button
          type="button"
          className={`${styles.anonymousToggleBtn} ${isAnonymous ? styles.anonymousActive : ''}`}
          onClick={onToggleAnonymous}
          title={isAnonymous ? '已開啟匿名模式 (隱藏真實名稱與頭像)' : '點擊開啟匿名模式'}
        >
          {isAnonymous ? <Shield size={15} /> : <ShieldOff size={15} />}
          <span>{isAnonymous ? '匿名模式已開啟' : '匿名模式'}</span>
        </button>

        <button
          type="button"
          className="uiBtnSecondary"
          onClick={onCancel}
          style={{ height: '36px', padding: '0 14px', fontSize: '0.86rem' }}
        >
          <X size={15} />
          <span>取消</span>
        </button>

        <button
          type="button"
          className="uiBtnPrimary"
          onClick={onGenerate}
          disabled={selectedCount === 0}
          style={{ height: '36px', padding: '0 16px', fontSize: '0.86rem' }}
        >
          <Camera size={15} />
          <span>產生截圖</span>
        </button>
      </div>
    </div>
  );
};
