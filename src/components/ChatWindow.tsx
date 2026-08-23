// Context: 核心聊天室視窗 (整合搜尋與跳轉聚焦、分頁無感加載、多附件暫存打字再傳、IG多圖預覽、LINE貼圖Tab與右鍵常駐)
import React, { useContext, useState, useEffect, FormEvent, ChangeEvent, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import { websocketService } from '../services/websocketService';
import { e2eeService } from '../services/e2eeService';
import { apiClient, getApiBase } from '../services/apiClient';
import { MessageSquare, File, Download, Loader2, X, AlertCircle, Edit2 } from 'lucide-react';
import { IPFSFilePayload, Message, User } from '../types';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, encryptMessage, encryptFileBuffer, decryptFileBuffer } from '../utils/crypto';
import { uploadToIPFS, fetchFromIPFS } from '../utils/ipfs';

import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';
import { IPFSFileCard } from './chat/IPFSFileCard';
import { MessageContextMenu } from './chat/MessageContextMenu';
import { ScreenshotToolbar } from './chat/ScreenshotToolbar';
import { ChatScreenshotModal } from './chat/ChatScreenshotModal';
import { MessageReactionsModal } from './chat/MessageReactionsModal';
import { EmojiPickerPopover } from './chat/EmojiPickerPopover';
import { ChatSearchBar } from './chat/ChatSearchBar';
import { GroupCallBanner } from './chat/GroupCallBanner';
import { GroupCallModal } from './Call/GroupCallModal';
import styles from './ChatWindow.module.css';
import { useCallStore } from '../stores/useCallStore';
import { useGroupCallStore } from '../stores/useGroupCallStore';

