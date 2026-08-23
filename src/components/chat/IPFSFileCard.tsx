import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { e2eeService } from '../../services/e2eeService';
import { Loader2, X, File, Download } from 'lucide-react';
import { IPFSFilePayload } from '../../types';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, decryptFileBuffer } from '../../utils/crypto';
import { fetchFromIPFS } from '../../utils/ipfs';
import { getApiBase } from '../../services/apiClient';
import { AudioPlayerCard } from './AudioPlayerCard';
import { VideoPlayerCard } from './VideoPlayerCard';
import styles from '../ChatWindow.module.css';

export interface IPFSFileCardProps {
  payload: IPFSFilePayload;
  iv?: string;
  senderId: number;
  partnerId: number;
  partnerPublicKeyBase64?: string;
  groupId?: number;
}

export const IPFSFileCard: React.FC<IPFSFileCardProps> = ({
  payload,
  iv,
  senderId,
  partnerId,
  partnerPublicKeyBase64,
  groupId,
}) => {
  const { user, API_BASE } = useContext(AuthContext);
  const { notify } = useNotification();
  const [downloading, setDownloading] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImage =
    (payload.mime && payload.mime.startsWith('image/')) ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(payload.name);
  const isVideo =
    (payload.mime && payload.mime.startsWith('video/')) ||
    /\.(mp4|webm|mov|mkv|ogg)$/i.test(payload.name);
  const isAudio =
    (payload.mime && payload.mime.startsWith('audio/')) ||
    /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(payload.name);

  const handleDownload = async () => {
    const targetIv = payload.iv || iv;
    if (!user || !targetIv) return;
    setDownloading(true);

    try {
      const encryptedBuffer = await fetchFromIPFS(payload.cid, API_BASE || getApiBase());
      let decryptedBuffer: ArrayBuffer;

      if (groupId) {
        const groupKey = await e2eeService.getGroupKey(groupId);
        decryptedBuffer = await decryptFileBuffer(groupKey, encryptedBuffer, targetIv);
      } else {
        const authToken = localStorage.getItem('token') || '';
        const sharedKey = await e2eeService.getSharedKey(partnerId, user.id, authToken);
        if (!sharedKey) {
          notify({ message: '無法開啟檔案，通訊金鑰初始化中', type: 'warning' });
          return;
        }
        decryptedBuffer = await decryptFileBuffer(sharedKey, encryptedBuffer, targetIv);
      }

      const blob = new Blob([decryptedBuffer], { type: payload.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      if (isImage || isVideo || isAudio) {
        setPreviewUrl(url);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = payload.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('檔案讀取失敗:', err);
      notify({ message: '下載失敗，請稍後重試', type: 'danger' });
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if ((isImage || isVideo || isAudio) && !previewUrl && !downloading) {
      handleDownload();
    }
  }, [payload.cid, isImage, isVideo, isAudio]);

  const isSelf = user ? Number(user.id) === Number(senderId) : false;

  // 1. 音訊渲染
  if (isAudio) {
    if (previewUrl) {
      return (
        <AudioPlayerCard
          src={previewUrl}
          fileName={payload.name}
          fileSize={formatFileSize(payload.size)}
          isSelf={isSelf}
        />
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <Loader2 size={18} className={styles.spin} />
        <span>載入與解密語音中...</span>
      </div>
    );
  }

  // 2. 影片渲染
  if (isVideo) {
    return (
      <VideoPlayerCard
        src={previewUrl || ''}
        fileName={payload.name}
        fileSize={formatFileSize(payload.size)}
        isLoading={!previewUrl || downloading}
      />
    );
  }

  // 3. 圖片渲染
  if (isImage) {
    return (
      <>
        {previewUrl ? (
          <div onClick={() => setShowLightbox(true)} title="點擊檢視大圖" style={{ cursor: 'pointer' }}>
            <img src={previewUrl} alt={payload.name} style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '10px', display: 'block' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Loader2 size={18} className={styles.spin} />
            <span>載入圖片中...</span>
          </div>
        )}

        {showLightbox && previewUrl && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLightbox(false)}>
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
              <button style={{ position: 'absolute', top: '-36px', right: 0, color: '#fff', cursor: 'pointer' }} onClick={() => setShowLightbox(false)}>
                <X size={24} />
              </button>
              <img src={previewUrl} alt={payload.name} style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px' }} />
            </div>
          </div>
        )}
      </>
    );
  }

  // 4. 一般檔案渲染
  return (
    <div className={styles.ipfsFileCard}>
      <div className={styles.ipfsFileIcon}>
        <File size={20} />
      </div>
      <div className={styles.ipfsFileInfo}>
        <div className={styles.ipfsFileName} title={payload.name}>{payload.name}</div>
        <div className={styles.ipfsFileSize}>{formatFileSize(payload.size)} • 安全檔案</div>
      </div>
      <button className="uiBtnSecondary" onClick={handleDownload} disabled={downloading} style={{ height: '32px', padding: '0 12px', fontSize: '0.78rem' }}>
        {downloading ? <Loader2 size={14} className={styles.spin} /> : <Download size={14} />}
        <span>{downloading ? '下載中...' : '下載檔案'}</span>
      </button>
    </div>
  );
};

