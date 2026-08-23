// Context: 媒體與檔案庫卡片組件 (支援 E2EE/GroupKey 自動解密縮圖、點擊大圖 Lightbox 與下載)
import React, { useState, useEffect } from 'react';
import { IPFSFilePayload } from '../../types';
import { e2eeService } from '../../services/e2eeService';
import { decryptFileBuffer } from '../../utils/crypto';
import { fetchFromIPFS } from '../../utils/ipfs';
import { getApiBase } from '../../services/apiClient';
import { FileText, Film, Music, Download, Loader2, X, AlertCircle } from 'lucide-react';
import styles from './MediaGalleryCard.module.css';

interface MediaGalleryCardProps {
  payload: IPFSFilePayload;
  groupId?: number;
  partnerId?: number;
  currentUserId: number;
}

export const MediaGalleryCard: React.FC<MediaGalleryCardProps> = ({
  payload,
  groupId,
  partnerId,
  currentUserId,
}) => {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);

  const isImage =
    (payload.mime && payload.mime.startsWith('image/')) ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(payload.name);
  const isVideo =
    (payload.mime && payload.mime.startsWith('video/')) ||
    /\.(mp4|webm|mov|mkv|ogg)$/i.test(payload.name);
  const isAudio =
    (payload.mime && payload.mime.startsWith('audio/')) ||
    /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(payload.name);

  // 自動解密圖片縮圖
  useEffect(() => {
    let isMounted = true;
    let localUrl = '';

    const loadMedia = async () => {
      if (!payload.cid || !isImage) return;

      setLoading(true);
      setError(false);
      try {
        const targetIv = payload.iv;
        if (!targetIv) throw new Error('缺少 IV 向量');

        const encryptedBuffer = await fetchFromIPFS(payload.cid, getApiBase());
        let decryptedBuffer: ArrayBuffer;

        if (groupId) {
          const groupKey = await e2eeService.getGroupKey(groupId);
          decryptedBuffer = await decryptFileBuffer(groupKey, encryptedBuffer, targetIv);
        } else if (partnerId && currentUserId) {
          const authToken = localStorage.getItem('token') || '';
          const sharedKey = await e2eeService.getSharedKey(partnerId, currentUserId, authToken);
          if (!sharedKey) throw new Error('金鑰尚未就緒');
          decryptedBuffer = await decryptFileBuffer(sharedKey, encryptedBuffer, targetIv);
        } else {
          throw new Error('缺少解密參數');
        }

        if (isMounted) {
          const blob = new Blob([decryptedBuffer], { type: payload.mime || 'image/jpeg' });
          localUrl = URL.createObjectURL(blob);
          setDecryptedUrl(localUrl);
        }
      } catch (err) {
        console.error('媒體庫縮圖解密失敗:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMedia();

    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [payload.cid, payload.iv, groupId, partnerId, currentUserId, isImage]);

  // 點擊執行解密並下載
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (decryptedUrl) {
      const a = document.createElement('a');
      a.href = decryptedUrl;
      a.download = payload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setDownloading(true);
    try {
      const targetIv = payload.iv;
      if (!targetIv) throw new Error('缺少 IV 向量');

      const encryptedBuffer = await fetchFromIPFS(payload.cid, getApiBase());
      let decryptedBuffer: ArrayBuffer;

      if (groupId) {
        const groupKey = await e2eeService.getGroupKey(groupId);
        decryptedBuffer = await decryptFileBuffer(groupKey, encryptedBuffer, targetIv);
      } else if (partnerId && currentUserId) {
        const authToken = localStorage.getItem('token') || '';
        const sharedKey = await e2eeService.getSharedKey(partnerId, currentUserId, authToken);
        if (!sharedKey) throw new Error('金鑰尚未就緒');
        decryptedBuffer = await decryptFileBuffer(sharedKey, encryptedBuffer, targetIv);
      } else {
        throw new Error('缺少解密參數');
      }

      const blob = new Blob([decryptedBuffer], { type: payload.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = payload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下載失敗:', err);
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div
        className={styles.galleryCard}
        onClick={() => {
          if (isImage && decryptedUrl) {
            setShowLightbox(true);
          } else {
            handleDownload({ stopPropagation: () => {} } as any);
          }
        }}
        title={payload.name}
      >
        {isImage ? (
          decryptedUrl ? (
            <img src={decryptedUrl} alt={payload.name} className={styles.galleryThumb} />
          ) : loading ? (
            <div className={styles.loadingWrapper}>
              <Loader2 size={18} className={styles.spin} />
              <span className={styles.loadingText}>解密中...</span>
            </div>
          ) : error ? (
            <div className={styles.errorWrapper}>
              <AlertCircle size={20} color="#ef4444" />
              <span className={styles.errorText}>解密失敗</span>
            </div>
          ) : (
            <div className={styles.loadingWrapper}>
              <Loader2 size={18} className={styles.spin} />
            </div>
          )
        ) : (
          <div className={styles.fileCardBody}>
            <div className={styles.fileIconBox}>
              {isVideo ? (
                <Film size={22} color="#a855f7" />
              ) : isAudio ? (
                <Music size={22} color="#10b981" />
              ) : (
                <FileText size={22} color="var(--accent-color)" />
              )}
            </div>
            <span className={styles.fileName}>{payload.name}</span>
            <span className={styles.fileSize}>{formatFileSize(payload.size)}</span>
          </div>
        )}

        {/* 懸停下載按鈕徽章 */}
        <button
          type="button"
          className={styles.downloadOverlayBtn}
          onClick={handleDownload}
          disabled={downloading}
          title="下載檔案"
        >
          {downloading ? <Loader2 size={14} className={styles.spin} /> : <Download size={14} />}
        </button>
      </div>

      {/* 圖片點擊全螢幕大圖 Lightbox */}
      {showLightbox && decryptedUrl && (
        <div className={styles.lightboxOverlay} onClick={() => setShowLightbox(false)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <img src={decryptedUrl} alt={payload.name} className={styles.lightboxImg} />
            <div className={styles.lightboxToolbar}>
              <span className={styles.lightboxTitle}>{payload.name}</span>
              <button
                type="button"
                className={styles.lightboxActionBtn}
                onClick={handleDownload}
                title="下載圖片"
              >
                <Download size={18} />
              </button>
              <button
                type="button"
                className={styles.lightboxCloseBtn}
                onClick={() => setShowLightbox(false)}
                title="關閉預覽"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
