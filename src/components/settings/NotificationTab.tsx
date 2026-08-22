import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationManager } from '../../utils/notification';
import styles from '../SettingsModal.module.css';

export const NotificationTab: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const handleRequestPermission = async () => {
    const perm = await notificationManager.requestPermission();
    if (perm !== 'unsupported') {
      setPermission(perm);
    }
  };

  return (
    <div className={styles.settingsTabForm}>
      <div className={styles.securityInfoBox}>
        <Bell size={20} className={styles.accentIcon} />
        <div>
          <h4>桌面與系統音效提醒</h4>
          <p>開啓系統桌面通知可在應用程式縮小至背景時收到好友訊息與邀請即時提醒。</p>
        </div>
      </div>

      <div className={styles.settingOptionRow}>
        <div className={styles.optionLabel}>
          <span className={styles.optionTitle}>桌面通知權限</span>
          <span className={styles.optionDesc}>
            目前狀態：
            <strong>
              {permission === 'granted'
                ? ' 已允許'
                : permission === 'denied'
                ? ' 已拒絕 (請於瀏覽器網址列解除阻擋)'
                : ' 未設定'}
            </strong>
          </span>
        </div>

        {permission !== 'granted' && (
          <button className={styles.optionBtn} onClick={handleRequestPermission}>
            啟用桌面通知
          </button>
        )}
      </div>
    </div>
  );
};
