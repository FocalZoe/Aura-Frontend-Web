// Context: Discord 級別群組 SFU 音視訊通話主視窗 (全域音訊播放池、Avatar 破圖徹底修復、PiP 懸浮子母畫面、Pop-out 獨立新視窗與全站一致深色毛玻璃)

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
  Minimize2,
  ExternalLink,
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

// 遠端音訊獨立播放器組件
const RemoteAudioPlayer: React.FC<{ track: MediaStreamTrack }> = ({ track }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && track) {
      const stream = new MediaStream([track]);
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [track]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};

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
  }, [stream, hasVideo, isVideoOff]);

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
    remoteAudioTracks,
    screenShareStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    participantMediaStates,
    speakingUserIds,
    pinnedUserId,
    layoutMode,
    duration,
    isMinimized,
    leaveGroupCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setPinnedUser,
    toggleLayoutMode,
    setMinimized,
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

  // 彈出式新視窗 (Pop-out Window)
  const handlePopout = () => {
    const width = 800;
    const height = 600;
    const left = window.screen.width - width - 40;
    const top = 80;
    window.open(
      window.location.href,
      'AuraGroupCallPopout',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
  };

  return (
    <>
      {/* 全域遠端音訊播放池 (確保 100% 聽見所有成員聲音) */}
      {remoteAudioTracks.map((track, idx) => (
        <RemoteAudioPlayer key={track.id || idx} track={track} />
      ))}

      {/* 情況 A：已最小化為 PiP 子母畫面懸浮窗 */}
      {isMinimized ? (
        <div className={styles.pipGroupFloating}>
          <div className={styles.modalHeader} style={{ padding: '10px 14px' }}>
            <div className={styles.groupInfo}>
              <h4 className={styles.groupTitle} style={{ fontSize: '0.9rem' }}>
                {activeGroupName || '群組通話'}
              </h4>
              <span className={styles.timer} style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                {formatTime(duration)}
              </span>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.headerActionBtn}
                style={{ width: '28px', height: '28px' }}
                onClick={() => setMinimized(false)}
                title="最大化回到通話主視窗"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#090d16',
              cursor: 'pointer',
            }}
            onClick={() => setMinimized(false)}
          >
            {allParticipantIds.slice(0, 4).map((uid) => {
              const info = getMemberInfo(uid);
              return <Avatar key={uid} src={info.avatar} name={info.name} size={42} />;
            })}
            {allParticipantIds.length > 4 && (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>+{allParticipantIds.length - 4}</span>
            )}
          </div>

          <div className={styles.controlsBar} style={{ padding: '8px 12px' }}>
            <button
              className={`${styles.btnAction} ${isMuted ? styles.btnActionActive : ''}`}
              style={{ width: '38px', height: '38px' }}
              onClick={toggleAudio}
              title={isMuted ? '取消靜音' : '靜音'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              className={`${styles.btnAction} ${isVideoOff ? styles.btnActionActive : ''}`}
              style={{ width: '38px', height: '38px' }}
              onClick={toggleVideo}
              title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
            >
              {isVideoOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
            </button>
            <button
              className={styles.btnLeave}
              style={{ width: '38px', height: '38px' }}
              onClick={leaveGroupCall}
              title="離開通話"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* 情況 B：正常主視窗 Modal */
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

            <div className={styles.headerActions}>
              <button
                className={styles.headerActionBtn}
                onClick={() => setMinimized(true)}
                title="最小化至子母畫面 (PiP)"
                aria-label="最小化至子母畫面"
              >
                <Minimize2 size={16} />
              </button>
              <button
                className={styles.headerActionBtn}
                onClick={handlePopout}
                title="彈出獨立新視窗"
                aria-label="彈出獨立新視窗"
              >
                <ExternalLink size={16} />
              </button>
              <button
                className={styles.headerActionBtn}
                onClick={leaveGroupCall}
                title="離開通話"
                aria-label="離開通話"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 中間舞台視圖 */}
          <div className={styles.stageContainer}>
            {layoutMode === 'focus' && allParticipantIds.length > 1 ? (
              /* 焦點主舞台排版 (Focus Mode) */
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
                            onPinToggle={() => setPinnedUser(uid)}
                            onClick={() => setPinnedUser(uid)}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* 均分網格排版 (Grid Mode) */
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
                      isPinned={false}
                      isSpeaking={speakingUserIds.includes(uid)}
                      onPinToggle={() => setPinnedUser(uid)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部浮動控制列 */}
          <div className={styles.controlsBar}>
            <button
              className={`${styles.btnAction} ${isMuted ? styles.btnActionActive : ''}`}
              onClick={toggleAudio}
              title={isMuted ? '取消靜音' : '靜音'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              className={`${styles.btnAction} ${isVideoOff ? styles.btnActionActive : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
            >
              {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
            </button>

            <button
              className={`${styles.btnAction} ${isScreenSharing ? styles.btnActionActiveScreen : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? '停止螢幕分享' : '螢幕分享'}
            >
              {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
            </button>

            <button
              className={styles.btnAction}
              onClick={toggleLayoutMode}
              title={layoutMode === 'grid' ? '切換至焦點排版' : '切換至網格排版'}
            >
              <LayoutGrid size={20} />
            </button>

            <button className={styles.btnLeave} onClick={leaveGroupCall} title="離開通話">
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
