// Context: ConfirmModal 重構 - 使用通用 BaseModal
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { BaseModal } from './common/BaseModal';

interface ConfirmModalProps {
  isOpen?: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = (props) => {
  const { confirmConfig, closeConfirmModal } = useUIStore();

  const isOpen = props.isOpen ?? (confirmConfig?.isOpen || false);
  const title = props.title || confirmConfig?.title || '確認操作';
  const message = props.message || confirmConfig?.message || '';
  const confirmText = props.confirmText || confirmConfig?.confirmText || '確定';
  const cancelText = props.cancelText || confirmConfig?.cancelText || '取消';
  const isDanger = props.danger ?? (confirmConfig?.danger ?? true);

  const handleConfirm = () => {
    if (props.onConfirm) {
      props.onConfirm();
    } else if (confirmConfig?.onConfirm) {
      confirmConfig.onConfirm();
    }
    closeConfirmModal();
  };

  const handleCancel = () => {
    if (props.onCancel) {
      props.onCancel();
    }
    closeConfirmModal();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      maxWidth="400px"
      showCloseButton={false}
      zIndex={10200}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px' }}>
        <AlertTriangle
          size={48}
          style={{
            color: isDanger ? 'var(--token-danger, #ef4444)' : 'var(--token-warning, #f59e0b)',
            marginBottom: '12px'
          }}
        />
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{message}</p>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button className="uiBtnSecondary" onClick={handleCancel} style={{ flex: 1 }}>
          {cancelText}
        </button>
        <button
          className={isDanger ? 'uiBtnDanger' : 'uiBtnPrimary'}
          onClick={handleConfirm}
          style={{ flex: 1 }}
        >
          {confirmText}
        </button>
      </div>
    </BaseModal>
  );
};

