import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { NotificationModel } from '../types';
import styles from './NotificationContainer.module.css';

interface NotificationContainerProps {
  notifications: NotificationModel[];
  onRemove: (id: string) => void;
}

// Context: 採用全域 CSS Module 渲染 Notification 堆疊卡片
export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className={styles.notificationStack}>
      {notifications.map((item) => {
        let typeClass = styles.toastInfo;
        let IconComponent = Info;

        if (item.type === 'danger') {
          typeClass = styles.toastDanger;
          IconComponent = AlertCircle;
        } else if (item.type === 'warning') {
          typeClass = styles.toastWarning;
          IconComponent = AlertTriangle;
        } else if (item.type === 'success') {
          typeClass = styles.toastSuccess;
          IconComponent = CheckCircle;
        }

        return (
          <div key={item.id} className={`${styles.notificationCard} ${typeClass}`}>
            <div className={styles.iconBox}>
              <IconComponent size={18} />
            </div>

            <div className={styles.contentBox}>
              {item.title && <div className={styles.title}>{item.title}</div>}
              <div className={styles.message}>{item.message}</div>
            </div>

            <button
              className={styles.closeBtn}
              onClick={() => onRemove(item.id)}
              title="關閉提示"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

