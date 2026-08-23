// Context: [訊息發送領域 Hook] 封裝 E2EE 密鑰推導、訊息加密、IPFS 檔案加密上傳管道與語音發送

import { useState, FormEvent } from 'react';
import { User, Group, IPFSFilePayload, Message } from '../types';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, encryptMessage, encryptFileBuffer } from '../utils/crypto';
import { uploadToIPFS } from '../utils/ipfs';
import { e2eeService } from '../services/e2eeService';
import { websocketService } from '../services/websocketService';
import { getApiBase } from '../services/apiClient';
import { useChatStore } from '../stores/useChatStore';

interface UseMessageSenderProps {
  user: User | null;
  token: string | null;
  apiBase: string;
  activeChatUser: User | null;
  activeGroup: Group | null;
  friendsMap: Record<number, string>;
  notify: (opts: { message: string; type: 'success' | 'warning' | 'danger' | 'info' }) => void;
}

export function useMessageSender({
  user,
  token,
  apiBase,
  activeChatUser,
  activeGroup,
  friendsMap,
  notify,
}: UseMessageSenderProps) {
  const [inputText, setInputText] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const { addMessage, addGroupMessage, editMessageInStore } = useChatStore();

  // 1. 發送一對一加密私聊訊息
  const sendDirectMessage = async (
    targetUserId: number,
    targetPublicKeyStr?: string | null,
    plainContent?: string,
    filePayload?: IPFSFilePayload
  ) => {
    if (!user || !plainContent) return;

    const privateKey = await getLocalPrivateKey(user.id);
    if (!privateKey) {
      notify({ message: '請先輸入 PIN 碼解鎖私密通訊金鑰', type: 'warning' });
      return;
    }

    let partnerPubKey: string | null | undefined = targetPublicKeyStr || friendsMap[targetUserId];
    if (!partnerPubKey && token) {
      partnerPubKey = await e2eeService.fetchUserPublicKey(targetUserId, token);
    }
    if (!partnerPubKey) {
      notify({ message: '對方尚未完成金鑰初始化，無法建立私密通道', type: 'danger' });
      return;
    }

    const partnerPublicKey = await importPublicKey(partnerPubKey);
    const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);
    const { ciphertext, iv } = await encryptMessage(sharedKey, plainContent);

    websocketService.send({
      type: 'message',
      to: targetUserId,
      content: ciphertext,
      iv,
    });

    addMessage({
      id: Date.now(),
      sender_id: user.id,
      to: targetUserId,
      content: plainContent,
      iv,
      timestamp: new Date().toISOString(),
      decrypted: true,
      sender: user,
      filePayload,
    });
  };

  // 2. 加密並上傳單一檔案/附件
  const uploadAndSendSingleFile = async (file: File) => {
    if (!user || !token) return;
    const arrayBuffer = await file.arrayBuffer();

    if (activeGroup) {
      const groupKey = await e2eeService.getGroupKey(activeGroup.id);
      const { encryptedData, iv } = await encryptFileBuffer(groupKey, arrayBuffer);
      const cid = await uploadToIPFS(encryptedData, apiBase || getApiBase());

      const payload: IPFSFilePayload = {
        cid,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        encrypted: true,
        iv,
      };

      const ipfsContent = `[IPFS_FILE]${JSON.stringify(payload)}`;
      const { ciphertext, iv: groupIv } = await e2eeService.encryptGroupMessage(activeGroup.id, ipfsContent);

      websocketService.send({
        type: 'group_message',
        group_id: activeGroup.id,
        content: ciphertext,
        iv: groupIv,
      });

      addGroupMessage({
        id: Date.now() + Math.floor(Math.random() * 1000),
        group_id: activeGroup.id,
        sender_id: user.id,
        content: ipfsContent,
        iv: groupIv,
        timestamp: new Date().toISOString(),
        decrypted: true,
        sender: user,
        filePayload: payload,
      });
      return;
    }

    if (activeChatUser) {
      const privateKey = await getLocalPrivateKey(user.id);
      if (!privateKey) {
        throw new Error('請先輸入 PIN 碼解鎖通訊金鑰');
      }

      let partnerPubKey: string | null | undefined = activeChatUser.public_key || friendsMap[activeChatUser.id];
      if (!partnerPubKey && token) {
        partnerPubKey = await e2eeService.fetchUserPublicKey(activeChatUser.id, token);
      }
      if (!partnerPubKey) {
        throw new Error('對方尚未完成金鑰初始化，無法傳送加密檔案');
      }

      const partnerPublicKey = await importPublicKey(partnerPubKey);
      const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);

      const { encryptedData, iv } = await encryptFileBuffer(sharedKey, arrayBuffer);
      const cid = await uploadToIPFS(encryptedData, apiBase || getApiBase());

      const payload: IPFSFilePayload = {
        cid,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        encrypted: true,
        iv,
      };

      const ipfsMessageContent = `[IPFS_FILE]${JSON.stringify(payload)}`;
      await sendDirectMessage(activeChatUser.id, partnerPubKey, ipfsMessageContent, payload);
    }
  };

  // 3. 處理點擊傳送或按 Enter
  const handleSend = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (editingMessage) {
      await handleSendEditedMessage(inputText);
      return;
    }

    const hasText = inputText.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;

    // 附件佇列發送
    if (hasFiles) {
      setUploading(true);
      const filesToSend = [...pendingFiles];
      try {
        while (filesToSend.length > 0) {
          const currentFile = filesToSend[0];
          await uploadAndSendSingleFile(currentFile);
          filesToSend.shift();
          setPendingFiles([...filesToSend]);
        }
        notify({ message: '附件已成功傳送！', type: 'success' });
      } catch (err: any) {
        notify({ message: err.message || '附件傳送失敗', type: 'danger' });
      } finally {
        setUploading(false);
      }
    }

    // 文字訊息發送
    if (hasText) {
      const text = inputText.trim();
      if (activeGroup) {
        try {
          const { ciphertext, iv } = await e2eeService.encryptGroupMessage(activeGroup.id, text);
          websocketService.send({
            type: 'group_message',
            group_id: activeGroup.id,
            content: ciphertext,
            iv,
          });

          addGroupMessage({
            id: Date.now(),
            group_id: activeGroup.id,
            sender_id: user.id,
            content: text,
            iv,
            timestamp: new Date().toISOString(),
            decrypted: true,
            sender: user,
          });
          setInputText('');
        } catch (err: any) {
          notify({ message: err.message || '群組訊息發送失敗', type: 'danger' });
        }
      } else if (activeChatUser) {
        try {
          await sendDirectMessage(activeChatUser.id, activeChatUser.public_key, text);
          setInputText('');
        } catch (err: any) {
          notify({ message: err.message || '訊息發送失敗', type: 'danger' });
        }
      }
    }
  };

  // 4. 發送語音訊息
  const handleSendVoice = async (audioBlob: Blob) => {
    if (!user || !token) return;
    if (!activeChatUser && !activeGroup) return;

    setUploading(true);
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      if (activeGroup) {
        const groupKey = await e2eeService.getGroupKey(activeGroup.id);
        const { encryptedData, iv } = await encryptFileBuffer(groupKey, arrayBuffer);
        const cid = await uploadToIPFS(encryptedData, apiBase || getApiBase());

        const payload: IPFSFilePayload = {
          cid,
          name: `voice-message-${Date.now()}.webm`,
          size: audioBlob.size,
          mime: audioBlob.type || 'audio/webm',
          encrypted: true,
          iv,
        };

        const ipfsContent = `[IPFS_FILE]${JSON.stringify(payload)}`;
        const { ciphertext, iv: groupIv } = await e2eeService.encryptGroupMessage(activeGroup.id, ipfsContent);

        websocketService.send({
          type: 'group_message',
          group_id: activeGroup.id,
          content: ciphertext,
          iv: groupIv,
        });

        addGroupMessage({
          id: Date.now(),
          group_id: activeGroup.id,
          sender_id: user.id,
          content: ipfsContent,
          iv: groupIv,
          timestamp: new Date().toISOString(),
          decrypted: true,
          sender: user,
        });

        notify({ message: '語音訊息已成功傳送！', type: 'success' });
        return;
      }

      if (activeChatUser) {
        const privateKey = await getLocalPrivateKey(user.id);
        if (!privateKey || !activeChatUser.public_key) {
          notify({ message: '請先解鎖通訊防護功能', type: 'warning' });
          return;
        }

        const partnerPublicKey = await importPublicKey(activeChatUser.public_key);
        const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);

        const { encryptedData, iv } = await encryptFileBuffer(sharedKey, arrayBuffer);
        const cid = await uploadToIPFS(encryptedData, apiBase || getApiBase());

        const payload: IPFSFilePayload = {
          cid,
          name: `voice-message-${Date.now()}.webm`,
          size: audioBlob.size,
          mime: audioBlob.type || 'audio/webm',
          encrypted: true,
          iv,
        };

        const ipfsMessageContent = `[IPFS_FILE]${JSON.stringify(payload)}`;
        await sendDirectMessage(activeChatUser.id, activeChatUser.public_key, ipfsMessageContent, payload);
        notify({ message: '語音訊息已成功傳送！', type: 'success' });
      }
    } catch (err: any) {
      notify({ message: err.message || '語音傳送失敗', type: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  // 5. 編輯既有訊息發送
  const handleSendEditedMessage = async (newContent: string) => {
    const msgId = editingMessage?.id;
    if (!msgId || !newContent.trim() || !user) return;
    const text = newContent.trim();

    try {
      if (activeGroup) {
        const { ciphertext, iv } = await e2eeService.encryptGroupMessage(activeGroup.id, text);
        websocketService.send({
          type: 'edit_message',
          message_id: msgId,
          is_group: true,
          group_id: activeGroup.id,
          content: ciphertext,
          iv,
        });
        editMessageInStore(msgId, true, text, iv);
      } else if (activeChatUser) {
        const privateKey = await getLocalPrivateKey(user.id);
        if (!privateKey || !activeChatUser.public_key) return;

        const partnerPublicKey = await importPublicKey(activeChatUser.public_key);
        const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);
        const { ciphertext, iv } = await encryptMessage(sharedKey, text);

        websocketService.send({
          type: 'edit_message',
          message_id: msgId,
          is_group: false,
          to: activeChatUser.id,
          content: ciphertext,
          iv,
        });
        editMessageInStore(msgId, false, text, iv);
      }

      setEditingMessage(null);
      setInputText('');
      notify({ message: '訊息已成功更新', type: 'success' });
    } catch (err: any) {
      notify({ message: err.message || '編輯發送失敗', type: 'danger' });
    }
  };

  return {
    inputText,
    setInputText,
    pendingFiles,
    setPendingFiles,
    uploading,
    editingMessage,
    setEditingMessage,
    handleSend,
    handleSendVoice,
    handleSendEditedMessage,
  };
}
