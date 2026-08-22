import React, { useState } from 'react';
import { User } from '../../types';
import { Check, Loader2 } from 'lucide-react';
import styles from '../SettingsModal.module.css';

interface ProfileSettingsTabProps {
  user: User | null;
  onUpdateProfile: (accountID: string, displayName: string) => Promise<void>;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  user,
  onUpdateProfile,
}) => {
  const [accountId, setAccountId] = useState<string>(user?.account_id || '');
  const [displayName, setDisplayName] = useState<string>(user?.display_name || '');
  const [saving, setSaving] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile(accountId, displayName);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.settingsTabForm} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>帳號 ID</label>
        <div className={styles.inputWithPrefix}>
          <span className={styles.prefix}>@</span>
          <input
            type="text"
            className={styles.settingsInput}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          />
        </div>
        <small className={styles.helpText}>好友需透過 @{accountId} 搜尋並加您為好友。</small>
      </div>

      <div className={styles.formGroup}>
        <label>顯示名稱</label>
        <input
          type="text"
          className={styles.settingsInput}
          value={displayName}
          placeholder="如：Alex Chen"
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label>電子郵件</label>
        <input
          type="email"
          className={styles.settingsInput}
          value={user?.email || ''}
          disabled
        />
      </div>

      <button type="submit" className={styles.saveSettingsBtn} disabled={saving}>
        {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
        <span>儲存修改</span>
      </button>
    </form>
  );
};
