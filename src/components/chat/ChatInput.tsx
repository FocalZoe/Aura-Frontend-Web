import React, { FormEvent, ChangeEvent, useState } from 'react';
import { Send, Paperclip, Loader2, Mic } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import styles from '../ChatWindow.module.css';

interface ChatInputProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSendMessage: (e: FormEvent) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onSendVoice?: (audioBlob: Blob) => void;
  isUploadingIPFS: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSendMessage,
  onFileUpload,
  onSendVoice,
  isUploadingIPFS,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const handleVoiceSend = (blob: Blob) => {
    setIsRecording(false);
    if (onSendVoice) {
      onSendVoice(blob);
    }
  };

  const handleVoiceCancel = () => {
    setIsRecording(false);
  };

  return (
    <div className={styles.chatInputArea}>
      {isRecording ? (
        <VoiceRecorder
          onSendVoice={handleVoiceSend}
          onCancel={handleVoiceCancel}
          disabled={disabled || isUploadingIPFS}
        />
      ) : (
        <form className={styles.chatForm} onSubmit={onSendMessage}>
          <label className={styles.chatAttachBtn} title="傳送加密檔案">
            <Paperclip size={20} />
            <input type="file" onChange={onFileUpload} disabled={disabled || isUploadingIPFS} style={{ display: 'none' }} />
          </label>

          <input
            type="text"
            className={styles.chatInput}
            placeholder={disabled ? "等待對方初始化對話..." : "輸入訊息..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={disabled || isUploadingIPFS}
          />

          {/* Context: [語音訊息] 電腦版麥克風按鈕（手機版寬度自動由 CSS 隱藏） */}
          {onSendVoice && (
            <button
              type="button"
              className={styles.chatMicBtn}
              onClick={() => setIsRecording(true)}
              disabled={disabled || isUploadingIPFS}
              title="錄製語音訊息 (僅限電腦版)"
            >
              <Mic size={20} />
            </button>
          )}

          <button
            type="submit"
            className={styles.chatSendBtn}
            disabled={disabled || !inputText.trim() || isUploadingIPFS}
            title="傳送訊息"
          >
            {isUploadingIPFS ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
          </button>
        </form>
      )}
    </div>
  );
};

