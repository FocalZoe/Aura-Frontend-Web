import React, { FormEvent, ChangeEvent } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import styles from '../ChatWindow.module.css';

interface ChatInputProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSendMessage: (e: FormEvent) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isUploadingIPFS: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSendMessage,
  onFileUpload,
  isUploadingIPFS,
  disabled = false,
}) => {
  return (
    <div className={styles.chatInputArea}>
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

        <button
          type="submit"
          className={styles.chatSendBtn}
          disabled={disabled || !inputText.trim() || isUploadingIPFS}
          title="傳送訊息"
        >
          {isUploadingIPFS ? <Loader2 size={18} className={styles.spin} /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
};
