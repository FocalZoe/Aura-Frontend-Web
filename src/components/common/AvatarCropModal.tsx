// Context: [頭像即時裁切元件] 支援拖曳平移、縮放、旋轉與高畫質圓形/方形頭像導出
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BaseModal } from './BaseModal';
import { ZoomIn, ZoomOut, RotateCw, RefreshCcw, Check, X } from 'lucide-react';
import styles from './AvatarCropModal.module.css';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, previewUrl: string) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageFile,
  onClose,
  onCropComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  // 變換狀態
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 載入圖片檔案
  useEffect(() => {
    if (!isOpen || !imageFile) {
      setImgObj(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgObj(img);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, imageFile]);

  // 重繪 Canvas 預覽
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 320;
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, size, size);

    // 填充底色
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    // 移動到畫布中心點
    ctx.translate(size / 2 + offset.x, size / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // 計算貼圖適應大小 (cover)
    const imgAspect = imgObj.width / imgObj.height;
    let drawW = 240;
    let drawH = 240;
    if (imgAspect > 1) {
      drawW = 240 * imgAspect;
    } else {
      drawH = 240 / imgAspect;
    }

    ctx.drawImage(imgObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [imgObj, zoom, rotation, offset]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // 滑鼠拖曳事件
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 觸控拖曳支援 (手機端)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      offsetStartRef.current = { ...offset };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // 滾輪縮放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(1, +(prev + delta).toFixed(2)), 3));
  };

  // 旋轉 90 度
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // 重置
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // 導出高品質裁切圖
  const handleConfirmCrop = () => {
    if (!imgObj) return;

    const exportSize = 360;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // 將中心 240px 裁切框映射至 360px 導出畫布
    const scaleRatio = exportSize / 240;

    ctx.save();
    ctx.translate(exportSize / 2 + offset.x * scaleRatio, exportSize / 2 + offset.y * scaleRatio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleRatio, zoom * scaleRatio);

    const imgAspect = imgObj.width / imgObj.height;
    let drawW = 240;
    let drawH = 240;
    if (imgAspect > 1) {
      drawW = 240 * imgAspect;
    } else {
      drawH = 240 / imgAspect;
    }

    ctx.drawImage(imgObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = exportCanvas.toDataURL('image/png');
        onCropComplete(blob, previewUrl);
        onClose();
      },
      'image/png',
      0.95
    );
  };

  if (!isOpen) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="裁切個人頭像" maxWidth="380px">
      <div className={styles.cropContainer}>
        {/* 裁切畫布區 */}
        <div
          className={styles.cropCanvasArea}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <canvas ref={canvasRef} className={styles.cropCanvas} />
          {/* 圓形高亮遮罩引導框 */}
          <div className={styles.cropGuideWrapper}>
            <div className={styles.cropOverlay} />
          </div>
        </div>

        {/* 控制工具列 */}
        <div className={styles.controlsWrapper}>
          {/* 縮放滑桿 */}
          <div className={styles.sliderRow}>
            <ZoomOut size={16} />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className={styles.zoomSlider}
            />
            <ZoomIn size={16} />
            <span style={{ minWidth: '38px', textAlign: 'right', fontWeight: 600 }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* 輔助按鈕 */}
          <div className={styles.btnRow}>
            <button type="button" className={styles.toolBtn} onClick={handleRotate} title="旋轉 90 度">
              <RotateCw size={14} />
              <span>旋轉 90°</span>
            </button>
            <button type="button" className={styles.toolBtn} onClick={handleReset} title="重置位置與縮放">
              <RefreshCcw size={14} />
              <span>重置</span>
            </button>
          </div>
        </div>

        {/* 底部操作按鈕 */}
        <div className={styles.actionRow}>
          <button type="button" className={`uiBtnSecondary ${styles.flexBtn}`} onClick={onClose}>
            <X size={16} />
            <span>取消</span>
          </button>
          <button type="button" className={`uiBtnPrimary ${styles.flexBtn}`} onClick={handleConfirmCrop}>
            <Check size={16} />
            <span>確認裁切</span>
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
