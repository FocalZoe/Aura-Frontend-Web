// Context: 全域 React 錯誤邊界組件 (Aura 極致深色玻璃設計、多重自愈修復工具與日誌折疊)
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, Trash2, ChevronDown, Copy, Check, ShieldAlert } from 'lucide-react';
import styles from './ErrorPage.module.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('⚠️ [Aura 全域錯誤攔截]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetToHome = () => {
    try {
      // 嘗試清除選中的會話狀態以避免死循環
      window.location.href = window.location.origin + window.location.pathname;
    } catch {
      window.location.reload();
    }
  };

  private handleHardReset = () => {
    if (window.confirm('確定要清除本地暫存快取並重啟嗎？這將重置 UI 狀態，但不會刪除伺服器上的帳號與加密訊息。')) {
      try {
        sessionStorage.clear();
        // 保留重要憑證，清除其他暫存
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.includes('token') && !key.includes('user') && !key.includes('privKey')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        console.warn('清除快取時發生非致命錯誤:', err);
      }
      window.location.reload();
    }
  };

  private handleCopyErrorLog = () => {
    const { error, errorInfo } = this.state;
    const logContent = `[Aura Error Log]
Timestamp: ${new Date().toISOString()}
Error: ${error?.toString()}
Stack:
${error?.stack || 'N/A'}
Component Stack:
${errorInfo?.componentStack || 'N/A'}
User Agent: ${navigator.userAgent}`;

    navigator.clipboard.writeText(logContent).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <div className={styles.iconWrapper}>
              <ShieldAlert size={36} strokeWidth={2} />
            </div>

            <h2 className={styles.errorTitle}>應用程式遇到了意外狀況</h2>
            <p className={styles.errorSubtitle}>
              系統已為您安全攔截此異常，您的聊天紀錄與隱私保護依然安全。請嘗試重新整理或重置頁面以恢復使用。
            </p>

            <div className={styles.actionsGroup}>
              <button className={styles.primaryBtn} onClick={this.handleReload}>
                <RotateCcw size={16} />
                <span>重新載入頁面</span>
              </button>

              <button className={styles.secondaryBtn} onClick={this.handleResetToHome}>
                <Home size={16} />
                <span>返回主畫面</span>
              </button>
            </div>

            <div style={{ width: '100%', marginBottom: '16px' }}>
              <button className={styles.dangerBtn} onClick={this.handleHardReset}>
                <Trash2 size={15} />
                <span>清除暫存快取並修復</span>
              </button>
            </div>

            {/* 錯誤技術詳情折疊區 */}
            <div className={styles.detailsSection}>
              <div
                className={styles.detailsToggle}
                onClick={() => this.setState({ showDetails: !showDetails })}
              >
                <span>技術診斷資訊 (Diagnostic Details)</span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>

              {showDetails && (
                <>
                  <div className={styles.detailsBody}>
                    <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>
                      {error?.toString() || '未知錯誤'}
                    </div>
                    {error?.stack && <div>{error.stack}</div>}
                    {errorInfo?.componentStack && (
                      <div style={{ marginTop: '8px', color: '#94a3b8' }}>
                        {errorInfo.componentStack}
                      </div>
                    )}
                  </div>

                  <div className={styles.copyBar}>
                    <button className={styles.copyBtn} onClick={this.handleCopyErrorLog}>
                      {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copied ? '日誌已複製到剪貼簿！' : '複製錯誤診斷報告'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
