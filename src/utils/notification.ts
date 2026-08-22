// TEAM_004: 瀏覽器系統級桌面通知 (Web Notification API) 模組

class NotificationManager {
  private enabled: boolean = true;

  constructor() {
    const saved = localStorage.getItem('focal_aura_desktop_notify_enabled');
    if (saved !== null) {
      this.enabled = saved === 'true';
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('focal_aura_desktop_notify_enabled', String(enabled));
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    return result;
  }

  public getPermissionState(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  // 檢查視窗是否無 Focus 或分頁隱藏 (!document.hasFocus() || document.hidden)
  public isWindowUnfocused(): boolean {
    if (typeof document === 'undefined') return false;
    return document.hidden || !document.hasFocus();
  }

  // 發送系統桌面通知
  public async sendNotification(title: string, body: string, onClick?: () => void) {
    if (!this.enabled) return;
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[NotificationManager] Notification API 不支援此環境');
      return;
    }

    if (Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      } catch (e) {
        console.warn('[NotificationManager] 請求通知權限被拒絕或出錯:', e);
        return;
      }
    }

    if (Notification.permission !== 'granted') {
      console.warn('[NotificationManager] 通知權限未授予 (當前狀態: ' + Notification.permission + ')');
      return;
    }

    try {
      const options: any = {
        body,
        tag: 'focal-aura-msg-' + Date.now(),
        renotify: true,
        silent: false,
        requireInteraction: false
      };

      const notification = new Notification(title, options);

      // 自動於 4 秒後關閉通知，避免桌面通知卡片永久常駐於螢幕上
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {}
      }, 4000);

      notification.onclick = () => {
        try {
          window.focus();
        } catch (e) {}
        notification.close();
        if (onClick) onClick();
      };
    } catch (e) {
      console.error('發送桌面系統通知失敗:', e);
    }
  }
}

export const notificationManager = new NotificationManager();
