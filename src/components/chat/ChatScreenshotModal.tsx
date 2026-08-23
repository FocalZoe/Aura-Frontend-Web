// Context: [對話截圖] 高畫質對話截圖生成與預覽 (像素級對齊真實聊天室：外部時間戳記、真實頭像、純淨 Embed 卡片、自適應預覽)

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

  // 帶有 2.5 秒超時保護的圖片加載器
  const loadImageElement = (src: string, timeoutMs = 2500): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      let timer: any = null;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (timer) clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        if (timer) clearTimeout(timer);
        resolve(null);
      };
      timer = setTimeout(() => {
        resolve(null);
      }, timeoutMs);
      img.src = src;
    });
  };

  useEffect(() => {
    if (!isOpen || messages.length === 0) return;

    let isMounted = true;
    setIsRendering(true);

    const renderScreenshot = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 640;
        const padding = 24;
        const bubbleMaxWidth = 420;

        // 1. 預先非同步加載所有 IPFS 圖片與真實發送者頭像圖片
        const loadedImagesMap: Record<number, HTMLImageElement> = {};
        const loadedAvatarImages: Record<number, HTMLImageElement> = {};
        const createdBlobUrls: string[] = [];

        // 取得每位發送者的頭像 URL
        const resolveSenderAvatar = (senderId: number, msgObj?: Message): string | undefined => {
          if (groupMembersMap && groupMembersMap[senderId]?.user?.avatar) {
            return groupMembersMap[senderId].user?.avatar;
          }
          if (msgObj?.sender?.avatar) {
            return msgObj.sender.avatar;
          }
          if (partnerUser && partnerUser.id === senderId && partnerUser.avatar) {
            return partnerUser.avatar;
          }
          if (user && user.id === senderId && user.avatar) {
            return user.avatar;
          }
          return undefined;
        };

        const imageLoadPromises = messages.map(async (m) => {
          if (!m.id) return;

          // A. 頭像圖片加載 (僅未匿名時)
          if (!isAnonymous && !loadedAvatarImages[m.sender_id]) {
            const avatarUrl = resolveSenderAvatar(m.sender_id, m);
            if (avatarUrl) {
              const avatarImg = await loadImageElement(avatarUrl);
              if (avatarImg) {
                loadedAvatarImages[m.sender_id] = avatarImg;
              }
            }
          }

          // B. IPFS 圖片解密載入 (同源 Blob)
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
                  createdBlobUrls.push(blobUrl);
                  const imgEl = await loadImageElement(blobUrl);
                  if (imgEl) {
                    loadedImagesMap[m.id] = imgEl;
                  }
                }
              } catch (e) {
                console.warn('[Screenshot] IPFS Image load skipped:', e);
              }
            }
          }
        });

        // 競態計時：最多等待 3 秒，超時直接渲染
        await Promise.race([
          Promise.all(imageLoadPromises),
          new Promise((r) => setTimeout(r, 3000)),
        ]);

        if (!isMounted) {
          createdBlobUrls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }

        // 2. 建立匿名編號與色彩字典
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

        // 3. 預計算各訊息高度與尺寸 (時間戳記在外面，氣泡純放內容)
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
          isPureEmbed?: boolean;
          isYouTube?: boolean;
          embedDomain?: string;
          embedUrl?: string;
          fileName?: string;
          fileSizeStr?: string;
          timeStr: string;
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
              height: 28,
              pillWidth,
              timeStr: '',
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

          let timeStr = '';
          try {
            timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            timeStr = '';
          }
          if (m.is_edited) timeStr += ' (已編輯)';

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
          let isPureEmbed = false;
          let isYouTube = false;
          let embedDomain = '';
          let embedUrl = '';

          if (!isFile && !m.is_recalled && text) {
            const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
            if (urlMatch) {
              hasUrlEmbed = true;
              embedUrl = urlMatch[0];
              try {
                const parsed = new URL(embedUrl);
                const host = parsed.hostname.toLowerCase();
                isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
                embedDomain = host.replace(/^www\./, '');
              } catch {
                embedDomain = embedUrl;
              }
              const cleaned = text.replace(embedUrl, '').trim();
              if (!cleaned) {
                isPureEmbed = true;
              }
            }
          }

          const lines: string[] = [];
          if (!isImage && isFile) {
            lines.push(fileName);
            lines.push(fileSizeStr);
          } else if (!isImage) {
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            let textToWrap = text;
            if (hasUrlEmbed) {
              textToWrap = text.replace(embedUrl, '').trim();
            }

            if (textToWrap) {
              const words = textToWrap.split('');
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
                if (metrics.width > bubbleMaxWidth - 32 && i > 0) {
                  lines.push(currentLine);
                  currentLine = char;
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine) lines.push(currentLine);
            }
          }

          const nameHeight = (!isSelf && !isAnonymous) ? 18 : 0;
          let contentHeight = 0;

          if (isImage) {
            contentHeight = imageRenderHeight;
          } else if (isFile) {
            contentHeight = 48;
          } else if (isPureEmbed) {
            contentHeight = 48;
          } else {
            const textHeight = Math.max(lines.length * 20, 20);
            const embedExtraHeight = hasUrlEmbed ? 54 : 0;
            contentHeight = textHeight + embedExtraHeight + 16;
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
            isPureEmbed,
            isYouTube,
            embedDomain,
            embedUrl,
            fileName,
            fileSizeStr,
            timeStr,
          });
        });

        const totalMessagesHeight = renderedItems.reduce((acc, item) => acc + item.height + 10, 0);
        const totalHeight = padding * 2 + totalMessagesHeight;

        // 4. 設置 Retina 畫質縮放
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = totalHeight * scale;
        ctx.scale(scale, scale);

        // 5. 繪製深色極致暗夜背景
        const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
        bgGrad.addColorStop(0, '#0b0f19');
        bgGrad.addColorStop(1, '#070a12');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, totalHeight);

        // 6. 逐筆繪製訊息內容 (像素級對齊圖一)
        let currentY = padding;

        renderedItems.forEach((item, idx) => {
          const msg = messages[idx];

          // 系統公告訊息 (置中膠囊)
          if (item.isSystem) {
            const pillWidth = item.pillWidth || 200;
            const pillHeight = 24;
            const pillX = (width - pillWidth) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(pillX, currentY + 2, pillWidth, pillHeight, 12);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.stroke();
            ctx.restore();

            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.lines[0], width / 2, currentY + 14);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            currentY += item.height + 10;
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
          } else if (item.isPureEmbed) {
            maxLineWidth = 300;
          } else if (item.hasUrlEmbed) {
            maxLineWidth = Math.max(maxLineWidth, 260);
          } else if (item.isFile) {
            maxLineWidth = Math.max(maxLineWidth, 220);
          }

          const bubbleWidth = item.isImage
            ? (item.imageRenderWidth || 240)
            : item.isPureEmbed
            ? 320
            : Math.min(Math.max(maxLineWidth + 28, 48), bubbleMaxWidth);

          const bubbleX = isSelf ? width - padding - bubbleWidth : padding + 40;
          const bubbleY = currentY + (!isSelf && !isAnonymous ? 18 : 0);
          const actualBubbleHeight = item.height - (!isSelf && !isAnonymous ? 18 : 0);

          // 繪製他人頭像與上方名字
          if (!isSelf) {
            // 上方姓名 (精準左對齊氣泡)
            if (!isAnonymous) {
              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#94a3b8';
              ctx.fillText(item.senderName, bubbleX, currentY + 12);
            }

            // 左側頭像 (底部對齊氣泡底部，32px 圓形)
            const avatarCenterY = bubbleY + actualBubbleHeight - 16;
            const avatarCenterX = padding + 16;
            const avatarRadius = 16;

            const avatarImg = loadedAvatarImages[msg.sender_id];
            if (!isAnonymous && avatarImg) {
              // 繪製真實頭像圖片 (圓形剪裁)
              ctx.save();
              ctx.beginPath();
              ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(avatarImg, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
              ctx.restore();
            } else {
              // 繪製彩色圓圈首字
              ctx.beginPath();
              ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
              ctx.fillStyle = meta.color;
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const avatarLetter = isAnonymous ? meta.num : (item.senderName.charAt(0) || '友');
              ctx.fillText(avatarLetter, avatarCenterX, avatarCenterY);
              ctx.textAlign = 'left';
              ctx.textBaseline = 'alphabetic';
            }
          }

          // 繪製氣泡圓角矩形 (純 Embed/圖片不套外層大氣泡，由卡片自身呈現)
          if (!item.isImage && !item.isPureEmbed) {
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
          }

          // 繪製內容：圖片 / 檔案卡片 / 網址 Embed / 純文字
          if (item.isImage && item.imageElement) {
            const imgW = item.imageRenderWidth || 240;
            const imgH = item.imageRenderHeight || 160;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, imgW, imgH, 12);
            ctx.clip();
            ctx.drawImage(item.imageElement, bubbleX, bubbleY, imgW, imgH);
            ctx.restore();
          } else if (item.isFile) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, bubbleWidth, actualBubbleHeight, 12);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();
            ctx.restore();

            // 檔案圖示
            ctx.font = '18px sans-serif';
            ctx.fillText('📄', bubbleX + 12, bubbleY + 30);

            // 檔名
            ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#f8fafc';
            const truncatedName = item.fileName && item.fileName.length > 22 ? `${item.fileName.substring(0, 20)}...` : (item.fileName || '');
            ctx.fillText(truncatedName, bubbleX + 38, bubbleY + 22);

            // 檔案大小與 E2EE 標籤
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`${item.fileSizeStr} · E2EE 加密傳輸`, bubbleX + 38, bubbleY + 38);
          } else if (item.isPureEmbed) {
            // 純 Embed 卡片 (對齊圖一，深色玻璃擬態卡片本體)
            const cardW = bubbleWidth;
            const cardH = actualBubbleHeight;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, cardW, cardH, 12);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();

            if (item.isYouTube) {
              // YouTube 徽章
              ctx.beginPath();
              ctx.roundRect(bubbleX + 12, bubbleY + 14, 52, 20, 4);
              ctx.fillStyle = '#ef4444';
              ctx.fill();

              ctx.font = 'bold 10px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('YouTube', bubbleX + 38, bubbleY + 28);
              ctx.textAlign = 'left';

              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText('YouTube 影片', bubbleX + 72, bubbleY + 22);

              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#94a3b8';
              const truncUrl = item.embedUrl && item.embedUrl.length > 28 ? `${item.embedUrl.substring(0, 26)}...` : item.embedUrl;
              ctx.fillText(truncUrl || '', bubbleX + 72, bubbleY + 38);
            } else {
              // 一般網站 Favicon 卡片
              ctx.font = '16px sans-serif';
              ctx.fillText('🔗', bubbleX + 14, bubbleY + 30);

              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.embedDomain || '外部連結', bubbleX + 38, bubbleY + 22);

              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#94a3b8';
              const truncUrl = item.embedUrl && item.embedUrl.length > 32 ? `${item.embedUrl.substring(0, 30)}...` : item.embedUrl;
              ctx.fillText(truncUrl || '', bubbleX + 38, bubbleY + 38);
            }
            ctx.restore();
          } else {
            // 一般文字內容
            if (item.lines.length > 0) {
              ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = msg.is_recalled ? '#94a3b8' : (isSelf ? '#ffffff' : '#f8fafc');

              item.lines.forEach((line, lineIdx) => {
                ctx.fillText(line, bubbleX + 14, bubbleY + 18 + lineIdx * 20);
              });
            }

            // 附帶文字的 Embed 卡片
            if (item.hasUrlEmbed) {
              const textOffset = item.lines.length * 20 + 4;
              const embedY = bubbleY + textOffset;
              const embedW = bubbleWidth - 24;
              const embedH = 44;

              ctx.save();
              ctx.beginPath();
              ctx.roundRect(bubbleX + 12, embedY, embedW, embedH, 8);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.stroke();

              ctx.font = '14px sans-serif';
              ctx.fillText(item.isYouTube ? '▶️' : '🔗', bubbleX + 20, embedY + 27);

              ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(item.embedDomain || '外部連結', bubbleX + 42, embedY + 18);

              ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              ctx.fillStyle = '#93c5fd';
              const truncUrl = item.embedUrl && item.embedUrl.length > 30 ? `${item.embedUrl.substring(0, 28)}...` : item.embedUrl;
              ctx.fillText(truncUrl || '', bubbleX + 42, embedY + 34);
              ctx.restore();
            }
          }

          // 7. 繪製時間戳記 (100% 像素級對齊圖一：永遠繪製在氣泡外部，底部切齊！)
          if (item.timeStr) {
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';

            if (isSelf) {
              // 自己發送：時間在氣泡左邊外面 (靠右對齊，貼齊氣泡底部)
              const timeX = bubbleX - 8;
              const timeY = bubbleY + actualBubbleHeight - 4;
              ctx.textAlign = 'right';
              ctx.fillText(item.timeStr, timeX, timeY);
              ctx.textAlign = 'left';
            } else {
              // 他人發送：時間在氣泡右邊外面 (靠左對齊，貼齊氣泡底部)
              const timeX = bubbleX + bubbleWidth + 8;
              const timeY = bubbleY + actualBubbleHeight - 4;
              ctx.textAlign = 'left';
              ctx.fillText(item.timeStr, timeX, timeY);
            }
          }

          currentY += item.height + 10;
        });

        const generatedDataUrl = canvas.toDataURL('image/png');
        if (isMounted) {
          setDataUrl(generatedDataUrl);
        }
      } catch (err) {
        console.error('[Screenshot] Canvas render error:', err);
        notify({ message: '截圖生成遇到異常，已為您安全重置', type: 'warning' });
      } finally {
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    renderScreenshot();

    return () => {
      isMounted = false;
    };
  }, [isOpen, messages, isAnonymous, currentUserId, partnerUser, groupName, isGroup, groupMembersMap, getUserDisplayName, user, token, API_BASE, friendsMap, notify]);

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
    <BaseModal isOpen={isOpen} onClose={onClose} title="對話截圖預覽" maxWidth="720px">
      <div className={styles.modalContent}>
        {/* 隱藏的 Canvas 渲染節點 */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* 截圖預覽展示視窗 (自適應等比縮放，一覽全部訊息) */}
        <div className={styles.previewContainer}>
          {!isRendering && dataUrl ? (
            <img src={dataUrl} alt="Chat Screenshot Preview" className={styles.previewImage} />
          ) : (
            <div className={styles.generatingState}>
              <Sparkles size={24} className="spin" />
              <span>正在生成像素級高畫質對話截圖...</span>
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
