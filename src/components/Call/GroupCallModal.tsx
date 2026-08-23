// Context: Discord 級別群組 SFU 音視訊通話主視窗 (雙排版模式、螢幕分享、音波指示燈與懸浮控制列)

import React, { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MonitorOff,
  LayoutGrid,
  Maximize2,
  PhoneOff,
  Pin,
  Users,
  X,
} from 'lucide-react';
import { useGroupCallStore } from '../../stores/useGroupCallStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { Avatar } from '../common/Avatar';
import styles from './GroupCallModal.module.css';

// 單個視訊/音訊串流卡片組件
interface StreamCardProps {
  userId: number;
  isSelf: boolean;
  stream: MediaStream | null;
  name: string;
  avatar?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isPinned?: boolean;
  isSpeaking?: boolean;
  onPinToggle?: () => void;
  onClick?: () => void;
}

const ParticipantCard: React.FC<StreamCardProps> = ({
  userId,
  isSelf,
  stream,
  name,
  avatar,
  isMuted = false,
  isVideoOff = false,
  isPinned = false,
  isSpeaking = false,
  onPinToggle,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = stream && stream.getVideoTracks().length > 0 && !isVideoOff;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <div
      className={`${styles.participantCard} ${isSpeaking ? styles.speakingGlow : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // 自己的聲音靜音避免本機回音
          className={styles.videoElement}
        />
      ) : (
        <div className={styles.avatarWrapper}>
          <Avatar src={avatar} name={name} fallbackSeed={name} size={68} />
        </div>
      )}

      {/* 底部浮動標籤 */}
      <div className={styles.cardBottomInfo} onClick={(e) => e.stopPropagation()}>
        <span className={styles.userNameLabel}>
          {name} {isSelf ? '(自己)' : ''}
        </span>
        <div className={styles.cardIcons}>
          {isMuted && <MicOff size={14} className={styles.statusIconMuted} />}
          {isVideoOff && <VideoOff size={14} className={styles.statusIconMuted} />}
          {onPinToggle && (
            <button
              className={`${styles.pinBtn} ${isPinned ? styles.pinBtnActive : ''}`}
              onClick={onPinToggle}
              title={isPinned ? '取消置頂' : '置頂放大'}
            >
              <Pin size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const GroupCallModal: React.FC = () => {
  const {
    isJoined,
    activeGroupName,
    participants,
    localStream,
    remoteStreams,
    screenShareStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    participantMediaStates,
    speakingUserIds,
    pinnedUserId,
    layoutMode,
    duration,
    leaveGroupCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setPinnedUser,
    toggleLayoutMode,
  } = useGroupCallStore();

  const { user } = useAuthStore();
  const { friends, getUserDisplayName } = useChatStore();

  // 若未在通話中則不渲染
  if (!isJoined) {
    return null;
  }

  // 格式化通話時間 MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const selfId = user ? Number(user.id) : 0;
  const selfName = user ? (user.display_name || user.account_id) : '自己';

  // 整理所有成員資料列表
  const allParticipantIds = Array.from(new Set([selfId, ...participants]));

  const getMemberInfo = (uid: number) => {
    if (uid === selfId) {
      return { name: selfName, avatar: user?.avatar };
    }
    const f = friends.find((friend) => Number(friend.id) === Number(uid));
    const name = f ? (getUserDisplayName(f) || f.display_name || f.account_id) : `成員 #${uid}`;
    return { name, avatar: f?.avatar };
  };

  // 依成員數量決定網格 CSS 類名
  const getGridClass = (count: number) => {
    if (count <= 1) return styles.grid1;
    if (count === 2) return styles.grid2;
    if (count <= 4) return styles.grid4;
    if (count <= 6) return styles.grid6;
    return styles.grid9;
  };

  // 取得置頂成員資料
  const pinnedMemberId = pinnedUserId || (isScreenSharing ? selfId : allParticipantIds[0]);
  const pinnedMember = getMemberInfo(pinnedMemberId);
  const pinnedStream =
    pinnedMemberId === selfId
      ? (screenShareStream || localStream)
      : remoteStreams[pinnedMemberId];
  const pinnedMediaState =
    pinnedMemberId === selfId
      ? { isMuted, isVideoOff }
      : (participantMediaStates[pinnedMemberId] || { isMuted: false, isVideoOff: false });

  return (
    <div className={styles.modalBackdrop}>
      {/* 頂部標頭 */}
      <div className={styles.modalHeader}>
        <div className={styles.groupInfo}>
          <h3 className={styles.groupTitle}>{activeGroupName || '群組通話'}</h3>
          <div className={styles.participantBadge}>
            <Users size={14} />
            <span>{allParticipantIds.length} 人在線</span>
          </div>
          <span className={styles.timer}>{formatTime(duration)}</span>
        </div>

        <button
          className={styles.closeBtn}
          onClick={leaveGroupCall}
          title="最小化通話視窗"
          aria-label="最小化通話視窗"
        >
          <X size={18} />
        </button>
      </div>

      {/* 中間舞台視圖 */}
      <div className={styles.stageContainer}>
        {layoutMode === 'focus' && allParticipantIds.length > 1 ? (
          // 焦點主舞台排版 (Focus Mode)
          <div className={styles.focusLayout}>
            <div className={styles.mainStage}>
              <ParticipantCard
                userId={pinnedMemberId}
                isSelf={pinnedMemberId === selfId}
                stream={pinnedStream}
                name={pinnedMember.name}
                avatar={pinnedMember.avatar}
                isMuted={pinnedMediaState.isMuted}
                isVideoOff={pinnedMediaState.isVideoOff}
                isPinned={true}
                isSpeaking={speakingUserIds.includes(pinnedMemberId)}
                onPinToggle={() => setPinnedUser(null)}
              />
            </div>

            {/* 底部成員橫排縮圖列 (Filmstrip) */}
            <div className={styles.filmstrip}>
              {allParticipantIds
                .filter((uid) => uid !== pinnedMemberId)
                .map((uid) => {
                  const info = getMemberInfo(uid);
                  const stream = uid === selfId ? localStream : remoteStreams[uid];
                  const media =
                    uid === selfId
                      ? { isMuted, isVideoOff }
                      : (participantMediaStates[uid] || { isMuted: false, isVideoOff: false });

                  return (
                    <div key={uid} className={styles.filmstripCard}>
                      <ParticipantCard
                        userId={uid}
                        isSelf={uid === selfId}
                        stream={stream}
                        name={info.name}
                        avatar={info.avatar}
                        isMuted={media.isMuted}
                        isVideoOff={media.isVideoOff}
                        isPinned={false}
                        isSpeaking={speakingUserIds.includes(uid)}
                        onClick={() => setPinnedUser(uid)}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          // 均分網格排版 (Grid Mode)
          <div className={`${styles.gridLayout} ${getGridClass(allParticipantIds.length)}`}>
            {allParticipantIds.map((uid) => {
              const info = getMemberInfo(uid);
              const stream = uid === selfId ? (screenShareStream || localStream) : remoteStreams[uid];
              const media =
                uid === selfId
                  ? { isMuted, isVideoOff }
                  : (participantMediaStates[uid] || { isMuted: false, isVideoOff: false });

              return (
                <ParticipantCard
                  key={uid}
                  userId={uid}
                  isSelf={uid === selfId}
                  stream={stream}
                  name={info.name}
                  avatar={info.avatar}
                  isMuted={media.isMuted}
                  isVideoOff={media.isVideoOff}
                  isPinned={pinnedUserId === uid}
                  isSpeaking={speakingUserIds.includes(uid)}
                  onPinToggle={() => setPinnedUser(pinnedUserId === uid ? null : uid)}
                  onClick={() => setPinnedUser(uid)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 底部懸浮控制列 */}
      <div className={styles.toolbarContainer}>
        <div className={styles.toolbar}>
          {/* 麥克風開關 */}
          <button
            className={`${styles.controlBtn} ${isMuted ? styles.controlBtnOff : ''}`}
            onClick={toggleAudio}
            title={isMuted ? '取消靜音' : '靜音'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* 鏡頭開關 */}
          <button
            className={`${styles.controlBtn} ${isVideoOff ? styles.controlBtnOff : ''}`}
            onClick={toggleVideo}
            title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
          >
            {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>

          {/* 螢幕分享 */}
          <button
            className={`${styles.controlBtn} ${isScreenSharing ? styles.controlBtnActive : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? '停止螢幕分享' : '螢幕分享'}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          {/* 排版切換 */}
          <button
            className={`${styles.controlBtn} ${layoutMode === 'focus' ? styles.controlBtnActive : ''}`}
            onClick={toggleLayoutMode}
            title={layoutMode === 'focus' ? '切換為均分網格' : '切換為焦點模式'}
          >
            {layoutMode === 'focus' ? <LayoutGrid size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* 掛斷離開按鈕 */}
          <button
            className={styles.leaveBtn}
            onClick={leaveGroupCall}
            title="離開通話"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
