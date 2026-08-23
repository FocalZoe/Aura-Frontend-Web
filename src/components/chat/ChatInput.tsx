// Context: 聊天室輸入區 (整合 Plus 旋轉選單、待發送附件 IG 預覽、右側 Emoji 觸發與語音錄製)
import React, { FormEvent, ChangeEvent, useState, useRef, useEffect } from 'react';
import { Send, Loader2, Plus, Paperclip, Mic, Smile } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { PendingAttachmentsPreview } from './PendingAttachmentsPreview';
import styles from '../ChatWindow.module.css';

interface ChatInputProps {
  inputText: string;
  setInputText: (val: string) => void;
  pendingFiles: File[];
  onRemovePendingFile: (index: number) => void;
  onFilesSelected: (files: FileList) => void;
  onSendMessage: (e: FormEvent) => void;
  onSendVoice?: (audioBlob: Blob) => void;
  onOpenEmojiPicker: (x: number, y: number) => void;
  isUploadingIPFS: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  pendingFiles,
  onRemovePendingFile,
  onFilesSelected,
  onSendMessage,
  onSendVoice,
  onOpenEmojiPicker,
  isUploadingIPFS,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showPlusMenu, setShowPlusMenu] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 點擊外部關閉 Plus 選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  const handleVoiceSend = (blob: Blob) => {
    setIsRecording(false);
    if (onSendVoice) {
      onSendVoice(blob);
    }
  };

  const handleVoiceCancel = () => {
    setIsRecording(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
    e.target.value = '';
    setShowPlusMenu(false);
  };

  const handleEmojiBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenEmojiPicker(rect.left - 140, rect.top - 430);
  };

  const canSend = !disabled && !isUploadingIPFS && (inputText.trim().length > 0 || pendingFiles.length > 0);

  return (
    <div className={styles.chatInputArea}>
      {/* 待發送附件預覽欄 (IG 多圖堆疊預覽與卡片) */}
      <PendingAttachmentsPreview files={pendingFiles} onRemoveFile={onRemovePendingFile} />

      {isRecording ? (
        <VoiceRecorder
          onSendVoice={handleVoiceSend}
          onCancel={handleVoiceCancel}
          disabled={disabled || isUploadingIPFS}
        />
      ) : (
        <form className={styles.chatForm} onSubmit={onSendMessage}>
          {/* 左側 Plus 整合操作按鈕與選單 */}
          <div ref={plusMenuRef} className={styles.plusActionWrapper}>
            <button
              type="button"
              className={`${styles.plusBtn} ${showPlusMenu ? styles.plusBtnActive : ''}`}
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              disabled={disabled || isUploadingIPFS}
              title="更多操作"
            >
              <div className={`${styles.plusIconRotatable} ${showPlusMenu ? styles.plusIconRotated : ''}`}>
                <Plus size={20} />
              </div>
            </button>

            {/* Plus 彈出選單 */}
            {showPlusMenu && (
              <div className={styles.plusMenuPopover}>
                <button
                  type="button"
                  className={styles.plusMenuItem}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  <Paperclip size={16} color="var(--accent-color)" />
                  <span>附加檔案 / 照片</span>
                </button>

                {onSendVoice && (
                  <button
                    type="button"
                    className={styles.plusMenuItem}
                    onClick={() => {
                      setShowPlusMenu(false);
                      setIsRecording(true);
                    }}
                  >
                    <Mic size={16} color="#10b981" />
                    <span>錄製語音訊息</span>
                  </button>
                )}
              </div>
            )}

            {/* 隱藏的系統多選檔案輸入器 */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={disabled || isUploadingIPFS}
            />
          </div>

          <input
            ref={inputRef}
            type="text"
            className={styles.chatInput}
            placeholder={disabled ? '等待對方初始化對話...' : '輸入訊息...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={disabled || isUploadingIPFS}
          />

          {/* 輸入框右側 Emoji 表情 / 貼圖 / 顏文字按鈕 */}
          <button
            type="button"
            className={styles.chatEmojiBtn}
            onClick={handleEmojiBtnClick}
            disabled={disabled || isUploadingIPFS}
            title="表情貼圖 (游標處插入)"
          >
            <Smile size={20} />
          </button>

          <button
            type="submit"
            className={styles.chatSendBtn}
            disabled={!canSend}
            title="傳送訊息"
          >
            {isUploadingIPFS ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
          </button>
        </form>
      )}
    </div>
  );
};
