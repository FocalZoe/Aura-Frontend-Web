// Context: [通用頭像系統] 全站統一 Avatar 組件，支援自訂圖片、IPFS CID、縮寫漸層與在線狀態
import React, { useState, useEffect } from 'react';
import { getApiBase } from '../../services/apiClient';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  isOnline?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

const GRADIENTS = [
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #10b981, #047857)',
  'linear-gradient(135deg, #f59e0b, #b45309)',
  'linear-gradient(135deg, #06b6d4, #0e7490)',
  'linear-gradient(135deg, #6366f1, #4338ca)',
];

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  size = 'md',
  isOnline,
  onClick,
  className = '',
  alt,
  style = {},
}) => {
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  let pixelSize = 40;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'xs':
        pixelSize = 24;
        break;
      case 'sm':
        pixelSize = 32;
        break;
      case 'md':
        pixelSize = 40;
        break;
      case 'lg':
        pixelSize = 56;
        break;
      case 'xl':
        pixelSize = 80;
        break;
    }
  }

  const initial = (name || '?').trim().charAt(0).toUpperCase();

  // 計算確定性漸層色彩
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + (name || '').charCodeAt(i);
    hash |= 0;
  }
  const gradient = GRADIENTS[Math.abs(hash) % GRADIENTS.length];

  // 判斷是否為 IPFS CID 或外部/本地圖片 URL
  let finalSrc = src;
  if (src) {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) {
      finalSrc = src;
    } else if (src.startsWith('Qm') || src.startsWith('baf') || !src.includes('/')) {
      // 支援所有 IPFS CID 格式 (Qm..., bafy..., bafk..., bafkrei... 等)
      const base = getApiBase();
      finalSrc = `${base}/ipfs/gateway/${src}`;
    }
  }

  const containerStyle: React.CSSProperties = {
    width: `${pixelSize}px`,
    height: `${pixelSize}px`,
    minWidth: `${pixelSize}px`,
    minHeight: `${pixelSize}px`,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    userSelect: 'none',
    cursor: onClick ? 'pointer' : 'default',
    flexShrink: 0,
    background: !finalSrc || imageError ? gradient : 'transparent',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: `${Math.max(10, Math.floor(pixelSize * 0.42))}px`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.15s ease, filter 0.15s ease',
    ...style,
  };

  const statusDotSize = Math.max(8, Math.floor(pixelSize * 0.26));

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      title={name || alt}
    >
      {finalSrc && !imageError ? (
        <img
          src={finalSrc}
          alt={alt || name || 'Avatar'}
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <span>{initial}</span>
      )}

      {isOnline !== undefined && (
        <span
          style={{
            position: 'absolute',
            bottom: '1px',
            right: '1px',
            width: `${statusDotSize}px`,
            height: `${statusDotSize}px`,
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--status-online, #10b981)' : 'var(--status-offline, #4b5563)',
            border: '2px solid var(--bg-modal, #151c2c)',
            boxShadow: isOnline ? '0 0 8px rgba(16, 185, 129, 0.8)' : 'none',
          }}
        />
      )}
    </div>
  );
};
