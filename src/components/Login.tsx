// TEAM_012: Login.tsx 重構 - 套用 Module CSS
import React, { useState, useContext, FormEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { MessageSquare, ArrowRight, AtSign, Mail, Lock, User as UserIcon } from 'lucide-react';
import { OAuthModal } from './OAuthModal';
import styles from './Login.module.css';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [oauthModalOpen, setOauthModalOpen] = useState<boolean>(false);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'apple' | null>(null);

  const { login, register, oauthLogin } = useContext(AuthContext);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (!email.trim() || !password.trim() || !accountId.trim()) {
        setError('請完整填寫 Email、密碼與帳號 ID');
        return;
      }
    } else {
      if (!loginIdentifier.trim() || !password.trim()) {
        setError('請輸入 Email 或帳號 ID 與密碼');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, accountId, displayName);
      } else {
        await login(loginIdentifier, password);
      }
    } catch (err: any) {
      setError(err.message || (isRegister ? '註冊失敗，請重試' : '登入失敗，請檢查帳號密碼'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOAuth = (provider: 'google' | 'apple') => {
    setOauthProvider(provider);
    setOauthModalOpen(true);
  };

  const handleCompleteOAuth = async (
    provider: 'google' | 'apple',
    providerId: string,
    oauthEmail: string,
    oauthAccountId: string,
    oauthDisplayName: string
  ) => {
    await oauthLogin(provider, providerId, oauthEmail, oauthAccountId, oauthDisplayName);
  };

  return (
    <div className={`${styles.authWrapper} glass`} style={{ maxWidth: '460px', width: '100%', margin: '0 auto' }}>
      <div className={styles.authHeader}>
        <div style={{
          margin: '0 auto 16px auto',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-color), #8b5cf6)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <MessageSquare size={28} />
        </div>
        <h2>{isRegister ? '建立 Focal Aura 帳號' : '歡迎回來'}</h2>
        <p>{isRegister ? '請填寫 Email、密碼與唯一的帳號 ID 進行註冊' : '請輸入 Email 或帳號 ID 以開始使用 Focal Aura'}</p>
      </div>

      {error && <div className={styles.authErrorAlert}>{error}</div>}

      <form className={styles.authForm} onSubmit={handleSubmit}>
        {isRegister ? (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={15} />
                <span>電子郵件 (Email)</span>
                <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                className="uiInput"
                type="email"
                placeholder="your.name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} />
                <span>密碼</span>
                <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                className="uiInput"
                type="password"
                placeholder="設定登入密碼..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AtSign size={15} />
                <span>帳號 ID</span>
                <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: '700',
                  color: 'var(--accent-color)'
                }}>@</span>
                <input
                  className="uiInput"
                  type="text"
                  placeholder="alex_dev (全站唯一的帳號識別碼)"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  style={{ paddingLeft: '32px' }}
                  required
                />
              </div>
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>
                全站顯示格式為 @{accountId || 'account_id'}（僅限英文字母、數字與底線）
              </small>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={15} />
                <span>帳號顯示名稱</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(選填)</span>
              </label>
              <input
                className="uiInput"
                type="text"
                placeholder="例如：Alex Chen (未填寫將預設顯示帳號 ID)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AtSign size={15} />
                <span>Email 或 帳號 ID</span>
              </label>
              <input
                className="uiInput"
                type="text"
                placeholder="請輸入 Email 或 @<account_id>..."
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} />
                <span>密碼</span>
              </label>
              <input
                className="uiInput"
                type="password"
                placeholder="請輸入密碼..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <button
          className="uiBtnPrimary"
          type="submit"
          disabled={loading}
          style={{ width: '100%', height: '44px', marginTop: '8px' }}
        >
          <span>{loading ? '處理中...' : (isRegister ? '註冊 Focal Aura 帳號' : '立即登入')}</span>
          <ArrowRight size={18} />
        </button>
      </form>

      <div className={styles.oauthDivider}>
        <span>或選擇第三方快捷登入</span>
      </div>

      <div className={styles.oauthGroup}>
        <button
          type="button"
          className="uiBtnSecondary"
          onClick={() => handleOpenOAuth('google')}
          style={{ flex: 1, padding: '10px 14px', height: '42px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Google</span>
        </button>

        <button
          type="button"
          className="uiBtnSecondary"
          onClick={() => handleOpenOAuth('apple')}
          style={{ flex: 1, padding: '10px 14px', height: '42px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.09c.62-.75 1.04-1.8 0.93-2.85-.9.04-2 .6-2.63 1.34-.56.65-.89 1.7-.76 2.72 1.01.08 2.04-.46 2.46-1.21z"/>
          </svg>
          <span>Apple</span>
        </button>
      </div>

      <div className={styles.authSwitch}>
        <span>{isRegister ? '已經擁有帳號？' : '還沒有帳號？'}</span>
        <span
          className={styles.authLink}
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
        >
          {isRegister ? '切換至登入' : '免費註冊'}
        </span>
      </div>

      <OAuthModal
        isOpen={oauthModalOpen}
        provider={oauthProvider}
        onClose={() => setOauthModalOpen(false)}
        onComplete={handleCompleteOAuth}
      />
    </div>
  );
};
