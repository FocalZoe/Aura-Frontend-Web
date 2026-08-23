// Context: [網址 Embed] 網址訊息多媒體與通用卡片 (安全協議過濾、YouTube 沙箱播放、IPFS 等級玻璃擬態、網站 Favicon)

import React, { useState } from 'react';
import { ExternalLink, Globe, PlayCircle } from 'lucide-react';
import styles from './LinkEmbed.module.css';

// 嚴格安全 URL 檢驗 (僅允許 http/https，防護 XSS 偽協議)
export const isSafeUrl = (targetUrl: string): boolean => {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// 提取網域名稱
export const getDomain = (targetUrl: string): string => {
  try {
    const parsed = new URL(targetUrl.trim());
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return targetUrl;
  }
};

// 解析 YouTube 影片 ID
export const getYouTubeVideoId = (targetUrl: string): string | null => {
  if (!isSafeUrl(targetUrl)) return null;
  try {
    const parsed = new URL(targetUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtube.com')) {
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
    if (host.includes('youtu.be')) {
      return parsed.pathname.substring(1).split('?')[0] || null;
    }
  } catch {}
  return null;
};

interface LinkEmbedProps {
  url: string;
}

export const LinkEmbed: React.FC<LinkEmbedProps> = ({ url }) => {
  const [showIframe, setShowIframe] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  // 安全防禦：非安全 URL 不渲染 Embed
  if (!isSafeUrl(url)) {
    return null;
  }

  const youtubeId = getYouTubeVideoId(url);
  const domain = getDomain(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // 1. YouTube 影片卡片 (固定寬度，切換播放零尺寸跳變)
  if (youtubeId) {
    const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    if (showIframe) {
      return (
        <div className={styles.youtubeEmbedCard}>
          <div className={styles.youtubeIframeWrapper}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className={styles.youtubeIframe}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className={styles.youtubeInfoRow}>
            <div className={styles.youtubeBadge}>YouTube</div>
            <span className={styles.youtubeHintText}>正在播放影片</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
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

    return (
      <div className={styles.youtubeEmbedCard} onClick={() => setShowIframe(true)}>
        <div className={styles.youtubeThumbBox}>
          <img src={thumbnailUrl} alt="YouTube Video Thumbnail" className={styles.youtubeThumbImg} />
          <div className={styles.youtubePlayOverlay}>
            <PlayCircle size={44} className={styles.playIcon} />
          </div>
        </div>
        <div className={styles.youtubeInfoRow}>
          <div className={styles.youtubeBadge}>YouTube</div>
          <span className={styles.youtubeHintText}>點擊即可原地播放</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            className={styles.linkExternalBtn}
            title="在新分頁安全開啟"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  // 2. 通用網站 Embed 卡片 (對齊 IPFS 檔案卡片等級之深色玻璃擬態)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={styles.genericEmbedCard}
      onClick={(e) => e.stopPropagation()}
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
          <Globe size={18} className={styles.linkGlobeIcon} />
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
