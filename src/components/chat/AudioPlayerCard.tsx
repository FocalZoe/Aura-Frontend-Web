// Context: [音訊播放器] 客製化深色玻璃質感 IPFS 音訊播放器，支援播放/暫停、動態波形動畫與進度控制
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music, Download, Loader2 } from 'lucide-react';
import styles from './AudioPlayerCard.module.css';

interface AudioPlayerCardProps {
  src: string;
  fileName: string;
  fileSize?: string;
  isSelf?: boolean;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  src,
  fileName,
  fileSize,
  isSelf = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoadingAudio(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('音訊播放失敗:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = parseFloat(e.target.value);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName || 'audio.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`${styles.audioPlayerCard} ${isSelf ? styles.audioPlayerSelf : ''}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        className={styles.audioPlayBtn}
        onClick={togglePlay}
        disabled={isLoadingAudio}
        title={isPlaying ? '暫停' : '播放'}
      >
        {isLoadingAudio ? (
          <Loader2 size={18} className={styles.spin} />
        ) : isPlaying ? (
          <Pause size={18} />
        ) : (
          <Play size={18} style={{ marginLeft: '2px' }} />
        )}
      </button>

      <div className={styles.audioMainContent}>
        <div className={styles.audioHeader}>
          <div className={styles.audioTitleWrapper}>
            <Music size={14} className={styles.audioMusicIcon} />
            <span className={styles.audioTitle} title={fileName}>
              {fileName.includes('voice-') || fileName.includes('語音') ? '語音訊息' : fileName}
            </span>
          </div>
          {fileSize && <span className={styles.audioSizeText}>{fileSize}</span>}
        </div>

        {/* 動態音訊波形視覺條 */}
        <div className={`${styles.audioWaveVisualizer} ${isPlaying ? styles.wavePlaying : ''}`}>
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '14px' : '4px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '20px' : '6px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '26px' : '10px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '16px' : '6px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '22px' : '8px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '12px' : '4px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '24px' : '8px' }} />
          <span className={styles.waveVisualBar} style={{ height: isPlaying ? '18px' : '6px' }} />
        </div>

        <div className={styles.audioProgressRow}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className={styles.audioSeekSlider}
            style={{
              background: `linear-gradient(to right, var(--primary, #6366f1) ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
            }}
          />
          <div className={styles.audioTimeLabel}>
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.audioDownloadBtn}
        onClick={handleDownload}
        title="下載音訊"
      >
        <Download size={15} />
      </button>
    </div>
  );
};
