// Context: 通話 Modal 組件 (Avatar 破圖徹底修復、PiP 懸浮子母畫面、Pop-out 獨立新視窗與全站一致深色毛玻璃美學)

import React, { useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneIncoming,
  AlertCircle,
  Minimize2,
  Maximize2,
  ExternalLink,
  X,
} from 'lucide-react';
import { useCallStore } from '../../stores/useCallStore';
import { useChatStore } from '../../stores/useChatStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Avatar } from '../common/Avatar';
import styles from './CallModal.module.css';

export const CallModal: React.FC = () => {
  const {
    callState,
    callType,
    peerUser,
    isMuted,
    isVideoOff,
    isRemoteVideoOff,
    localStream,
    remoteStream,
    duration,
    busyNotification,
    isMinimized,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    setMinimized,
    setBusyNotification,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // 本地使用者資訊
  const myUser = useAuthStore((s: any) => s.user);
  const myAvatar = myUser?.avatar;
  const myName = myUser?.display_name || myUser?.account_id || '我';

  // 對手使用者資訊
  const friends = useChatStore((s: any) => s.friends);
  const friendObj = friends ? friends.find((f: any) => Number(f.id) === Number(peerUser?.id)) : undefined;
  const displayAvatar = peerUser?.avatar || friendObj?.avatar;
  const displayName = peerUser?.name || friendObj?.display_name || friendObj?.account_id || '未知使用者';

  // 判斷對方是否有活躍的視訊軌
  const isRemoteVideoActive =
    !isRemoteVideoOff &&
    remoteStream &&
    remoteStream.getVideoTracks().some((t) => t.enabled && !t.muted && t.readyState === 'live');

  // 綁定影音串流至 DOM
  useEffect(() => {
    if (callState === 'connected') {
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (pipVideoRef.current && remoteStream) {
        pipVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [callState, localStream, remoteStream, isRemoteVideoActive, isMinimized]);

  // 格式化通話時間
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleAcceptCall = async () => {
    await acceptCall();
  };

  // 彈出式新視窗 (Pop-out Window)
  const handlePopout = () => {
    const width = 640;
    const height = 480;
    const left = window.screen.width - width - 40;
    const top = 80;
    window.open(
      window.location.href,
      'AuraCallPopout',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
  };

  if (callState === 'idle') return null;

  return (
    <>
      {/* 遠端專屬音訊播放器 (保證背景 100% 發聲) */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* 忙線或阻斷全域 Notification */}
      {busyNotification && (
        <div className={styles.overlay} onClick={() => setBusyNotification(null)}>
          <div className={styles.container} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h3 className={styles.title}>通話提示</h3>
              <div className={styles.status}>
                <AlertCircle size={16} color="#f59e0b" />
                <span>{busyNotification}</span>
              </div>
            </div>
            <div className={styles.avatarSection}>
              <Avatar src={displayAvatar} name={displayName} size={88} />
            </div>
            <div className={styles.controls}>
              <button className={styles.btnReject} onClick={() => setBusyNotification(null)} title="確認">
                <X size={26} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 情況 A：已最小化為 PiP 子母畫面懸浮窗 */}
      {isMinimized && callState === 'connected' ? (
        <div className={styles.pipFloatingContainer}>
          {/* PiP 標頭 */}
          <div className={styles.pipHeader}>
            <div className={styles.pipTitleGroup}>
              <span className={styles.pipName}>{displayName}</span>
              <span className={styles.pipTimerBadge}>{formatDuration(duration)}</span>
            </div>
            <div className={styles.pipActionsGroup}>
              <button
                className={styles.pipBtnIcon}
                onClick={() => setMinimized(false)}
                title="最大化回到通話視窗"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* PiP 影像主體 */}
          <div className={styles.pipBody} onClick={() => setMinimized(false)} style={{ cursor: 'pointer' }}>
            {isRemoteVideoActive ? (
              <video ref={pipVideoRef} autoPlay playsInline className={styles.pipVideoElement} />
            ) : (
              <Avatar src={displayAvatar} name={displayName} size={64} />
            )}
          </div>

          {/* PiP 快捷操作列 */}
          <div className={styles.pipControls}>
            <button
              className={`${styles.pipControlBtn} ${isMuted ? styles.pipControlBtnActive : ''}`}
              onClick={toggleAudio}
              title={isMuted ? '取消靜音' : '靜音'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              className={`${styles.pipControlBtn} ${isVideoOff ? styles.pipControlBtnActive : ''}`}
              onClick={toggleVideo}
              title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
            >
              {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
            </button>
            <button className={styles.pipHangupBtn} onClick={endCall} title="掛斷通話">
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* 情況 B：正常主視窗 Modal */
        <div className={styles.overlay}>
          {callState === 'connected' ? (
            /* 已通話連線 Viewport */
            <div className={`${styles.container} ${callType === 'video' ? styles.containerVideo : ''}`}>
              {/* 頂部視窗控制工具列 */}
              <div className={styles.windowActionsBar}>
                <button
                  className={styles.windowActionBtn}
                  onClick={() => setMinimized(true)}
                  title="最小化為子母畫面 (PiP)"
                  aria-label="最小化為子母畫面"
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  className={styles.windowActionBtn}
                  onClick={handlePopout}
                  title="彈出獨立新視窗"
                  aria-label="彈出獨立新視窗"
                >
                  <ExternalLink size={16} />
                </button>
              </div>

              {callType === 'audio' ? (
                /* 語音通話佈局 */
                <>
                  <div className={styles.header}>
                    <h3 className={styles.title}>{displayName}</h3>
                    <div className={styles.status}>
                      <span className={styles.statusDot} />
                      <span>通話中 · {formatDuration(duration)}</span>
                    </div>
                  </div>

                  <div className={styles.avatarSection}>
                    <div className={styles.avatarRing} />
                    <div className={`${styles.avatarRing} ${styles.avatarRing2}`} />
                    <Avatar src={displayAvatar} name={displayName} size={110} />
                  </div>

                  <div className={styles.controls}>
                    <button
                      className={`${styles.btnControl} ${isMuted ? styles.btnControlActive : ''}`}
                      onClick={toggleAudio}
                      title={isMuted ? '取消靜音' : '靜音'}
                    >
                      {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    <button
                      className={`${styles.btnControl} ${isVideoOff ? styles.btnControlActive : ''}`}
                      onClick={toggleVideo}
                      title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
                    >
                      {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                    </button>

                    <button className={styles.btnReject} onClick={() => endCall()} title="掛斷">
                      <PhoneOff size={28} />
                    </button>
                  </div>
                </>
              ) : (
                /* 視訊通話佈局 */
                <div className={styles.videoViewport}>
                  {/* 遠端主視訊畫面 */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={styles.remoteVideo}
                    style={{ display: isRemoteVideoActive ? 'block' : 'none' }}
                  />

                  {/* 遠端關閉鏡頭時呈現 Avatar */}
                  {!isRemoteVideoActive && (
                    <div className={styles.remoteVideoOff}>
                      <Avatar src={displayAvatar} name={displayName} size={110} />
                      <div className={styles.remoteVideoOffTip}>
                        <VideoOff size={16} />
                        <span>對方已關閉鏡頭</span>
                      </div>
                    </div>
                  )}

                  {/* 本地畫中畫 (PiP)：鏡頭開啟或顯示個人 Avatar */}
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={styles.localVideoPip}
                    style={{ display: !isVideoOff ? 'block' : 'none' }}
                  />
                  {isVideoOff && (
                    <div className={`${styles.localVideoPip} ${styles.localVideoPipOff}`}>
                      <Avatar src={myAvatar} name={myName} size={54} />
                    </div>
                  )}

                  {/* 頂部資訊覆籤 */}
                  <div className={styles.videoOverlayHeader}>
                    <span className={styles.title}>{displayName}</span>
                    <div className={styles.status}>
                      <span className={styles.statusDot} />
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>

                  {/* 底部浮動控制列 */}
                  <div className={`${styles.controls} ${styles.videoControlsOverlay}`}>
                    <button
                      className={`${styles.btnControl} ${isMuted ? styles.btnControlActive : ''}`}
                      onClick={toggleAudio}
                      title={isMuted ? '取消靜音' : '靜音'}
                    >
                      {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    <button
                      className={`${styles.btnControl} ${isVideoOff ? styles.btnControlActive : ''}`}
                      onClick={toggleVideo}
                      title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
                    >
                      {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                    </button>

                    <button className={styles.btnReject} onClick={() => endCall()} title="掛斷">
                      <PhoneOff size={28} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 撥號中 / 來電響鈴 Viewport */
            <div className={styles.container}>
              <div className={styles.header}>
                <h3 className={styles.title}>{displayName}</h3>
                <div className={styles.status}>
                  <span className={`${styles.statusDot} ${styles.statusDotCalling}`} />
                  <span>
                    {callState === 'calling' && '正在撥號連線中...'}
                    {callState === 'incoming' && `來電中 (${callType === 'video' ? '視訊通話' : '語音通話'})`}
                    {callState === 'ended' && '通話已結束'}
                  </span>
                </div>
              </div>

              <div className={styles.avatarSection}>
                <div className={styles.avatarRing} />
                <div className={`${styles.avatarRing} ${styles.avatarRing2}`} />
                <Avatar src={displayAvatar} name={displayName} size={110} />
              </div>

              <div className={styles.controls}>
                {callState === 'incoming' ? (
                  <>
                    <button className={styles.btnAccept} onClick={handleAcceptCall} title="接聽">
                      <PhoneIncoming size={30} />
                    </button>
                    <button className={styles.btnReject} onClick={rejectCall} title="拒絕">
                      <PhoneOff size={30} />
                    </button>
                  </>
                ) : (
                  <button className={styles.btnReject} onClick={() => endCall()} title="掛斷">
                    <PhoneOff size={28} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
