// Context: 群聊頂部常駐群組通話 Banner (綠色脈衝呼吸光暈、成員在線狀態與一鍵無感加入)

import React from 'react';
import { PhoneCall, Users, Video, X, ExternalLink } from 'lucide-react';
import { useGroupCallStore } from '../../stores/useGroupCallStore';
import styles from './GroupCallBanner.module.css';

interface GroupCallBannerProps {
  groupId: number;
  groupName: string;
  onOpenModal: () => void;
}

export const GroupCallBanner: React.FC<GroupCallBannerProps> = ({
  groupId,
  groupName,
  onOpenModal,
}) => {
  const {
    activeGroupId,
    isCallActive,
    isJoined,
    callType,
    participants,
    joinGroupCall,
    dismissIncomingBanner,
  } = useGroupCallStore();

  // 僅當前活躍群組有通話且開啟時顯示
  if (!isCallActive || activeGroupId !== groupId) {
    return null;
  }

  const participantCount = Math.max(participants.length, 1);

  return (
    <div className={styles.bannerWrapper}>
      <div className={styles.leftSection}>
        <div className={styles.pulseIndicator}>
          {callType === 'video' ? <Video size={18} /> : <PhoneCall size={18} />}
        </div>
        <div className={styles.titleInfo}>
          <h4 className={styles.callTitle}>群組通話進行中</h4>
          <div className={styles.callSubtitle}>
            <Users size={12} />
            <span>{participantCount} 位成員在線</span>
          </div>
        </div>
      </div>

      <div className={styles.actionsSection}>
        {isJoined ? (
          <button className={styles.viewBtn} onClick={onOpenModal}>
            <ExternalLink size={14} />
            <span>回到通話</span>
          </button>
        ) : (
          <button
            className={styles.joinBtn}
            onClick={() => {
              joinGroupCall(groupId, groupName, callType);
              onOpenModal();
            }}
          >
            {callType === 'video' ? <Video size={14} /> : <PhoneCall size={14} />}
            <span>加入通話</span>
          </button>
        )}

        {!isJoined && (
          <button
            className={styles.dismissBtn}
            onClick={dismissIncomingBanner}
            title="暫時忽略"
            aria-label="暫時忽略"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
