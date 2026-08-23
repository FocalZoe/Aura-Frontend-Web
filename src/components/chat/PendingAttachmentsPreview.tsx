// Context: 待發送附件預覽條 (支援 Instagram 多圖堆疊預覽、檔案卡片與個別刪除)
import React, { useMemo } from 'react';
import { FileText, Film, Music, X } from 'lucide-react';
import styles from './PendingAttachmentsPreview.module.css';

interface PendingAttachmentsPreviewProps {
  files: File[];
  onRemoveFile: (index: number) => void;
}

export const PendingAttachmentsPreview: React.FC<PendingAttachmentsPreviewProps> = ({
  files,
  onRemoveFile,
}) => {
  // 快取圖片 Object URL
  const fileItems = useMemo(() => {
    return files.map((file, index) => {
      const isImage = (file.type && file.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(file.name);
      const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mov|mkv|ogg)$/i.test(file.name);
      const isAudio = (file.type && file.type.startsWith('audio/')) || /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(file.name);
      let url = '';
      if (isImage) {
        try {
          url = URL.createObjectURL(file);
        } catch (e) {
          console.error('建立預覽 URL 失敗:', e);
        }
      }
      return { file, index, isImage, isVideo, isAudio, url };
    });
  }, [files]);

  if (files.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.previewContainer}>
      {fileItems.map((item) => {
        if (item.isImage) {
          return (
            <div key={item.index} className={styles.imageCard}>
              <img src={item.url} alt={item.file.name} className={styles.imageThumb} />
              {files.length > 1 && (
                <span className={styles.imageBadge}>
                  {item.index + 1}/{files.length}
                </span>
              )}
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => onRemoveFile(item.index)}
                title="移除此圖片"
              >
                <X size={12} />
              </button>
            </div>
          );
        }

        return (
          <div key={item.index} className={styles.fileCard}>
            <div className={styles.fileIconWrapper}>
              {item.isVideo ? (
                <Film size={20} />
              ) : item.isAudio ? (
                <Music size={20} />
              ) : (
                <FileText size={20} />
              )}
            </div>
            <div className={styles.fileMeta}>
              <span className={styles.fileName} title={item.file.name}>
                {item.file.name}
              </span>
              <span className={styles.fileSize}>{formatFileSize(item.file.size)}</span>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onRemoveFile(item.index)}
              title="移除此檔案"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
