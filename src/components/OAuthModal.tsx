// Context: OAuthModal 重構 - 套用通用 BaseModal
import React, { useState, FormEvent } from 'react';
import { CheckCircle, AtSign, User as UserIcon } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './OAuthModal.module.css';

interface OAuthModalProps {
  isOpen: boolean;
  provider: 'google' | 'apple' | null;
  onClose: () => void;
  onComplete: (provider: 'google' | 'apple', providerId: string, email: string, accountId: string, displayName: string) => Promise<void>;
}

export const OAuthModal: React.FC<OAuthModalProps> = ({
  isOpen,
  provider,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<'auth' | 'account_id'>('auth');
  const [email, setEmail] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !provider) return null;

  const providerName = provider === 'google' ? 'Google' : 'Apple';
  const providerBg = provider === 'google' ? 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)' : '#000000';

  const handleSimulateOAuthSelect = (simulatedEmail: string, simulatedName: string) => {
    setEmail(simulatedEmail);
    setDisplayName(simulatedName);
    setStep('account_id');
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanAccountId = accountId.trim();
    if (!cleanAccountId) {
      setError('帳號 ID 為必填欄位，請設定您唯一的 @帳號ID');
      return;
    }

    setSubmitting(true);
    try {
      const providerId = `${provider}_${Date.now()}`;
      await onComplete(provider, providerId, email, cleanAccountId, displayName);
      onClose();
    } catch (err: any) {
      setError(err.message || '認證或帳號 ID 設定失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className={styles.providerBadge} style={{ background: providerBg }}>
        {providerName.charAt(0)}
      </div>
      <span>{step === 'auth' ? `使用 ${providerName} 帳號登入` : '設定 Aura 帳號 ID'}</span>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="480px"
    >
      {error && <div className={styles.errorAlert}>{error}</div>}

      {step === 'auth' ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            請選擇欲授權登入 Aura 的 {providerName} 帳戶：
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="uiBtnSecondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                height: 'auto',
                width: '100%'
              }}
              onClick={() => handleSimulateOAuthSelect(
                provider === 'google' ? 'user.demo@gmail.com' : 'user.demo@icloud.com',
                provider === 'google' ? 'Google 測試用戶' : 'Apple 測試用戶'
              )}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {provider === 'google' ? 'Google 測試用戶' : 'Apple 測試用戶'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {provider === 'google' ? 'user.demo@gmail.com' : 'user.demo@icloud.com'}
                </div>
              </div>
              <CheckCircle size={18} style={{ color: '#10B981' }} />
            </button>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>自訂測試 Email：</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  className="uiInput"
                  type="email"
                  placeholder="example@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="uiBtnPrimary"
                  style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
                  onClick={() => {
                    if (!email.includes('@')) {
                      setError('請輸入有效的 Email 地址');
                      return;
                    }
                    handleSimulateOAuthSelect(email, email.split('@')[0]);
                  }}
                >
                  繼續
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '10px',
            padding: '12px',
            fontSize: '0.85rem',
            color: 'var(--text-primary)'
          }}>
            已完成 {providerName} 授權：<strong>{email}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <AtSign size={15} />
              <span>帳號 ID (必填)</span>
              <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: '600',
                color: 'var(--accent-color)'
              }}>@</span>
              <input
                className="uiInput"
                type="text"
                placeholder="請輸入唯一的帳號 ID (如 alex_dev)..."
                value={accountId}
                onChange={(e) => setAccountId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                style={{ paddingLeft: '32px' }}
                required
              />
            </div>
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              將顯示為 @{accountId || 'account_id'}（僅支援英文字母、數字與底線）
            </small>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <UserIcon size={15} />
              <span>帳號顯示名稱 (選填)</span>
            </label>
            <input
              className="uiInput"
              type="text"
              placeholder="例如：Alex Chen (未填將預設顯示帳號 ID)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="uiBtnSecondary"
              style={{ flex: 1 }}
              onClick={() => setStep('auth')}
            >
              返回上一步
            </button>
            <button
              type="submit"
              className="uiBtnPrimary"
              style={{ flex: 1 }}
              disabled={submitting}
            >
              {submitting ? '處理中...' : '完成註冊並登入'}
            </button>
          </div>
        </form>
      )}
    </BaseModal>
  );
};

