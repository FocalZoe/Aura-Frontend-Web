// Context: PinModal 重構 - 套用通用 BaseModal
import React, { useState, FormEvent, useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { Shield, Key, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './PinModal.module.css';

interface PinModalProps {
  mode?: 'setup' | 'enter' | 'confirm-reset';
  onSubmit?: (pin: string | null) => Promise<void> | void;
  onCancelReset?: () => void;
  onConfirmReset?: () => void;
  onClose?: () => void;
  error?: string;
}

export interface DigitPinInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  autoFocus?: boolean;
}

export const DigitPinInput: React.FC<DigitPinInputProps> = ({
  value,
  onChange,
  label,
  autoFocus = false
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] || '');

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (!rawVal) {
      const nextPin = value.substring(0, index) + value.substring(index + 1);
      onChange(nextPin);
      return;
    }

    const cleanVal = rawVal.replace(/\D/g, '');
    if (!cleanVal) return;

    const lastChar = cleanVal.slice(-1);
    const pinArr = value.padEnd(4, ' ').split('');
    pinArr[index] = lastChar;
    const newPin = pinArr.join('').trimEnd();
    onChange(newPin);

    if (index < 3 && lastChar) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasteData) {
      onChange(pasteData);
      const nextIndex = Math.min(pasteData.length, 3);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className={styles.digitGroup}>
      {label && <label className={styles.digitLabel}>{label}</label>}
      <div className={styles.digitBoxes}>
        {[0, 1, 2, 3].map((index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digits[index]}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`${styles.digitBox} ${digits[index] ? styles.hasValue : ''}`}
            autoFocus={autoFocus && index === 0}
          />
        ))}
      </div>
    </div>
  );
};

export const PinModal: React.FC<PinModalProps> = ({
  mode = 'enter',
  onSubmit,
  onCancelReset,
  onConfirmReset,
  onClose,
  error
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setLocalError('PIN 碼必須為 4 位數字');
      return;
    }

    if (mode === 'setup') {
      if (pin !== confirmPin) {
        setLocalError('兩次輸入的 PIN 碼不一致');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(pin);
      }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || '處理失敗，請重試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      maxWidth="420px"
      showCloseButton={mode === 'setup' && Boolean(onClose)}
      zIndex={10100}
    >
      {mode === 'setup' && (
        <>
          <div className={styles.header}>
            <Shield size={44} className={styles.icon} />
            <h3>設定安全 PIN 碼</h3>
            <p>設定 4 位數 PIN 碼，維護您的帳號安全與對話同步。</p>
          </div>
          {(error || localError) && <div className={styles.errorAlert}>{error || localError}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <DigitPinInput
              label="請輸入 4 位數 PIN 碼"
              value={pin}
              onChange={setPin}
              autoFocus
            />
            <DigitPinInput
              label="確認 PIN 碼"
              value={confirmPin}
              onChange={setConfirmPin}
            />
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="spin" />
                  處理中...
                </span>
              ) : (
                '確認設定'
              )}
            </button>
          </form>
        </>
      )}

      {mode === 'enter' && (
        <>
          <div className={styles.header}>
            <Key size={44} className={styles.icon} />
            <h3>輸入安全 PIN 碼</h3>
            <p>請輸入您的 4 位數 PIN 碼以恢復歷史訊息。</p>
          </div>
          {(error || localError) && <div className={styles.errorAlert}>{error || localError}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <DigitPinInput
              label="請輸入 4 位數 PIN 碼"
              value={pin}
              onChange={setPin}
              autoFocus
            />
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="spin" />
                  驗證中...
                </span>
              ) : (
                '確認'
              )}
            </button>
          </form>
          <div style={{ textAlign: 'center' }}>
            <button className={styles.linkBtn} onClick={onCancelReset}>
              <RefreshCw size={14} />
              <span>忘記 PIN 碼？重置 PIN 碼</span>
            </button>
          </div>
        </>
      )}

      {mode === 'confirm-reset' && (
        <>
          <div className={styles.header}>
            <AlertTriangle size={44} className={styles.warningIcon} />
            <h3 style={{ color: 'var(--token-danger)' }}>重置 PIN 碼警告</h3>
            <p>如果您選擇重置 PIN 碼：</p>
            <ul className={styles.warningList}>
              <li>舊的對話防護設定將被重置。</li>
              <li>以前的歷史對話記錄將無法再次復原。</li>
              <li>您可以正常傳送與接收新的對話訊息。</li>
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="uiBtnDanger" onClick={onConfirmReset}>
              我明白，確定重置
            </button>
            <button className="uiBtnSecondary" onClick={onCancelReset}>
              取消
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
};

