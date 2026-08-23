// Context: [一對一通話主視窗] 玻璃擬態 P2P WebRTC 呼叫視窗 (Avatar 核心元件、VAD 說話綠框發光、PiP 子母畫面、Document PiP 獨立視窗與無多餘X按鈕)

import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import { useCallStore } from '../../stores/useCallStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { Avatar } from '../common/Avatar';
import { VoiceActivityDetector } from '../../utils/VoiceActivityDetector';
import styles from './CallModal.module.css';

export const CallModal: React.FC = () => {
  const {
    callState,
    callType,
    isCaller,
    isMuted,
    isVideoOff,
    isRemoteVideoOff,
    peerUser,
    duration,
    localStream,
    remoteStream,
    busyNotification,
    isMinimized,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo,
    setBusyNotification,
    setMinimized,
  } = useCallStore();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [isPopout, setIsPopout] = useState<boolean>(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState<boolean>(false);
  const callContentRef = useRef<HTMLDivElement | null>(null);
  const mainHostRef = useRef<HTMLDivElement | null>(null);

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

  // 監聽遠端音波 (VAD) 驅動說話綠光
  useEffect(() => {
    if (callState === 'connected' && remoteStream && remoteStream.getAudioTracks().length > 0) {
      const vad = new VoiceActivityDetector(remoteStream, (speaking) => {
        setIsRemoteSpeaking(speaking);
      });
      return () => {
        vad.destroy();
      };
    }
  }, [callState, remoteStream]);

  // 格式化通話時間
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleAcceptCall = async () => {
    await acceptCall();
  };

  // 彈出式新視窗 (Document Picture-in-Picture 獨立桌面視窗)
  const handlePopout = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: callType === 'video' ? 880 : 480,
          height: callType === 'video' ? 600 : 540,
        });

        // 複製主視窗所有樣式
        Array.from(document.styleSheets).forEach((styleSheet) => {
          try {
            const cssRules = Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            if (styleSheet.href) {
              link.rel = 'stylesheet';
              link.type = styleSheet.type;
              link.media = styleSheet.media.toString();
              link.href = styleSheet.href;
              pipWin.document.head.appendChild(link);
            }
          }
        });

        if (callContentRef.current) {
          pipWin.document.body.appendChild(callContentRef.current);
          pipWin.document.body.style.margin = '0';
          pipWin.document.body.style.background = '#090d16';
          pipWin.document.body.style.display = 'flex';
          pipWin.document.body.style.alignItems = 'center';
          pipWin.document.body.style.justifyContent = 'center';
          pipWin.document.body.style.height = '100vh';
        }

        setIsPopout(true);

        pipWin.addEventListener('pagehide', () => {
          if (callContentRef.current && mainHostRef.current) {
            mainHostRef.current.appendChild(callContentRef.current);
          }
          setIsPopout(false);
        });
      } catch (err) {
        console.warn('[CallModal] Document PiP request failed, fallback to internal PiP:', err);
        setMinimized(true);
      }
    } else {
      // 瀏覽器不支援 Document PiP 時自動切換為內部 PiP 子母畫面
      setMinimized(true);
    }
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
              <p className={styles.status}>{busyNotification}</p>
            </div>
            <div className={styles.controls}>
              <button
                className={styles.btnHangup}
                onClick={() => setBusyNotification(null)}
                title="確認關閉"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 情況 A：已最小化為 PiP 子母畫面懸浮卡片 */}
      {isMinimized && callState === 'connected' ? (
        <div className={styles.pipFloatingContainer}>
          {/* 頂部控制 */}
          <div className={styles.pipHeader}>
            <div className={styles.pipInfo}>
              <span className={styles.pipName}>{displayName}</span>
              <span className={styles.pipDuration}>{formatDuration(duration)}</span>
            </div>
            <button
              className={styles.pipMaximizeBtn}
              onClick={() => setMinimized(false)}
              title="最大化回到通話主視窗"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* 視訊畫面或 Avatar */}
          <div className={styles.pipBody} onClick={() => setMinimized(false)} style={{ cursor: 'pointer' }}>
            {isRemoteVideoActive ? (
              <video ref={pipVideoRef} autoPlay playsInline className={styles.pipVideoElement} />
            ) : (
              <div className={isRemoteSpeaking ? styles.speakingGlowAvatar : ''}>
                <Avatar src={displayAvatar} name={displayName} size={64} />
              </div>
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
        <div ref={mainHostRef} className={styles.overlay} style={{ display: isPopout ? 'none' : 'flex' }}>
          {callState === 'connected' ? (
            /* 已通話連線 Viewport */
            <div
              ref={callContentRef}
              className={`${styles.container} ${callType === 'video' ? styles.containerVideo : ''}`}
            >
              {/* 頂部視窗控制工具列 (僅保留最小化與獨立視窗，0 多餘X按鈕) */}
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
                      <span className={styles.statusDotConnected} />
                      <span>通話中 · {formatDuration(duration)}</span>
                    </div>
                  </div>

                  <div className={styles.avatarSection}>
                    <div className={`${styles.avatarRing} ${isRemoteSpeaking ? styles.avatarRingSpeaking : ''}`} />
                    <div className={`${styles.avatarRing} ${styles.avatarRing2} ${isRemoteSpeaking ? styles.avatarRingSpeaking : ''}`} />
                    <div className={isRemoteSpeaking ? styles.speakingGlowAvatar : ''}>
                      <Avatar src={displayAvatar} name={displayName} size={96} />
                    </div>
                  </div>

                  <div className={styles.controls}>
                    <button
                      className={`${styles.btnControl} ${isMuted ? styles.btnControlMuted : ''}`}
                      onClick={toggleAudio}
                      title={isMuted ? '取消靜音' : '靜音'}
                    >
                      {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                    <button className={styles.btnHangup} onClick={endCall} title="結束通話">
                      <PhoneOff size={24} />
                    </button>
                  </div>
                </>
              ) : (
                /* 視訊通話佈局 */
                <div className={styles.videoStage}>
                  {isRemoteVideoActive ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />
                  ) : (
                    <div className={styles.videoPlaceholder}>
                      <div className={isRemoteSpeaking ? styles.speakingGlowAvatar : ''}>
                        <Avatar src={displayAvatar} name={displayName} size={88} />
                      </div>
                      <span className={styles.videoPlaceholderText}>{displayName} 已關閉鏡頭</span>
                    </div>
                  )}

                  {!isVideoOff && (
                    <div className={styles.localVideoWrapper}>
                      <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
                      <span className={styles.localVideoBadge}>{myName} (您)</span>
                    </div>
                  )}

                  <div className={styles.videoOverlayInfo}>
                    <span className={styles.videoPeerName}>{displayName}</span>
                    <span className={styles.videoTimerBadge}>{formatDuration(duration)}</span>
                  </div>

                  <div className={styles.videoControls}>
                    <button
                      className={`${styles.btnControl} ${isMuted ? styles.btnControlMuted : ''}`}
                      onClick={toggleAudio}
                      title={isMuted ? '取消靜音' : '靜音'}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button
                      className={`${styles.btnControl} ${isVideoOff ? styles.btnControlMuted : ''}`}
                      onClick={toggleVideo}
                      title={isVideoOff ? '開啟鏡頭' : '關閉鏡頭'}
                    >
                      {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    <button className={styles.btnHangup} onClick={endCall} title="結束通話">
                      <PhoneOff size={22} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 撥號中 (calling) 或 來電中 (incoming) Viewport */
            <div className={styles.container}>
              <div className={styles.header}>
                <h3 className={styles.title}>{displayName}</h3>
                <div className={styles.status}>
                  <span className={styles.statusDotCalling} />
                  <span>
                    {callState === 'calling'
                      ? `正在等待對方接聽 (${callType === 'video' ? '視訊' : '語音'})...`
                      : `邀請您進行 ${callType === 'video' ? '視訊' : '語音'} 通話...`}
                  </span>
                </div>
              </div>

              <div className={styles.avatarSection}>
                <div className={styles.avatarRing} />
                <div className={`${styles.avatarRing} ${styles.avatarRing2}`} />
                <Avatar src={displayAvatar} name={displayName} size={96} />
              </div>

              <div className={styles.controls}>
                {callState === 'incoming' && (
                  <button className={styles.btnAccept} onClick={handleAcceptCall} title="接聽通話">
                    <Phone size={24} />
                  </button>
                )}
                <button className={styles.btnHangup} onClick={endCall} title="拒絕 / 掛斷通話">
                  <PhoneOff size={24} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
