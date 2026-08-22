// Context: [語音訊息] 桌面端專屬語音錄製器，支援 MediaRecorder 錄音、波形動畫與計時
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Mic, Loader2 } from 'lucide-react';
import styles from '../ChatWindow.module.css';

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoice,
  onCancel,
  disabled = false,
}) => {
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      try {
        setIsInitializing(true);
        setErrorMsg(null);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // 優先選擇 webm / opus，其次為 mp4 或預設格式
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
        }

        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        // Context: [多媒體生命週期] 監聽麥克風硬體意外拔除與 MediaRecorder 異常
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.onended = () => {
            if (isMounted) {
              setErrorMsg('麥克風裝置已斷開連線');
              cleanupStream();
            }
          };
        }

        recorder.onerror = (event: any) => {
          console.error('MediaRecorder 錄音異常:', event);
          if (isMounted) {
            setErrorMsg('錄音過程中斷，請重試');
            cleanupStream();
          }
        };

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(200); // 每 200ms 抓取一次 chunk
        setIsInitializing(false);

        // 計時器
        timerRef.current = window.setInterval(() => {
          setRecordingSeconds((prev) => {
            if (prev >= 60) {
              // 超過 60 秒自動發送
              handleStopAndSend();
              return 60;
            }
            return prev + 1;
          });
        }, 1000);
      } catch (err: any) {
        console.error('無法啟動麥克風錄音:', err);
        if (isMounted) {
          setErrorMsg('無法存取麥克風，請檢查瀏覽器權限');
          setIsInitializing(false);
        }
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      cleanupStream();
    };
  }, []);

  const cleanupStream = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleStopAndSend = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      cleanupStream();
      if (audioBlob.size > 0) {
        onSendVoice(audioBlob);
      } else {
        onCancel();
      }
    };

    recorder.stop();
  };

  const handleCancel = () => {
    cleanupStream();
    onCancel();
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  if (errorMsg) {
    return (
      <div className={styles.voiceRecorderContainer} style={{ justifyContent: 'space-between', color: '#f87171' }}>
        <span style={{ fontSize: '0.85rem' }}>{errorMsg}</span>
        <button className={styles.voiceCancelBtn} onClick={handleCancel} title="取消">
          <Trash2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.voiceRecorderContainer}>
      <div className={styles.voiceRecordIndicator}>
        <span className={styles.voiceRecordingDot} />
        <Mic size={18} className={styles.voiceMicIcon} />
        <span className={styles.voiceTimerText}>{formatSeconds(recordingSeconds)}</span>
      </div>

      {/* 音訊跳動波形動畫長條 */}
      <div className={styles.voiceWaveforms}>
        <span className={`${styles.voiceWaveBar} ${styles.wave1}`} />
        <span className={`${styles.voiceWaveBar} ${styles.wave2}`} />
        <span className={`${styles.voiceWaveBar} ${styles.wave3}`} />
        <span className={`${styles.voiceWaveBar} ${styles.wave4}`} />
        <span className={`${styles.voiceWaveBar} ${styles.wave2}`} />
        <span className={`${styles.voiceWaveBar} ${styles.wave1}`} />
      </div>

      <div className={styles.voiceRecorderActions}>
        <button
          type="button"
          className={styles.voiceCancelBtn}
          onClick={handleCancel}
          disabled={disabled || isInitializing}
          title="取消並刪除錄音"
        >
          <Trash2 size={18} />
        </button>

        <button
          type="button"
          className={styles.voiceSendBtn}
          onClick={handleStopAndSend}
          disabled={disabled || isInitializing || recordingSeconds < 1}
          title="發送語音訊息"
        >
          {isInitializing ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};
