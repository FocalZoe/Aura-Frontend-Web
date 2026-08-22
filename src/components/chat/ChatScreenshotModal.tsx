// Context: [對話截圖] 高畫質對話截圖生成與預覽彈窗 (Canvas 2D 渲染、匿名遮蔽、複製與下載)
import React, { useEffect, useRef, useState } from 'react';
import { BaseModal } from '../common/BaseModal';
import { Message, User } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { useChatStore } from '../../stores/useChatStore';
import { Copy, Download, ShieldCheck, Check, Sparkles } from 'lucide-react';
import styles from './ChatScreenshotModal.module.css';

interface ChatScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isAnonymous: boolean;
  currentUserId: number;
  partnerUser?: User | null;
  groupName?: string | null;
}

export const ChatScreenshotModal: React.FC<ChatScreenshotModalProps> = ({
  isOpen,
  onClose,
  messages,
  isAnonymous,
  currentUserId,
  partnerUser,
  groupName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const { notify } = useNotification();
  const { getUserDisplayName } = useChatStore();

  useEffect(() => {
    if (!isOpen || messages.length === 0) return;

    const renderScreenshot = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 640;
      const padding = 24;
      const headerHeight = 76;
      const footerHeight = 44;
      const bubbleMaxWidth = 420;

      // 建立匿名代稱對應字典
      const userLabels: Record<number, string> = {};
      let anonCounter = 1;

      messages.forEach((m) => {
        if (!userLabels[m.sender_id]) {
          if (m.sender_id === currentUserId) {
            userLabels[m.sender_id] = isAnonymous ? '使用者 A' : '我';
          } else {
            userLabels[m.sender_id] = isAnonymous
              ? `使用者 ${String.fromCharCode(65 + anonCounter++)}`
              : (partnerUser ? getUserDisplayName(partnerUser) : `成員 #${m.sender_id}`);
          }
        }
      });

      // 預計算各訊息氣泡高度
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const bubbleHeights: { lines: string[]; height: number }[] = [];

      messages.forEach((m) => {
        let text = m.content || '';
        if (m.is_recalled || text === '[RECALLED]') {
          text = '（此訊息已被發送者收回）';
        } else if (m.filePayload) {
          text = `[檔案] ${m.filePayload.name} (${Math.round(m.filePayload.size / 1024)} KB)`;
        }

        const words = text.split('');
        const lines: string[] = [];
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

        const textHeight = Math.max(lines.length * 20, 20);
        const bubbleHeight = textHeight + 28; // 包含時間戳記與 padding
        bubbleHeights.push({ lines, height: bubbleHeight });
      });

      const totalMessagesHeight = bubbleHeights.reduce((acc, b) => acc + b.height + 16, 0);
      const totalHeight = headerHeight + totalMessagesHeight + footerHeight + padding;

      // 設置 Retina 畫質縮放
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // 繪製背景 (深色極致暗夜漸層)
      const bgGrad = ctx.createLinearGradient(0, 0, width, totalHeight);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, totalHeight);

      // 繪製頂部 Header
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, headerHeight);

      // Header 裝飾底線
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, headerHeight - 1, width, 1);

      // Header 標題文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const chatTitle = groupName
        ? (isAnonymous ? '群組對話記錄' : groupName)
        : (isAnonymous ? '私密對話記錄' : `與 ${partnerUser ? getUserDisplayName(partnerUser) : '對方'} 的對話`);
      ctx.fillText(chatTitle, padding, 34);

      // Header 副標題 (日期與 E2EE 標記)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const dateStr = new Date().toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
      ctx.fillText(`${dateStr} • 端對端加密保護 • Aura`, padding, 56);

      // 繪製訊息列表
      let currentY = headerHeight + 16;

      messages.forEach((m, idx) => {
        const isSelf = m.sender_id === currentUserId;
        const { lines, height: bubbleHeight } = bubbleHeights[idx];
        const senderLabel = userLabels[m.sender_id] || (isSelf ? '我' : '對方');

        let maxLineWidth = 0;
        lines.forEach((l) => {
          const w = ctx.measureText(l).width;
          if (w > maxLineWidth) maxLineWidth = w;
        });

        const bubbleWidth = Math.min(Math.max(maxLineWidth + 32, 80), bubbleMaxWidth);
        const bubbleX = isSelf ? width - padding - bubbleWidth : padding + 36;

        // 繪製發送者頭像 (他人模式)
        if (!isSelf) {
          ctx.beginPath();
          ctx.arc(padding + 14, currentY + 16, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#6366f1';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(senderLabel.charAt(0), padding + 14, currentY + 16);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }

        // 繪製氣泡圓角矩形
        ctx.save();
        ctx.beginPath();
        const r = 14;
        ctx.roundRect(bubbleX, currentY, bubbleWidth, bubbleHeight, r);

        if (m.is_recalled) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.stroke();
        } else if (isSelf) {
          const selfGrad = ctx.createLinearGradient(bubbleX, currentY, bubbleX + bubbleWidth, currentY + bubbleHeight);
          selfGrad.addColorStop(0, '#4f46e5');
          selfGrad.addColorStop(1, '#6366f1');
          ctx.fillStyle = selfGrad;
          ctx.fill();
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.stroke();
        }
        ctx.restore();

        // 繪製訊息文字
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = m.is_recalled ? '#94a3b8' : (isSelf ? '#ffffff' : '#f1f5f9');

        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, bubbleX + 14, currentY + 20 + lineIdx * 20);
        });

        // 繪製時間戳記
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isSelf ? 'rgba(255, 255, 255, 0.7)' : '#94a3b8';
        let timeStr = '';
        try {
          timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
          timeStr = '';
        }
        if (m.is_edited) timeStr += ' (已編輯)';

        ctx.textAlign = 'right';
        ctx.fillText(timeStr, bubbleX + bubbleWidth - 10, currentY + bubbleHeight - 6);
        ctx.textAlign = 'left';

        currentY += bubbleHeight + 16;
      });

      // 繪製底部 Footer (Aura 隱私水印)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, totalHeight - footerHeight, width, footerHeight);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aura • 隱私無界 • 分散式端對端加密通訊平台', width / 2, totalHeight - 16);
      ctx.textAlign = 'left';

      setDataUrl(canvas.toDataURL('image/png'));
    };

    renderScreenshot();
  }, [isOpen, messages, isAnonymous, currentUserId, partnerUser, groupName]);

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
    a.download = `Aura_Chat_${isAnonymous ? 'Anonymous_' : ''}${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify({ message: '對話截圖已開始下載！', type: 'success' });
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="對話截圖預覽" maxWidth="680px">
      <div className={styles.modalBody}>
        {/* 隱藏的 Canvas 渲染器 */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* 圖片預覽容器 */}
        <div className={styles.previewContainer}>
          {dataUrl ? (
            <img src={dataUrl} alt="對話截圖" className={styles.previewImg} />
          ) : (
            <div className={styles.loadingBox}>
              <Sparkles size={24} className="spin" />
              <span>正在生成高清對話截圖...</span>
            </div>
          )}
        </div>

        {/* 操作按鈕群 */}
        <div className={styles.actionRow}>
          <div className={styles.modeBadge}>
            <ShieldCheck size={14} color="#10b981" />
            <span>{isAnonymous ? '匿名隱私模式' : '標準模式'} ({messages.length} 則對話)</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="uiBtnSecondary"
              onClick={handleCopyImage}
              disabled={!dataUrl}
              style={{ height: '38px', padding: '0 14px' }}
            >
              {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
              <span>{copied ? '已複製' : '複製圖片'}</span>
            </button>

            <button
              type="button"
              className="uiBtnPrimary"
              onClick={handleDownloadImage}
              disabled={!dataUrl}
              style={{ height: '38px', padding: '0 16px' }}
            >
              <Download size={15} />
              <span>下載截圖 (.png)</span>
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
