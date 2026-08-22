// Context: 高度自訂義與統一風格之 BaseModal 通用 Primitive 組件
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './BaseModal.module.css';

export interface BaseModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  width?: string;
  maxWidth?: string;
  height?: string;
  maxHeight?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  zIndex?: number;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  width = '100%',
  maxWidth = '520px',
  height,
  maxHeight = '90vh',
  showCloseButton = true,
  closeOnBackdropClick = true,
  footer,
  children,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  zIndex,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick && onClose) {
      onClose();
    }
  };

  const hasHeader = Boolean(title || subtitle || icon || (showCloseButton && onClose));

  const modalContent = (
    <div className={styles.backdrop} style={zIndex !== undefined ? { zIndex } : undefined} onClick={handleBackdropClick}>
      <div
        className={`${styles.modalCard} ${className}`.trim()}
        style={{
          width,
          maxWidth,
          height: height || 'auto',
          maxHeight
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader && (
          <div className={`${styles.header} ${headerClassName}`.trim()}>
            <div className={styles.headerTitleGroup}>
              {icon && <div className={styles.iconWrapper}>{icon}</div>}
              <div className={styles.titleText}>
                {typeof title === 'string' ? <h3 className={styles.title}>{title}</h3> : title}
                {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
              </div>
            </div>
            {showCloseButton && onClose && (
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="關閉彈窗"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className={`${styles.modalBody} ${bodyClassName}`.trim()}>
          {children}
        </div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

