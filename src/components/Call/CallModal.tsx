// TEAM_014: 通話 Modal 組件 (完全統一步調影音 Viewport、畫中畫顯示個人頭像與獨立聲軌播放器)
import React, { useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneIncoming,
  AlertCircle,
} from 'lucide-react';
import { useCallStore } from '../../stores/useCallStore';
import { useChatStore } from '../../stores/useChatStore';
import { useAuthStore } from '../../stores/useAuthStore';
import styles from './CallModal.module.css';

class CallSoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;

  private initCtx() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public startRingtone() {
    this.stop();
    this.initCtx();
    if (!this.audioCtx) return;

    const playTone = () => {
      if (!this.audioCtx) return;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      osc2.frequency.setValueAtTime(480, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.audioCtx.currentTime + 1.2);
      osc2.stop(this.audioCtx.currentTime + 1.2);
    };

    playTone();
    this.intervalId = setInterval(playTone, 3000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

const synthesizer = new CallSoundSynthesizer();

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
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    setBusyNotification,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // 本地使用者頭像資訊
  const myUser = useAuthStore((s: any) => s.user);
  const myAvatar = myUser?.avatar;
  const myName = myUser?.display_name || myUser?.account_id || '我';

  // 對手使用者頭像資訊
  const friends = useChatStore((s: any) => s.friends);
  const friendObj = friends ? friends.find((f: any) => Number(f.id) === Number(peerUser?.id)) : undefined;
  const displayAvatar = peerUser?.avatar || friendObj?.avatar;
  const displayName = peerUser?.name || friendObj?.display_name || friendObj?.account_id || '未知使用者';

  // 判斷對方是否有活躍的視訊軌 (包含即時媒體開關信號)
  const isRemoteVideoActive =
    !isRemoteVideoOff &&
    remoteStream &&
    remoteStream.getVideoTracks().some((t) => t.enabled && !t.muted && t.readyState === 'live');

  // 綁定影音串流至 DOM 元素 (包含模式切換與 DOM 重新掛載)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      console.log('[CallModal] Attaching remoteStream. AudioTracks:', remoteStream.getAudioTracks().length);
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().then(() => {
        console.log('[CallModal] Remote audio playing successfully!');
      }).catch((err) => {
        console.warn('[CallModal] Autoplay remote audio error:', err);
      });
    }
  }, [remoteStream, callState, isRemoteVideoActive]);

  // 控制響鈴音效
  useEffect(() => {
    if (callState === 'calling' || callState === 'incoming') {
      synthesizer.startRingtone();
    } else {
      synthesizer.stop();
    }
    return () => {
      synthesizer.stop();
    };
  }, [callState]);

  // 自動清除忙線提示
  useEffect(() => {
    if (busyNotification) {
      const timer = setTimeout(() => {
        setBusyNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [busyNotification, setBusyNotification]);

  // 格式化計時器 (如 02:15)
  const formatDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (callState === 'idle' && !busyNotification) {
    return null;
  }

  const handleAcceptCall = async () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch(() => {});
    }
    await acceptCall();
  };

  return (
    <>
      {/* 獨立音訊播放器 (使用移位非 display:none 避開 Chrome 隱藏媒體組件靜音機制) */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted={false}
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
      />

      {/* 忙線與通知提示 Toast */}
      {busyNotification && (
        <div className={styles.busyToast}>
          <AlertCircle size={20} color="#f59e0b" />
          <span>{busyNotification}</span>
        </div>
      )}

      {callState !== 'idle' && (
        <div className={styles.overlay}>
          {callState === 'connected' ? (
            /* 已連線狀態：完全使用統一視訊 Viewport 架構 (已完全移除純語音獨立樣式) */
            <div className={`${styles.container} ${styles.containerVideo}`}>
              <div className={styles.videoViewport}>
                {/* 遠端畫面或關閉鏡頭大頭照 fallback */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={styles.remoteVideo}
                  style={{ display: isRemoteVideoActive ? 'block' : 'none' }}
                />
                {!isRemoteVideoActive && (
                  <div className={styles.remoteVideoFallback}>
                    <div className={styles.avatarSection} style={{ margin: 0 }}>
                      {displayAvatar ? (
                        <img src={displayAvatar} alt={displayName} className={styles.avatar} />
                      ) : (
                        <div className={styles.avatarFallback}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={styles.remoteOffBadge}>
                      <VideoOff size={18} color="#94a3b8" />
                      <span>對方已關閉鏡頭</span>
                    </div>
                  </div>
                )}

                {/* 本地畫中畫 (PiP)：開啟顯示鏡頭，關閉時顯示個人頭像而非 Icon */}
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
                    {myAvatar ? (
                      <img src={myAvatar} alt={myName} className={styles.pipAvatar} />
                    ) : (
                      <div className={styles.pipAvatarFallback}>
                        {myName.charAt(0).toUpperCase()}
                      </div>
                    )}
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

                {/* 底部控制工具列 */}
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
            </div>
          ) : (
            /* 撥號中 / 來電響鈴中 Viewport */
            <div className={styles.container}>
              <div className={styles.header}>
                <h3 className={styles.title}>{displayName}</h3>
                <div className={styles.status}>
                  <span className={`${styles.statusDot} ${styles.statusDotCalling}`} />
                  <span>
                    {callState === 'calling' && '正在撥號連線中...'}
                    {callState === 'incoming' &&
                      `來電中 (${callType === 'video' ? '視訊通話' : '語音通話'})`}
                    {callState === 'ended' && '通話已結束'}
                  </span>
                </div>
              </div>

              <div className={styles.avatarSection}>
                <div className={styles.avatarRing} />
                <div className={`${styles.avatarRing} ${styles.avatarRing2}`} />
                {displayAvatar ? (
                  <img src={displayAvatar} alt={displayName} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
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
