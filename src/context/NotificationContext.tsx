import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NotificationModel, NotificationOptions, NotificationType, NotificationContextType } from '../types';
import { NotificationContainer } from '../components/NotificationContainer';
import { soundEffects } from '../utils/audio';

export const NotificationContext = createContext<NotificationContextType>({
  notify: () => '',
  removeNotification: () => {},
  clearNotifications: () => {},
});

// TEAM_005: 全新 Notification Context (完全替代 ToastContext，全域 CSS Module，支援 withSound / persistent / 4 種訊息類型)
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationModel[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback(
    (options: NotificationOptions | string, overrideType?: NotificationType): string => {
      let opt: NotificationOptions;
      if (typeof options === 'string') {
        opt = {
          message: options,
          type: overrideType || 'info',
          withSound: false,
          persistent: false,
        };
      } else {
        opt = {
          ...options,
          type: options.type || overrideType || 'info',
          withSound: options.withSound ?? false,
          persistent: options.persistent ?? false,
        };
      }

      const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const duration = opt.duration || 4000;

      const newNotif: NotificationModel = {
        id,
        type: opt.type || 'info',
        title: opt.title,
        message: opt.message,
        withSound: !!opt.withSound,
        persistent: !!opt.persistent,
        duration,
      };

      // 音效處理
      if (opt.withSound) {
        try {
          soundEffects.playMessageSound();
        } catch (e) {
          console.warn('音效播放失敗:', e);
        }
      }

      setNotifications((prev) => [...prev, newNotif]);

      // 若非永久顯示，倒數自動移除
      if (!opt.persistent) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }

      return id;
    },
    [removeNotification]
  );

  return (
    <NotificationContext.Provider value={{ notify, removeNotification, clearNotifications }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

// TEAM_005: 自訂 Hook 方便各組件呼叫 notification
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
