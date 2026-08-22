import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { ShieldCheck, RefreshCw, Unlock, CheckCircle } from 'lucide-react';
import { getLocalPrivateKey, getLocalPrivateKeySync } from '../../utils/crypto';
import styles from '../SettingsModal.module.css';

interface SecurityPinTabProps {
  user: User | null;
  onOpenPinModal: (mode: 'setup' | 'enter' | 'confirm-reset') => void;
}

export const SecurityPinTab: React.FC<SecurityPinTabProps> = ({
  user,
  onOpenPinModal,
}) => {
  const [hasLocalKey, setHasLocalKey] = useState<boolean>(() => {
    return !!(user?.id && getLocalPrivateKeySync(user.id));
  });

  useEffect(() => {
    if (user?.id) {
      getLocalPrivateKey(user.id).then((key) => {
        setHasLocalKey(!!key);
      });
    }
  }, [user?.id]);

  const hasPublicKey = !!user?.public_key || !!user?.has_backup_key || !!user?.encrypted_private_key;
  const hasEncryptedKey = !!user?.encrypted_private_key || !!user?.has_backup_key;

  return (
    <div className={styles.settingsTabForm}>
      <div className={styles.securityInfoBox}>
        <ShieldCheck size={24} className={styles.accentIcon} />
        <div>
          <h4>對話點對點加密保護</h4>
          <p>您的訊息在發送前均已在裝置上完成加密保護，確保僅有您與對方能夠讀取聊天內容。</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        <div className={styles.securityStatusCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>安全防護狀態</span>
            <span className={`${styles.statusBadge} ${hasPublicKey ? styles.statusBadgeGreen : styles.statusBadgeOrange}`}>
              {hasPublicKey ? (
                <>
                  <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  已防護 (金鑰運作中)
                </>
              ) : (
                '尚未啟用'
              )}
            </span>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>雲端安全備份</span>
            <span className={`${styles.statusBadge} ${hasEncryptedKey ? styles.statusBadgeGreen : styles.statusBadgeOrange}`}>
              {hasEncryptedKey ? '已備份' : '未備份'}
            </span>
          </div>

          <div className={styles.infoRow} style={{ borderBottom: 'none' }}>
            <span className={styles.infoLabel}>本機裝置狀態</span>
            <span className={`${styles.statusBadge} ${hasLocalKey ? styles.statusBadgeGreen : styles.statusBadgeOrange}`}>
              {hasLocalKey ? '已解鎖 (安全連線中)' : '未解鎖 (需輸入 PIN 碼)'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <div className={styles.settingOptionRow}>
          <div className={styles.optionLabel}>
            <span className={styles.optionTitle}>PIN 碼安全設定</span>
            <span className={styles.optionDesc}>
              {hasEncryptedKey ? '重新設定您的 4 位數安全 PIN 碼' : '設定 4 位數 PIN 碼以啟用完整安全保護'}
            </span>
          </div>
          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => onOpenPinModal(hasEncryptedKey ? 'confirm-reset' : 'setup')}
          >
            <RefreshCw size={14} style={{ marginRight: '6px', display: 'inline' }} />
            {hasEncryptedKey ? '重置 PIN 碼' : '設定 4 位數 PIN'}
          </button>
        </div>

        {!hasLocalKey && hasEncryptedKey && (
          <div className={styles.settingOptionRow}>
            <div className={styles.optionLabel}>
              <span className={styles.optionTitle}>解鎖本機通訊</span>
              <span className={styles.optionDesc}>輸入您的 4 位數 PIN 碼解鎖本機加密功能</span>
            </div>
            <button
              type="button"
              className={styles.optionBtn}
              style={{ background: 'var(--accent-color)', color: '#ffffff' }}
              onClick={() => onOpenPinModal('enter')}
            >
              <Unlock size={14} style={{ marginRight: '6px', display: 'inline' }} />
              輸入 PIN 解鎖
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
