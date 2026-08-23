// Context: [對話截圖] 高畫質對話截圖生成與預覽彈窗 (Canvas 2D 渲染、發送者姓名、系統公告、IPFS 圖片/檔案、網址 Embed 預覽、匿名模式、複製與下載)

import React, { useEffect, useRef, useState, useContext } from 'react';
import { BaseModal } from '../common/BaseModal';
import { Message, User } from '../../types';
import { AuthContext } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useChatStore } from '../../stores/useChatStore';
import { e2eeService } from '../../services/e2eeService';
import { fetchFromIPFS } from '../../utils/ipfs';
import { getApiBase } from '../../services/apiClient';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, decryptFileBuffer } from '../../utils/crypto';
import { Copy, Download, Sparkles } from 'lucide-react';
import styles from './ChatScreenshotModal.module.css';

interface ChatScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isAnonymous: boolean;
  currentUserId: number;
  partnerUser?: User | null;
  groupName?: string | null;
  groupId?: number;
  isGroup?: boolean;
  groupMembersMap?: Record<number, { user?: User; nickname?: string }>;
}

export const ChatScreenshotModal: React.FC<ChatScreenshotModalProps> = ({
  isOpen,
  onClose,
  messages,
  isAnonymous,
  currentUserId,
  partnerUser,
  groupName,
  groupId,
  isGroup = false,
  groupMembersMap,
}) => {
  const { user, token, API_BASE } = useContext(AuthContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const { notify } = useNotification();
  const { getUserDisplayName, friendsMap } = useChatStore();

  const loadHTMLImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  useEffect(() => {
    if (!isOpen || messages.length === 0) return;

    let isMounted = true;
    setIsRendering(true);

    const renderScreenshot = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 640;
      const padding = 24;
      const bubbleMaxWidth = 440;

      // 1. 預先非同步加載 IPFS 圖片與 YouTube 縮圖
      const loadedImagesMap: Record<number, HTMLImageElement> = {};
      const loadedEmbedThumbnails: Record<number, HTMLImageElement> = {};

      const imageLoadPromises = messages.map(async (m) => {
        if (!m.id) return;

        // A. IPFS 圖片解密載入
        if (m.filePayload) {
          const mime = m.filePayload.mime || '';
          const name = m.filePayload.name || '';
          const isImg = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);

          if (isImg && user) {
            try {
              const targetIv = m.filePayload.iv || m.iv;
              if (!targetIv) return;

              const encryptedBuffer = await fetchFromIPFS(m.filePayload.cid, API_BASE || getApiBase());
              let decryptedBuffer: ArrayBuffer | null = null;

              const targetGroupId = groupId || (m as any).group_id;
              if (isGroup && targetGroupId) {
                const groupKey = await e2eeService.getGroupKey(targetGroupId);
                decryptedBuffer = await decryptFileBuffer(groupKey, encryptedBuffer, targetIv);
              } else if (partnerUser || m.sender_id) {
                const targetPartnerId = m.sender_id === user.id ? (partnerUser?.id || 0) : m.sender_id;
                let partnerPubKey: string | undefined = partnerUser?.public_key || friendsMap[targetPartnerId];
                if (!partnerPubKey && token) {
                  partnerPubKey = await e2eeService.fetchUserPublicKey(targetPartnerId, token);
                }
                const privateKey = await getLocalPrivateKey(user.id);
                if (partnerPubKey && privateKey) {
                  const importedKey = await importPublicKey(partnerPubKey);
                  const sharedKey = await deriveSharedKey(privateKey, importedKey);
                  decryptedBuffer = await decryptFileBuffer(sharedKey, encryptedBuffer, targetIv);
                }
              }

              if (decryptedBuffer) {
                const blob = new Blob([decryptedBuffer], { type: mime || 'image/png' });
                const blobUrl = URL.createObjectURL(blob);
                const imgEl = await loadHTMLImage(blobUrl);
                if (imgEl) {
                  loadedImagesMap[m.id] = imgEl;
                }
              }
            } catch (e) {
              console.error('[Screenshot] Image decrypt error:', e);
            }
          }
        }

        // B. 網址 Embed YouTube 縮圖載入
        if (m.content && !m.filePayload && !m.is_system) {
          const urlMatch = m.content.match(/(https?:\/\/[^\s]+)/i);
          if (urlMatch) {
            const url = urlMatch[0];
            let ytId: string | null = null;
            try {
              const parsed = new URL(url);
              if (parsed.hostname.includes('youtube.com') && parsed.pathname.startsWith('/watch')) {
                ytId = parsed.searchParams.get('v');
              } else if (parsed.hostname.includes('youtu.be')) {
                ytId = parsed.pathname.substring(1).split('?')[0] || null;
              }
            } catch (e) {}

            if (ytId) {
              const ytThumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
              const imgEl = await loadHTMLImage(ytThumbUrl);
              if (imgEl) {
                loadedEmbedThumbnails[m.id] = imgEl;
              }
            }
          }
        }
      });

      await Promise.all(imageLoadPromises);
      if (!isMounted) return;

      // 建立匿名編號與色彩映射字典
      const userMeta: Record<number, { num: string; name: string; color: string }> = {};
      const COLOR_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#3b82f6', '#14b8a6'];
      let anonCounter = 1;

      const resolveSenderName = (senderId: number, msgObj?: Message): string => {
        if (isAnonymous) {
          return `用戶 ${userMeta[senderId]?.num || '?'}`;
        }
        if (senderId === currentUserId) {
          return '我';
        }
        if (groupMembersMap && groupMembersMap[senderId]) {
          const member = groupMembersMap[senderId];
          if (member.nickname) return member.nickname;
          if (member.user) return getUserDisplayName(member.user);
        }
        if (msgObj?.sender) {
          return getUserDisplayName(msgObj.sender);
        }
        if (partnerUser && partnerUser.id === senderId) {
          return getUserDisplayName(partnerUser);
        }
        return `用戶 #${senderId}`;
      };

      messages.forEach((m) => {
        if (m.is_system) return;
        if (!userMeta[m.sender_id]) {
          const color = COLOR_PALETTE[(anonCounter - 1) % COLOR_PALETTE.length];
          const isSelf = m.sender_id === currentUserId;
          const assignedNum = `${anonCounter++}`;
          const resolvedName = resolveSenderName(m.sender_id, m);

          userMeta[m.sender_id] = {
            num: assignedNum,
            name: resolvedName,
            color: isSelf ? '#4f46e5' : color,
          };
        }
      });

      // 預計算各訊息元素尺寸
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const renderedItems: {
        isSystem: boolean;
        isSelf: boolean;
        senderName: string;
        lines: string[];
        height: number;
        pillWidth?: number;
        isFile?: boolean;
        isImage?: boolean;
        imageElement?: HTMLImageElement;
        imageRenderWidth?: number;
        imageRenderHeight?: number;
        hasUrlEmbed?: boolean;
        embedDomain?: string;
        embedUrl?: string;
        embedThumbnail?: HTMLImageElement;
        fileName?: string;
        fileSizeStr?: string;
      }[] = [];

      messages.forEach((m) => {
        if (m.is_system) {
          const text = m.content || '';
          ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const metrics = ctx.measureText(text);
          const pillWidth = Math.min(metrics.width + 36, width - padding * 2);
          renderedItems.push({
            isSystem: true,
            isSelf: false,
            senderName: '',
            lines: [text],
            height: 32,
            pillWidth,
          });
          return;
        }

        const isSelf = m.sender_id === currentUserId;
        const senderName = resolveSenderName(m.sender_id, m);
        let text = m.content || '';
        let isFile = false;
        let isImage = false;
        let imageElement: HTMLImageElement | undefined = undefined;
        let imageRenderWidth = 0;
        let imageRenderHeight = 0;
        let fileName = '';
        let fileSizeStr = '';

        if (m.is_recalled || text === '[RECALLED]') {
          text = isSelf ? '您已收回一則訊息' : `${senderName} 已收回一則訊息`;
        } else if (m.filePayload) {
          isFile = true;
          fileName = m.filePayload.name || '未命名檔案';
          fileSizeStr = `${Math.round(m.filePayload.size / 1024)} KB`;

          if (m.id && loadedImagesMap[m.id]) {
            isImage = true;
            imageElement = loadedImagesMap[m.id];
            const maxW = 240;
            const maxH = 180;
            const aspect = (imageElement.height || 1) / (imageElement.width || 1);
            imageRenderWidth = maxW;
            imageRenderHeight = Math.min(Math.max(maxW * aspect, 100), maxH);
          }
        }

        // 檢查網址 Embed
        let hasUrlEmbed = false;
        let embedDomain = '';
        let embedUrl = '';
        let embedThumbnail: HTMLImageElement | undefined = undefined;

        if (!isFile && !m.is_recalled && text) {
          const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
          if (urlMatch) {
            hasUrlEmbed = true;
            embedUrl = urlMatch[0];
            try {
              embedDomain = new URL(embedUrl).hostname.replace(/^www\./, '');
            } catch (e) {
              embedDomain = embedUrl;
            }
            if (m.id && loadedEmbedThumbnails[m.id]) {
              embedThumbnail = loadedEmbedThumbnails[m.id];
            }
          }
        }

        const lines: string[] = [];
        if (isImage) {
          // 圖片模式
        } else if (isFile) {
          lines.push(fileName);
          lines.push(fileSizeStr);
        } else {
          ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const words = text.split('');
          let currentLine = '';

          for (let i = 0; i < words.length; i++) {
            const char = words[i];
            if (char === '\n') {
              lines.push(currentLine);
              currentLine = '';
              continue;
            }
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > bubbleMaxWidth - 36 && i > 0) {
              lines.push(currentLine);
              currentLine = char;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
        }

        const nameHeight = (!isSelf && !isAnonymous) ? 18 : 0;
        let contentHeight = 0;

        if (isImage) {
          contentHeight = imageRenderHeight + 14;
        } else if (isFile) {
          contentHeight = 48;
        } else {
          const textHeight = Math.max(lines.length * 20, 20);
          const embedExtraHeight = hasUrlEmbed ? (embedThumbnail ? 90 : 54) : 0;
          contentHeight = textHeight + embedExtraHeight + 20;
        }

        const bubbleHeight = contentHeight + nameHeight;

        renderedItems.push({
          isSystem: false,
          isSelf,
          senderName,
          lines,
          height: bubbleHeight,
          isFile,
          isImage,
          imageElement,
          imageRenderWidth,
          imageRenderHeight,
          hasUrlEmbed,
          embedDomain,
          embedUrl,
          embedThumbnail,
          fileName,
          fileSizeStr,
        });
      });

      const totalMessagesHeight = renderedItems.reduce((acc, item) => acc + item.height + 12, 0);
      const totalHeight = padding * 2 + totalMessagesHeight;

      // 設置 Retina 畫質縮放
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // 繪製深色暗夜漸層背景
      const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
      bgGrad.addColorStop(0, '#0b0f19');
      bgGrad.addColorStop(1, '#070a12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, totalHeight);

      // 逐筆繪製訊息
      let currentY = padding;

      renderedItems.forEach((item, idx) => {
        const msg = messages[idx];

        // 1. 繪製系統公告訊息 (置中膠囊)
        if (item.isSystem) {
          const pillWidth = item.pillWidth || 200;
          const pillHeight = 26;
          const pillX = (width - pillWidth) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pillX, currentY + 3, pillWidth, pillHeight, 13);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();
          ctx.restore();

          ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.lines[0], width / 2, currentY + 16);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';

          currentY += item.height + 12;
          return;
        }

        const isSelf = item.isSelf;
        const meta = userMeta[msg.sender_id] || { num: '?', name: item.senderName, color: '#3b82f6' };

        // 計算氣泡寬度
        let maxLineWidth = 0;
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        item.lines.forEach((l) => {
          const w = ctx.measureText(l).width;
          if (w > maxLineWidth) maxLineWidth = w;
        });

        if (item.isImage) {
          maxLineWidth = item.imageRenderWidth || 240;
        } else if (item.hasUrlEmbed) {
          maxLineWidth = Math.max(maxLineWidth, 240);
        } else if (item.isFile) {
          maxLineWidth = Math.max(maxLineWidth, 220);
        }

        const bubbleWidth = item.isImage
          ? (item.imageRenderWidth || 240) + 16
          : Math.min(Math.max(maxLineWidth + 34, 88), bubbleMaxWidth);

        const bubbleX = isSelf ? width - padding - bubbleWidth : padding + 40;
        const bubbleY = currentY + (!isSelf && !isAnonymous ? 18 : 0);
        const actualBubbleHeight = item.height - (!isSelf && !isAnonymous ? 18 : 0);

        // 繪製他人頭像與上方名字
        if (!isSelf) {
          // 上方姓名
          if (!isAnonymous) {
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(item.senderName, bubbleX, currentY + 12);
          }

          // 左側圓形頭像 (底部對齊氣泡底部)
          const avatarY = bubbleY + actualBubbleHeight - 16;
          ctx.beginPath();
          ctx.arc(padding + 16, avatarY, 15, 0, Math.PI * 2);
          ctx.fillStyle = meta.color;
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const avatarLetter = isAnonymous ? meta.num : (item.senderName.charAt(0) || '友');
          ctx.fillText(avatarLetter, padding + 16, avatarY);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }

        // 繪製氣泡圓角矩形
        ctx.save();
        ctx.beginPath();
        const r = 14;
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, actualBubbleHeight, r);

        if (msg.is_recalled) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.stroke();
        } else if (isSelf) {
          const selfGrad = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX + bubbleWidth, bubbleY + actualBubbleHeight);
          selfGrad.addColorStop(0, '#2563eb');
          selfGrad.addColorStop(1, '#3b82f6');
          ctx.fillStyle = selfGrad;
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();
        }
        ctx.restore();

        // 繪製內容：圖片 / 檔案卡片 / 網址 Embed / 純文字
        if (item.isImage && item.imageElement) {
          // 繪製圓角圖片
          const imgW = item.imageRenderWidth || 240;
          const imgH = item.imageRenderHeight || 160;
          const imgX = bubbleX + (bubbleWidth - imgW) / 2;
          const imgY = bubbleY + 8;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(imgX, imgY, imgW, imgH, 10);
          ctx.clip();
          ctx.drawImage(item.imageElement, imgX, imgY, imgW, imgH);
          ctx.restore();
        } else if (item.isFile) {
          // 檔案圖示
          ctx.font = '18px sans-serif';
          ctx.fillText('📄', bubbleX + 14, bubbleY + 28);

          // 檔名
          ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isSelf ? '#ffffff' : '#f8fafc';
          const truncatedName = item.fileName && item.fileName.length > 22 ? `${item.fileName.substring(0, 20)}...` : (item.fileName || '');
          ctx.fillText(truncatedName, bubbleX + 40, bubbleY + 24);

          // 檔案大小與 E2EE 標籤
          ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isSelf ? 'rgba(255, 255, 255, 0.75)' : '#94a3b8';
          ctx.fillText(`${item.fileSizeStr} · E2EE 加密傳輸`, bubbleX + 40, bubbleY + 40);
        } else {
          // 普通文字內容
          ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = msg.is_recalled ? '#94a3b8' : (isSelf ? '#ffffff' : '#f8fafc');

          item.lines.forEach((line, lineIdx) => {
            ctx.fillText(line, bubbleX + 14, bubbleY + 20 + lineIdx * 20);
          });

          // 繪製網址預覽 Embed 卡片
          if (item.hasUrlEmbed) {
            const embedY = bubbleY + 20 + item.lines.length * 20 + 4;
            const embedW = bubbleWidth - 24;
            const embedH = item.embedThumbnail ? 80 : 46;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(bubbleX + 12, embedY, embedW, embedH, 8);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.stroke();

            // 若有 YouTube 封面
            if (item.embedThumbnail) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(bubbleX + 16, embedY + 6, 96, 68, 6);
              ctx.clip();
              ctx.drawImage(item.embedThumbnail, bubbleX + 16, embedY + 6, 96, 68);
              ctx.restore();

              // 網址文字
              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.embedDomain || 'YouTube 影片', bubbleX + 120, embedY + 26);

              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#93c5fd';
              const truncUrl = item.embedUrl && item.embedUrl.length > 28 ? `${item.embedUrl.substring(0, 26)}...` : item.embedUrl;
              ctx.fillText(truncUrl || '', bubbleX + 120, embedY + 48);
            } else {
              // 一般網站預覽
              ctx.font = '16px sans-serif';
              ctx.fillText('🔗', bubbleX + 20, embedY + 28);

              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.embedDomain || '外部連結', bubbleX + 44, embedY + 20);

              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#93c5fd';
              const truncUrl = item.embedUrl && item.embedUrl.length > 32 ? `${item.embedUrl.substring(0, 30)}...` : item.embedUrl;
              ctx.fillText(truncUrl || '', bubbleX + 44, embedY + 36);
            }
            ctx.restore();
          }
        }

        // 繪製時間戳記 (圖片氣泡省略或放在角落)
        if (!item.isImage) {
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isSelf ? 'rgba(255, 255, 255, 0.7)' : '#94a3b8';
          let timeStr = '';
          try {
            timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            timeStr = '';
          }
          if (msg.is_edited) timeStr += ' (已編輯)';

          ctx.textAlign = 'right';
          ctx.fillText(timeStr, bubbleX + bubbleWidth - 10, bubbleY + actualBubbleHeight - 6);
          ctx.textAlign = 'left';
        }

        currentY += item.height + 12;
      });

      setDataUrl(canvas.toDataURL('image/png'));
      setIsRendering(false);
    };

    renderScreenshot();

    return () => {
      isMounted = false;
    };
  }, [isOpen, messages, isAnonymous, currentUserId, partnerUser, groupName, isGroup, groupMembersMap, getUserDisplayName, user, token, API_BASE, friendsMap]);

  // 複製圖片至剪貼簿
  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        notify({ message: '對話截圖已成功複製至剪貼簿！', type: 'success' });
        setTimeout(() => setCopied(false), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('複製截圖失敗:', err);
      notify({ message: '複製失敗，請嘗試點擊下載圖片', type: 'warning' });
    }
  };

  // 下載截圖檔案
  const handleDownloadImage = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Aura-Chat-Screenshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify({ message: '對話截圖已成功下載！', type: 'success' });
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="對話截圖預覽" maxWidth="680px">
      <div className={styles.modalContent}>
        {/* 隱藏的 Canvas 渲染節點 */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* 截圖預覽展示視窗 */}
        <div className={styles.previewContainer}>
          {!isRendering && dataUrl ? (
            <img src={dataUrl} alt="Chat Screenshot Preview" className={styles.previewImage} />
          ) : (
            <div className={styles.generatingState}>
              <Sparkles size={24} className="spin" />
              <span>正在解密與生成高畫質對話截圖...</span>
            </div>
          )}
        </div>

        {/* 底部功能控制列 */}
        <div className={styles.modalFooter}>
          <div className={styles.modeTag}>
            <span className={styles.modeDot} />
            <span>{isAnonymous ? '匿名模式' : '標準模式'} ({messages.length} 則對話)</span>
          </div>

          <div className={styles.btnGroup}>
            <button type="button" className="uiBtnSecondary" onClick={handleCopyImage} disabled={isRendering || !dataUrl}>
              <Copy size={16} />
              <span>{copied ? '已複製！' : '複製圖片'}</span>
            </button>
            <button type="button" className="uiBtnPrimary" onClick={handleDownloadImage} disabled={isRendering || !dataUrl}>
              <Download size={16} />
              <span>下載截圖 (.png)</span>
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
