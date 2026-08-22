// Context: [網址 Embed] 網址訊息預覽卡片，支援 YouTube 影片卡片與一般網站 Favicon/域名預覽
import React, { useState } from 'react';
import { ExternalLink, Globe, PlayCircle } from 'lucide-react';
import styles from '../ChatWindow.module.css';

interface LinkEmbedProps {
  url: string;
}

export const LinkEmbed: React.FC<LinkEmbedProps> = ({ url }) => {
  const [imgError, setImgError] = useState<boolean>(false);
  const [showIframe, setShowIframe] = useState<boolean>(false);

  // 解析 YouTube 影片 ID
  const getYouTubeVideoId = (targetUrl: string): string | null => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.hostname.includes('youtube.com')) {
        if (parsed.pathname.startsWith('/watch')) {
          return parsed.searchParams.get('v');
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          return parsed.pathname.split('/shorts/')[1]?.split('?')[0] || null;
        }
        if (parsed.pathname.startsWith('/embed/')) {
          return parsed.pathname.split('/embed/')[1]?.split('?')[0] || null;
        }
      }
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.substring(1).split('?')[0] || null;
      }
    } catch (e) {}
    return null;
  };

  const getDomain = (targetUrl: string): string => {
    try {
      const parsed = new URL(targetUrl);
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return targetUrl;
    }
  };

  const youtubeId = getYouTubeVideoId(url);
  const domain = getDomain(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // 1. 若為 YouTube 影片
  if (youtubeId) {
    const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    if (showIframe) {
      return (
        <div className={styles.youtubeEmbedContainer}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.youtubeIframe}
          />
        </div>
      );
    }

    return (
      <div className={styles.youtubeCardPreview} onClick={() => setShowIframe(true)}>
        <div className={styles.youtubeThumbWrapper}>
          <img src={thumbnailUrl} alt="YouTube Video Thumbnail" className={styles.youtubeThumbImg} />
          <div className={styles.youtubePlayOverlay}>
            <PlayCircle size={36} />
          </div>
        </div>
        <div className={styles.youtubeInfoRow}>
          <div className={styles.youtubeBadge}>YouTube</div>
          <span className={styles.youtubeUrlText}>{url}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={styles.linkExternalBtn}
            title="在新分頁開啟"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  // 2. 一般網址卡片
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.linkEmbedCard}
      title={url}
    >
      <div className={styles.linkFaviconBox}>
        {!imgError ? (
          <img
            src={faviconUrl}
            alt={domain}
            onError={() => setImgError(true)}
            className={styles.linkFaviconImg}
          />
        ) : (
          <Globe size={16} className={styles.linkGlobeIcon} />
        )}
      </div>

      <div className={styles.linkEmbedContent}>
        <div className={styles.linkDomainName}>{domain}</div>
        <div className={styles.linkFullUrl}>{url}</div>
      </div>

      <div className={styles.linkExternalIcon}>
        <ExternalLink size={14} />
      </div>
    </a>
  );
};
