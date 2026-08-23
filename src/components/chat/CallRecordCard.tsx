// Context: 現代化通話紀錄卡片組件 (語音/視訊/未接/取消、時長膠囊與一鍵回撥)

import React from 'react';
import { Phone, Video, PhoneMissed, PhoneOff, PhoneForwarded } from 'lucide-react';
import styles from './CallRecordCard.module.css';

interface CallRecordCardProps {
  content: string;
  isSelf: boolean;
  onCallback?: () => void;
}

export const CallRecordCard: React.FC<CallRecordCardProps> = ({ content, isSelf, onCallback }) => {
  // 解析通話內容字串
  const isVideo = content.includes('視訊');
  const isMissed = content.includes('未接');
  const isDeclined = content.includes('已拒絕') || content.includes('對方忙線') || content.includes('忙線');
  const isCancelled = content.includes('已取消') || content.includes('取消通話');

  // 解析時長
  let durationStr = '';
  const lines = content.split('\n');
  if (lines.length >= 2) {
    durationStr = lines[1].trim();
  } else {
    const match = content.match(/\((.*?)\)/) || content.match(/(\d{1,2}:\d{2})/);
    if (match) durationStr = match[1];
  }

  // 決定主標題與圖示
  let title = '語音通話';
  let icon = <Phone size={18} />;
  let iconClass = styles.iconSuccess;

  if (isVideo) {
    title = '視訊通話';
    icon = <Video size={18} />;
    iconClass = styles.iconVideo;
  }

  if (isMissed) {
    title = isVideo ? '未接視訊來電' : '未接來電';
    icon = <PhoneMissed size={18} />;
    iconClass = styles.iconMissed;
  } else if (isDeclined) {
    title = content.includes('忙線') ? '對方忙線中' : '已拒絕來電';
    icon = <PhoneOff size={18} />;
    iconClass = styles.iconCancelled;
  } else if (isCancelled) {
    title = '已取消通話';
    icon = <PhoneOff size={18} />;
    iconClass = styles.iconCancelled;
  }

  // 判斷是否支援點擊回撥
  const isClickable = !!onCallback;

  return (
    <div
      className={`${styles.callCard} ${isClickable ? styles.callCardClickable : ''}`}
      onClick={onCallback}
      title={isClickable ? '點擊回撥通話' : undefined}
    >
      <div className={`${styles.iconWrapper} ${iconClass}`}>{icon}</div>

      <div className={styles.infoCol}>
        <div className={styles.titleRow}>
          <span className={`${styles.callTitle} ${isMissed ? styles.titleMissed : ''}`}>{title}</span>
          {isClickable && (
            <div className={styles.callbackAction}>
              <PhoneForwarded size={14} />
            </div>
          )}
        </div>

        {durationStr ? (
          <div className={styles.durationBadge}>
            <span>通話時長 {durationStr}</span>
          </div>
        ) : (
          <span className={styles.callSubtitle}>
            {isMissed ? (isSelf ? '對方未接聽' : '點擊快速回撥') : isSelf ? '已撥出' : '來電'}
          </span>
        )}
      </div>
    </div>
  );
};