export const ChatWindow: React.FC = () => {
  const startCall = useCallStore((s: any) => s.startCall);
  const { user, token, API_BASE } = useContext(AuthContext);

  const {
    activeChatUser,
    setActiveChatUser,
    activeGroup,
    messages,
    groupMessages,
    blockedUsers,
    onlineUsers,
    friendsMap,
    addStrangerUser,
    updateGroupInStore,
    setMessages,
    setGroupMessages,
    addMessage,
    addGroupMessage,
    removeConversation,
    removeGroup,
    editMessageInStore,
    recallMessageInStore,
    deleteMessageFromStore,
  } = useChatStore();

  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));

  const { setShowGroupMembersModal, setActiveGroupForModal, setSelectedProfileUser, showConfirmModal } = useUIStore();
  const { notify } = useNotification();
  const [inputText, setInputText] = useState<string>('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isFriend, setIsFriend] = useState<boolean>(true);

  // Context: [訊息右鍵選單狀態]
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; message: Message } | null>(null);

  // Context: [對話連續截圖狀態]
  const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(false);
  const [screenshotRange, setScreenshotRange] = useState<{ start: number; end: number } | null>(null);
  const [isAnonymousScreenshot, setIsAnonymousScreenshot] = useState<boolean>(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState<boolean>(false);

  // Context: [訊息編輯狀態]
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Context: [訊息載入與表情反應詳情狀態]
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [selectedReactionMessage, setSelectedReactionMessage] = useState<Message | null>(null);
  const [emojiPickerState, setEmojiPickerState] = useState<{ x: number; y: number; message?: Message; isInputTarget?: boolean } | null>(null);

  // Context: [聊天室內搜尋狀態]
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchCurrentMatchIndex, setSearchCurrentMatchIndex] = useState<number>(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  // Context: [歷史訊息分頁與無感向上加載]
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<boolean>(false);

  // Context: 統一在頂部計算當前對話訊息列表與群成員對應表
  const currentMessages: Message[] = useMemo(() => {
    if (activeGroup) {
      return groupMessages.map((gm) => ({
        id: gm.id,
        sender_id: gm.sender_id,
        content: gm.content,
        iv: gm.iv,
        timestamp: gm.timestamp,
        decrypted: gm.decrypted,
        error: gm.error,
        reactions: gm.reactions,
        is_edited: gm.is_edited,
        is_recalled: gm.is_recalled,
        edited_at: gm.edited_at,
        sender: gm.sender,
        is_system: gm.is_system,
        filePayload: gm.filePayload,
      }));
    }
    return messages;
  }, [activeGroup, groupMessages, messages]);

  const groupMembersMap = useMemo(() => {
    if (!activeGroup?.members) return undefined;
    const map: Record<number, { user?: User; nickname?: string }> = {};
    for (const m of activeGroup.members) {
      map[m.user_id] = {
        user: m.user,
        nickname: m.nickname,
      };
    }
    return map;
  }, [activeGroup?.members]);

  // 搜尋關鍵字匹配 (排除檔案/語音訊息，僅搜尋純文字)
  const matchedMessageIds = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return [];
    return currentMessages
      .filter((m) => {
        // 排除檔案、語音與 IPFS Payload
        if (m.filePayload || (m.content && m.content.startsWith('[IPFS_FILE]'))) return false;
        if (m.content && m.content.toLowerCase().includes(q)) return true;
        return false;
      })
      .map((m) => m.id!)
      .filter(Boolean);
  }, [currentMessages, searchKeyword]);

  // 跳至指定搜尋結果
  const jumpToMatchedMessage = (index: number) => {
    if (matchedMessageIds.length === 0) return;
    const boundedIndex = (index + matchedMessageIds.length) % matchedMessageIds.length;
    setSearchCurrentMatchIndex(boundedIndex);
    const targetId = matchedMessageIds[boundedIndex];
    setHighlightedMessageId(targetId);

    const el = document.getElementById(`message-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
    }, 800);
  };

  useEffect(() => {
    if (matchedMessageIds.length > 0) {
      jumpToMatchedMessage(0);
    } else {
      setHighlightedMessageId(null);
    }
  }, [matchedMessageIds.length, searchKeyword]);

  // Context: [訊息表情反應] 送出
  const handleReaction = (messageId: number, emoji: string) => {
    if (!user) return;
    if (activeGroup) {
      websocketService.send({
        type: 'reaction',
        message_id: messageId,
        is_group: true,
        group_id: activeGroup.id,
        emoji,
      });
    } else if (activeChatUser) {
      websocketService.send({
        type: 'reaction',
        message_id: messageId,
        is_group: false,
        to: activeChatUser.id,
        emoji,
      });
    }
  };

  // 處理訊息右鍵點擊
  const handleMessageContextMenu = (e: React.MouseEvent, msg: Message) => {
    setContextMenuState({
      x: e.clientX,
      y: e.clientY,
      message: msg,
    });
  };

  // 啟動對話截圖
  const handleStartScreenshot = (initialMsg?: Message) => {
    setIsScreenshotMode(true);
    if (initialMsg && initialMsg.id) {
      const idx = currentMessages.findIndex((m) => m.id === initialMsg.id);
      if (idx !== -1) {
        setScreenshotRange({ start: idx, end: idx });
        return;
      }
    }
    if (currentMessages.length > 0) {
      setScreenshotRange({ start: 0, end: currentMessages.length - 1 });
    }
  };

  const handleToggleSelectScreenshot = (msg: Message, clickedIndex: number) => {
    if (!screenshotRange) {
      setScreenshotRange({ start: clickedIndex, end: clickedIndex });
      return;
    }
    if (clickedIndex < screenshotRange.start) {
      setScreenshotRange({ ...screenshotRange, start: clickedIndex });
    } else if (clickedIndex > screenshotRange.end) {
      setScreenshotRange({ ...screenshotRange, end: clickedIndex });
    } else {
      const distToStart = Math.abs(clickedIndex - screenshotRange.start);
      const distToEnd = Math.abs(clickedIndex - screenshotRange.end);
      if (distToStart <= distToEnd) {
        setScreenshotRange({ ...screenshotRange, start: Math.min(clickedIndex + 1, screenshotRange.end) });
      } else {
        setScreenshotRange({ ...screenshotRange, end: Math.max(clickedIndex - 1, screenshotRange.start) });
      }
    }
  };

  // 複製訊息文字
  const handleCopyMessage = (content: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(
      () => notify({ message: '已複製訊息文字至剪貼簿', type: 'info' }),
      () => notify({ message: '複製失敗', type: 'danger' })
    );
  };

  // 編輯訊息
  const handleStartEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setInputText(msg.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleSendEditedMessage = async (newContent: string) => {
    if (!editingMessage || !editingMessage.id || !user) return;
    const trimmed = newContent.trim();
    if (!trimmed) {
      notify({ message: '訊息內容不可為空', type: 'warning' });
      return;
    }

    if (activeGroup) {
      try {
        const { ciphertext, iv } = await e2eeService.encryptGroupMessage(activeGroup.id, trimmed);
        websocketService.send({
          type: 'edit_message',
          message_id: editingMessage.id,
          is_group: true,
          group_id: activeGroup.id,
          content: ciphertext,
          iv,
        });
        editMessageInStore(editingMessage.id, true, trimmed, iv, new Date().toISOString());
        handleCancelEdit();
        notify({ message: '已成功修改訊息', type: 'success' });
      } catch (err: any) {
        notify({ message: err.message || '編輯群組訊息失敗', type: 'danger' });
      }
      return;
    }

    if (activeChatUser) {
      try {
        let partnerPubKey: string | null | undefined = activeChatUser.public_key || friendsMap[activeChatUser.id];
        if (!partnerPubKey && token) {
          partnerPubKey = await e2eeService.fetchUserPublicKey(activeChatUser.id, token);
        }
        if (!partnerPubKey) throw new Error('無法獲取對方公鑰');

        const privateKey = await getLocalPrivateKey(user.id);
        if (!privateKey) throw new Error('請先輸入 PIN 碼解鎖私鑰');

        const importedPubKey = await importPublicKey(partnerPubKey);
        const sharedKey = await deriveSharedKey(privateKey, importedPubKey);
        const { ciphertext, iv } = await encryptMessage(sharedKey, trimmed);

        websocketService.send({
          type: 'edit_message',
          message_id: editingMessage.id,
          is_group: false,
          to: activeChatUser.id,
          content: ciphertext,
          iv,
        });

        editMessageInStore(editingMessage.id, false, trimmed, iv, new Date().toISOString());
        handleCancelEdit();
        notify({ message: '已成功修改訊息', type: 'success' });
      } catch (err: any) {
        notify({ message: err.message || '編輯訊息失敗', type: 'danger' });
      }
    }
  };

  // 收回訊息
  const handleRecallMessage = async (msg: Message) => {
    if (!msg.id || !user) return;
    const msgId = msg.id;
    showConfirmModal({
      title: '收回訊息',
      message: '確定要收回此訊息嗎？收回後所有成員皆無法再看見該訊息內容。',
      confirmText: '確認收回',
      danger: true,
      onConfirm: () => {
        if (activeGroup) {
          websocketService.send({
            type: 'recall_message',
            message_id: msgId,
            is_group: true,
            group_id: activeGroup.id,
          });
          recallMessageInStore(msgId, true);
        } else if (activeChatUser) {
          websocketService.send({
            type: 'recall_message',
            message_id: msgId,
            is_group: false,
            to: activeChatUser.id,
          });
          recallMessageInStore(msgId, false);
        }
        notify({ message: '已收回訊息', type: 'info' });
      },
    });
  };

  // 單方刪除訊息
  const handleDeleteMessage = async (msg: Message) => {
    if (!msg.id || !user || !token) return;
    const msgId = msg.id;
    showConfirmModal({
      title: '刪除訊息',
      message: '確定要在您的裝置上刪除此訊息嗎？（此操作僅對本機生效，對方仍可看見）',
      confirmText: '確認刪除',
      danger: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/messages/single/${msgId}`, token);
          deleteMessageFromStore(msgId, Boolean(activeGroup));
          notify({ message: '已刪除該訊息', type: 'info' });
        } catch (err: any) {
          notify({ message: err.message || '刪除失敗', type: 'danger' });
        }
      },
    });
  };

  // Context: [群組歷史訊息載入 (支援分頁與向上加載)]
  useEffect(() => {
    const fetchGroupMessages = async () => {
      if (activeGroup && token) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<any[]>(`/groups/${activeGroup.id}/messages?limit=25`, token);
          const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
          setGroupMessages(decryptedList);
          setHasMoreMessages(rawMsgs.length >= 25);
        } catch (err) {
          console.error('獲取群組歷史訊息失敗:', err);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    fetchGroupMessages();
  }, [activeGroup?.id, token]);

  // Context: [私聊歷史訊息載入 (支援分頁與向上加載)]
  useEffect(() => {
    const fetchDirectMessages = async () => {
      if (activeChatUser && token && user) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<Message[]>(`/messages/${activeChatUser.id}?limit=25`, token);
          if (Array.isArray(rawMsgs)) {
            const decryptedList = await e2eeService.decryptHistoryMessages(rawMsgs, user.id, activeChatUser.id, token);
            setMessages(decryptedList);
            setHasMoreMessages(rawMsgs.length >= 25);
          }
        } catch (err) {
          console.error('獲取私聊歷史訊息失敗:', err);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    fetchDirectMessages();
  }, [activeChatUser?.id, token, user?.id]);

  // Context: 向上滾動加載更多歷史訊息 (每次 25 則)
  const handleLoadMoreMessages = async () => {
    if (loadingMoreMessages || !hasMoreMessages || !token || !user) return;
    if (currentMessages.length === 0) return;

    const earliestMsgId = currentMessages[0]?.id;
    if (!earliestMsgId) return;

    setLoadingMoreMessages(true);
    try {
      if (activeGroup) {
        const rawMsgs = await apiClient.get<any[]>(
          `/groups/${activeGroup.id}/messages?limit=25&before_id=${earliestMsgId}`,
          token
        );
        if (rawMsgs.length > 0) {
          const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
          setGroupMessages([...decryptedList, ...groupMessages]);
        }
        setHasMoreMessages(rawMsgs.length >= 25);
      } else if (activeChatUser) {
        const rawMsgs = await apiClient.get<Message[]>(
          `/messages/${activeChatUser.id}?limit=25&before_id=${earliestMsgId}`,
          token
        );
        if (rawMsgs.length > 0) {
          const decryptedList = await e2eeService.decryptHistoryMessages(rawMsgs, user.id, activeChatUser.id, token);
          setMessages([...decryptedList, ...messages]);
        }
        setHasMoreMessages(rawMsgs.length >= 25);
      }
    } catch (err) {
      console.error('加載更多歷史訊息失敗:', err);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const friends = useChatStore((s) => s.friends);

  useEffect(() => {
    if (activeChatUser) {
      setIsFriend(friends.some((f) => f.id === activeChatUser.id));
    }
  }, [activeChatUser, friends]);

  // 同意/拒絕群組邀請
  const handleAcceptInvite = async () => {
    if (!activeGroup || !token) return;
    try {
      await apiClient.post(`/groups/${activeGroup.id}/accept`, {}, token);
      if (activeGroup.members && user) {
        const updatedMembers = activeGroup.members.map((m) =>
          Number(m.user_id) === Number(user.id) ? { ...m, status: 'accepted' as const } : m
        );
        updateGroupInStore(activeGroup.id, { ...activeGroup, members: updatedMembers });
      }
      notify({ message: '已同意加入群組！', type: 'success' });
    } catch (err: any) {
      notify({ message: err.message || '操作失敗', type: 'danger' });
    }
  };

  const handleRejectInvite = async () => {
    if (!activeGroup || !token) return;
    try {
      await apiClient.post(`/groups/${activeGroup.id}/reject`, {}, token);
      removeGroup(activeGroup.id);
      notify({ message: '已拒絕群組邀請', type: 'info' });
    } catch (err: any) {
      notify({ message: err.message || '操作失敗', type: 'danger' });
    }
  };

  // 一對一直接傳訊 (支援文字與檔案 Payload)
  const sendDirectMessage = async (
    toUserId: number,
    partnerPublicKeyBase64: string | undefined,
    content: string,
    filePayload?: IPFSFilePayload
  ) => {
    if (!user || !token) return;
    let partnerPubKey: string | null | undefined = partnerPublicKeyBase64 || friendsMap[toUserId];
    if (!partnerPubKey) {
      partnerPubKey = await e2eeService.fetchUserPublicKey(toUserId, token);
    }
    if (!partnerPubKey) {
      throw new Error('對方尚未完成金鑰設定，暫時無法傳送加密訊息');
    }

    const privateKey = await getLocalPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('請先輸入 PIN 碼解鎖對話');
    }

    const importedPubKey = await importPublicKey(partnerPubKey);
    const sharedKey = await deriveSharedKey(privateKey, importedPubKey);
    const { ciphertext, iv } = await encryptMessage(sharedKey, content);

    websocketService.send({
      type: 'message',
      to: toUserId,
      content: ciphertext,
      iv,
    });

    addMessage({
      id: Date.now() + Math.floor(Math.random() * 1000),
      sender_id: user.id,
      receiver_id: toUserId,
      to: toUserId,
      content,
      iv,
      timestamp: new Date().toISOString(),
      decrypted: true,
      filePayload,
    });

    if (!isFriend && activeChatUser) {
      addStrangerUser(activeChatUser, true);
    }
  };

  // Context: [檔案加密上傳] 支援私聊與群聊
  const uploadAndSendSingleFile = async (file: File) => {
    if (!user || !token) return;
    const arrayBuffer = await file.arrayBuffer();

    if (activeGroup) {
      const groupKey = await e2eeService.getGroupKey(activeGroup.id);
      const { encryptedData, iv } = await encryptFileBuffer(groupKey, arrayBuffer);
      const cid = await uploadToIPFS(encryptedData, API_BASE || getApiBase());

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
      if (!partnerPubKey) {
        partnerPubKey = await e2eeService.fetchUserPublicKey(activeChatUser.id, token);
      }
      if (!partnerPubKey) {
        throw new Error('對方尚未完成金鑰初始化，無法傳送加密檔案');
      }

      const partnerPublicKey = await importPublicKey(partnerPubKey);
      const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);

      const { encryptedData, iv } = await encryptFileBuffer(sharedKey, arrayBuffer);
      const cid = await uploadToIPFS(encryptedData, API_BASE || getApiBase());

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

  // Context: [統一發送] 支援附件與文字一併發送
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const hasText = inputText.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;

    // 1. 若有待發送附件，依序加密上傳並發送
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

    // 2. 若有文字訊息，送出文字
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

  // 語音傳送
  const handleSendVoice = async (audioBlob: Blob) => {
    if (!user || !token) return;
    if (!activeChatUser && !activeGroup) return;

    setUploading(true);
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      if (activeGroup) {
        const groupKey = await e2eeService.getGroupKey(activeGroup.id);
        const { encryptedData, iv } = await encryptFileBuffer(groupKey, arrayBuffer);
        const cid = await uploadToIPFS(encryptedData, API_BASE || getApiBase());

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
        const cid = await uploadToIPFS(encryptedData, API_BASE || getApiBase());

        const payload: IPFSFilePayload = {
          cid,
          name: `voice-message-${Date.now()}.webm`,
          size: audioBlob.size,
          mime: audioBlob.type || 'audio/webm',
          encrypted: true,
          iv,
        };

        const ipfsMessageContent = `[IPFS_FILE]${JSON.stringify(payload)}`;
        await sendDirectMessage(activeChatUser.id, activeChatUser.public_key, ipfsMessageContent);
        notify({ message: '語音訊息已成功傳送！', type: 'success' });
      }
    } catch (err: any) {
      console.error('語音傳送失敗:', err);
      notify({ message: err.message || '語音傳送失敗', type: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  const isBlockedByMe = activeChatUser
    ? blockedUsers.some((u) => Number(u.id) === Number(activeChatUser.id))
    : false;
  const isPendingGroupInvite = activeGroup?.members?.some(
    (m) => Number(m.user_id) === Number(user?.id) && m.status === 'pending'
  );
  const isRemovedFromGroup = activeGroup?.is_removed;

  if (!activeChatUser && !activeGroup) {
    return (
      <div className={styles.chatWindow}>
        <div className={styles.chatEmpty}>
          <MessageSquare size={48} strokeWidth={1.5} />
          <h3>點擊聯絡人或群組開始聊天</h3>
          <p>選擇左側的好友、群組或陌生人，即可開始安全暢聊。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatWindow}>
      <ChatHeader
        activeChatUser={activeChatUser}
        activeGroup={activeGroup}
        isUserOnline={activeChatUser ? isUserOnline(activeChatUser.id) : false}
        isStranger={activeChatUser ? !isFriend : false}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onViewProfile={() => {
          if (activeChatUser) setSelectedProfileUser(activeChatUser, 'chat_header');
        }}
        onStartScreenshot={() => handleStartScreenshot()}
        onOpenGroupModal={() => {
          if (activeGroup) {
            setActiveGroupForModal(activeGroup);
            setShowGroupMembersModal(true);
          }
        }}
        onBack={() => {
          setActiveChatUser(null);
          useChatStore.getState().setActiveGroup(null);
        }}
        onStartAudioCall={
          activeChatUser && isFriend
            ? () =>
                startCall(
                  {
                    id: activeChatUser.id,
                    name: activeChatUser.display_name || activeChatUser.account_id,
                    avatar: activeChatUser.avatar,
                  },
                  'audio'
                )
            : activeGroup && !activeGroup.is_removed
            ? () => useGroupCallStore.getState().startGroupCall(activeGroup.id, activeGroup.name, 'audio')
            : undefined
        }
        onStartVideoCall={
          activeChatUser && isFriend
            ? () =>
                startCall(
                  {
                    id: activeChatUser.id,
                    name: activeChatUser.display_name || activeChatUser.account_id,
                    avatar: activeChatUser.avatar,
                  },
                  'video'
                )
            : activeGroup && !activeGroup.is_removed
            ? () => useGroupCallStore.getState().startGroupCall(activeGroup.id, activeGroup.name, 'video')
            : undefined
        }
        onSendFriendRequest={async () => {
          if (!activeChatUser) return;
          try {
            const res = await fetch(`${API_BASE}/friends/request`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ account_id: activeChatUser.account_id }),
            });
            if (res.ok) {
              notify({ message: '好友邀請已發送！', type: 'success' });
            }
          } catch (err) {
            console.error('發送邀請失敗:', err);
          }
        }}
      />

      {/* 群組通話頂部常駐 Banner */}
      {activeGroup && (
        <GroupCallBanner
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          onOpenModal={() => {}}
        />
      )}

      {/* 聊天室內即時搜尋列 */}
      {showSearch && (
        <ChatSearchBar
          keyword={searchKeyword}
          onKeywordChange={setSearchKeyword}
          currentIndex={searchCurrentMatchIndex}
          matchCount={matchedMessageIds.length}
          onNext={() => jumpToMatchedMessage(searchCurrentMatchIndex + 1)}
          onPrev={() => jumpToMatchedMessage(searchCurrentMatchIndex - 1)}
          onClose={() => {
            setShowSearch(false);
            setSearchKeyword('');
            setHighlightedMessageId(null);
          }}
        />
      )}

      {/* 訊息列表 (支援向上無感載入與搜尋高亮) */}
      <MessageList
        messages={currentMessages}
        currentUserId={user?.id || 0}
        currentUser={user || undefined}
        partnerUser={activeChatUser || undefined}
        isGroup={Boolean(activeGroup)}
        groupMembersMap={groupMembersMap}
        loading={loadingMessages}
        onReaction={handleReaction}
        onViewProfile={(u) => setSelectedProfileUser(u)}
        onContextMenu={handleMessageContextMenu}
        onViewReactions={(m) => setSelectedReactionMessage(m)}
        isScreenshotMode={isScreenshotMode}
        selectedRange={screenshotRange}
        onToggleSelectScreenshot={handleToggleSelectScreenshot}
        highlightKeyword={searchKeyword}
        highlightedMessageId={highlightedMessageId}
        onLoadMore={handleLoadMoreMessages}
        hasMore={hasMoreMessages}
        loadingMore={loadingMoreMessages}
        renderIPFSFileCard={(msg) => (
          <IPFSFileCard
            payload={msg.filePayload!}
            iv={msg.iv}
            senderId={msg.sender_id}
            partnerId={activeChatUser?.id || 0}
            partnerPublicKeyBase64={activeChatUser?.public_key}
            groupId={activeGroup?.id}
          />
        )}
      />

      {uploading && (
        <div className={styles.ipfsUploadingBanner}>
          <Loader2 size={16} className="spin" />
          <span>安全處理並傳送檔案中...</span>
        </div>
      )}

      {/* 底部操作區域 */}
      {isScreenshotMode ? (
        <ScreenshotToolbar
          selectedCount={screenshotRange ? screenshotRange.end - screenshotRange.start + 1 : 0}
          startIndex={screenshotRange ? screenshotRange.start : 0}
          endIndex={screenshotRange ? screenshotRange.end : 0}
          isAnonymous={isAnonymousScreenshot}
          onToggleAnonymous={() => setIsAnonymousScreenshot(!isAnonymousScreenshot)}
          onGenerate={() => setShowScreenshotModal(true)}
          onCancel={() => {
            setIsScreenshotMode(false);
            setScreenshotRange(null);
          }}
        />
      ) : (
        <>
          {/* 正在編輯訊息提示條 */}
          {editingMessage && (
            <div className={styles.editingBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Edit2 size={15} color="var(--accent-color)" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--accent-color)' }}>正在編輯訊息:</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingMessage.content}
                </span>
              </div>
              <button
                type="button"
                className={styles.cancelEditBtn}
                onClick={handleCancelEdit}
                title="取消編輯"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* 聊天輸入區域狀態判定 */}
          {isBlockedByMe ? (
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}>
              <AlertCircle size={18} />
              <span>你已封鎖此用戶</span>
            </div>
          ) : isPendingGroupInvite ? (
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-primary)',
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>您已被邀請加入此群組，同意邀請後方可進行聊天</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="uiBtnPrimary" onClick={handleAcceptInvite} style={{ padding: '6px 20px' }}>
                  同意邀請
                </button>
                <button className="uiBtnSecondary" onClick={handleRejectInvite} style={{ padding: '6px 20px' }}>
                  拒絕邀請
                </button>
              </div>
            </div>
          ) : isRemovedFromGroup ? (
            <div className={styles.groupRemovedBanner}>
              <AlertCircle size={18} />
              <span>你已被移出群組，無法在此傳送訊息</span>
            </div>
          ) : (
            <ChatInput
              inputText={inputText}
              setInputText={setInputText}
              pendingFiles={pendingFiles}
              onRemovePendingFile={(idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
              onFilesSelected={(files) => {
                const newFiles = Array.isArray(files) ? files : Array.from(files);
                setPendingFiles((prev) => [...prev, ...newFiles]);
              }}
              onSendMessage={(e) => {
                if (editingMessage) {
                  e.preventDefault();
                  handleSendEditedMessage(inputText);
                } else {
                  handleSend(e);
                }
              }}
              onSendVoice={handleSendVoice}
              onStartScreenshot={() => handleStartScreenshot()}
              onOpenEmojiPicker={(x, y) => setEmojiPickerState({ x, y, isInputTarget: true })}
              isUploadingIPFS={uploading}
              disabled={false}
            />
          )}
        </>
      )}

      {/* 訊息氣泡右鍵選單 (常駐不自動消失) */}
      {contextMenuState && (
        <MessageContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          message={contextMenuState.message}
          currentUserId={user?.id || 0}
          onClose={() => setContextMenuState(null)}
          onReaction={handleReaction}
          onStartScreenshot={(msg) => handleStartScreenshot(msg)}
          onCopy={handleCopyMessage}
          onEdit={handleStartEditMessage}
          onRecall={handleRecallMessage}
          onDelete={handleDeleteMessage}
          onViewReactions={(msg) => setSelectedReactionMessage(msg)}
          onOpenFullEmojiPicker={(msg, x, y) => setEmojiPickerState({ message: msg, x, y, isInputTarget: false })}
        />
      )}

      {/* 獨立全表情/貼圖/表情貼浮動選取器 (游標旁/輸入框旁彈出) */}
      <EmojiPickerPopover
        isOpen={Boolean(emojiPickerState)}
        x={emojiPickerState?.x || 0}
        y={emojiPickerState?.y || 0}
        mode={emojiPickerState?.isInputTarget ? 'input' : 'reaction'}
        onClose={() => setEmojiPickerState(null)}
        onSelectEmoji={(emoji) => {
          if (emojiPickerState?.isInputTarget) {
            setInputText((prev) => prev + emoji);
          } else if (emojiPickerState?.message?.id) {
            handleReaction(emojiPickerState.message.id, emoji);
            setContextMenuState(null); // 完成表情反應後關閉選單
          }
        }}
        onSelectSticker={(stk) => {
          if (emojiPickerState?.isInputTarget) {
            setInputText((prev) => prev + stk.emoji);
          }
        }}
      />

      {/* 訊息表情反應名單彈窗 */}
      <MessageReactionsModal
        isOpen={Boolean(selectedReactionMessage)}
        onClose={() => setSelectedReactionMessage(null)}
        message={selectedReactionMessage}
        groupMembersMap={groupMembersMap}
        currentUser={user}
        partnerUser={activeChatUser}
        onViewProfile={(u) => setSelectedProfileUser(u)}
      />

      {/* 對話截圖預覽與下載彈窗 */}
      <ChatScreenshotModal
        isOpen={showScreenshotModal}
        onClose={() => setShowScreenshotModal(false)}
        messages={
          screenshotRange
            ? currentMessages.slice(screenshotRange.start, screenshotRange.end + 1)
            : []
        }
        isAnonymous={isAnonymousScreenshot}
        currentUserId={user?.id || 0}
        partnerUser={activeChatUser}
        groupName={activeGroup?.name}
      />

      {/* Discord 級別群組 SFU 音視訊通話主視窗 */}
      <GroupCallModal />
    </div>
  );
};
