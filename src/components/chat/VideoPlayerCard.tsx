// Context: [影片播放器] 現代深色毛玻璃 IPFS 影片播放器，支援自適應容器、全螢幕燈箱檢視與一鍵下載
import React, { useState, useRef } from 'react';
import { Film, Download, Maximize2, X, PlayCircle, Loader2 } from 'lucide-react';
import styles from './VideoPlayerCard.module.css';

interface VideoPlayerCardProps {
  src: string;
  fileName: string;
  fileSize?: string;
  isLoading?: boolean;
}

export const VideoPlayerCard: React.FC<VideoPlayerCardProps> = ({
  src,
  fileName,
  fileSize,
  isLoading = false,
}) => {
  const [showLightbox, setShowLightbox] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName || 'video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePlayToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  if (isLoading || !src) {
    return (
      <div className={styles.videoPlayerLoadingCard}>
        <Loader2 size={20} className={styles.spin} />
        <span>載入與解密影片中...</span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.videoPlayerCard}>
        {/* 頂部懸浮控制資訊列 */}
        <div className={styles.videoHeaderOverlay}>
          <div className={styles.videoMetaInfo}>
            <Film size={14} className={styles.videoFilmIcon} />
            <span className={styles.videoTitleText} title={fileName}>
              {fileName}
            </span>
            {fileSize && <span className={styles.videoSizeBadge}>{fileSize}</span>}
          </div>

          <div className={styles.videoOverlayActions}>
            <button
              type="button"
              className={styles.videoIconBtn}
              onClick={() => setShowLightbox(true)}
              title="放大檢視"
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              className={styles.videoIconBtn}
              onClick={handleDownload}
              title="下載影片"
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* 影片核心元素 */}
        <div className={styles.videoWrapper} onClick={handlePlayToggle}>
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className={styles.videoElement}
          />
          {!isPlaying && (
            <div className={styles.videoCenterPlayBtn}>
              <PlayCircle size={44} />
            </div>
          )}
        </div>
      </div>

      {/* 全螢幕燈箱模式 */}
      {showLightbox && (
        <div
          className={styles.videoLightboxOverlay}
          onClick={() => setShowLightbox(false)}
        >
          <div
            className={styles.videoLightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.videoLightboxCloseBtn}
              onClick={() => setShowLightbox(false)}
              title="關閉"
            >
              <X size={24} />
            </button>
            <video
              src={src}
              controls
              autoPlay
              className={styles.videoLightboxElement}
            />
          </div>
        </div>
      )}
    </>
  );
};
