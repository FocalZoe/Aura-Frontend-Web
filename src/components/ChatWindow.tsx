import React, { useContext, useState, useEffect, FormEvent, ChangeEvent } from 'react';
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
import styles from './ChatWindow.module.css';
import { useCallStore } from '../stores/useCallStore';

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
  const [emojiPickerState, setEmojiPickerState] = useState<{ x: number; y: number; message: Message } | null>(null);

  // Context: 統一在頂部計算當前對話訊息列表與群成員對應表，嚴格遵守 React Rules of Hooks
  const currentMessages: Message[] = React.useMemo(() => {
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
      }));
    }
    return messages;
  }, [activeGroup, groupMessages, messages]);

  const groupMembersMap = React.useMemo(() => {
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

  // Context: [訊息表情反應] 處理單聊與群組訊息 Emoji Reaction 送出
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

  // 啟動對話截圖模式
  const handleStartScreenshot = (startMsg?: Message) => {
    setIsScreenshotMode(true);
    if (startMsg) {
      const idx = currentMessages.findIndex((m) => m.id === startMsg.id);
      if (idx !== -1) {
        setScreenshotRange({ start: idx, end: idx });
      } else {
        setScreenshotRange(null);
      }
    } else {
      setScreenshotRange(null);
    }
  };

  // 切換/選取截圖訊息 (嚴格連續區間，不可跳行)
  const handleToggleSelectScreenshot = (msg: Message, index: number) => {
    if (!screenshotRange) {
      setScreenshotRange({ start: index, end: index });
    } else {
      setScreenshotRange({
        start: Math.min(screenshotRange.start, index),
        end: Math.max(screenshotRange.end, index),
      });
    }
  };

  // 複製訊息內容
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    notify({ message: '訊息內容已複製至剪貼簿', type: 'success' });
  };

  // 開始編輯訊息
  const handleStartEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setInputText(msg.content);
  };

  // 取消編輯訊息
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // 發送/儲存編輯訊息
  const handleSendEditedMessage = async (newText: string) => {
    if (!editingMessage || !user || !editingMessage.id) return;
    const trimmed = newText.trim();
    if (!trimmed) return;

    try {
      if (activeGroup) {
        const groupKey = await e2eeService.getGroupKey(activeGroup.id);
        const { ciphertext, iv } = await e2eeService.encryptAESGCM(trimmed, groupKey);
        websocketService.send({
          type: 'edit_message',
          message_id: editingMessage.id,
          is_group: true,
          group_id: activeGroup.id,
          content: ciphertext,
          iv,
        });
        editMessageInStore(editingMessage.id, true, trimmed, iv, new Date().toISOString());
      } else if (activeChatUser) {
        const sharedKey = await e2eeService.getSharedKey(activeChatUser.id, user.id, token!);
        if (!sharedKey) throw new Error('無法取得加密金鑰');
        const { ciphertext, iv } = await e2eeService.encryptAESGCM(trimmed, sharedKey);
        websocketService.send({
          type: 'edit_message',
          message_id: editingMessage.id,
          is_group: false,
          to: activeChatUser.id,
          content: ciphertext,
          iv,
        });
        editMessageInStore(editingMessage.id, false, trimmed, iv, new Date().toISOString());
      }

      setEditingMessage(null);
      setInputText('');
      notify({ message: '訊息已成功編輯並同步！', type: 'success' });
    } catch (err: any) {
      console.error('編輯訊息失敗:', err);
      notify({ message: err.message || '編輯訊息失敗', type: 'danger' });
    }
  };

  // 收回訊息 (二次確認保護)
  const handleRecallMessage = (msg: Message) => {
    if (!msg.id) return;
    showConfirmModal({
      title: '確認收回訊息',
      message: '您確定要收回此則訊息嗎？收回後所有成員將無法再查看該訊息內容。',
      danger: true,
      confirmText: '確定收回',
      onConfirm: () => {
        if (activeGroup) {
          websocketService.send({
            type: 'recall_message',
            message_id: msg.id,
            is_group: true,
            group_id: activeGroup.id,
          });
          recallMessageInStore(msg.id!, true);
        } else if (activeChatUser) {
          websocketService.send({
            type: 'recall_message',
            message_id: msg.id,
            is_group: false,
            to: activeChatUser.id,
          });
          recallMessageInStore(msg.id!, false);
        }
        notify({ message: '訊息已成功收回', type: 'info' });
      },
    });
  };

  // 刪除訊息 (單方本地刪除，二次確認保護)
  const handleDeleteMessage = (msg: Message) => {
    if (!msg.id) return;
    showConfirmModal({
      title: '確認刪除訊息',
      message: '您確定要在您的裝置上刪除此訊息嗎？（此動作僅影響您的視角）',
      danger: true,
      confirmText: '確定刪除',
      onConfirm: () => {
        deleteMessageFromStore(msg.id!, !!activeGroup);
        notify({ message: '訊息已從您的裝置刪除', type: 'info' });
      },
    });
  };

  // Context: 判斷當前一對一對象是否已被自己封鎖
  const isBlockedByMe = !!(
    activeChatUser &&
    blockedUsers.some((b) => Number(b.id) === Number(activeChatUser.id))
  );

  // Context: 判斷當前使用者在群組中的 status (accepted, pending, removed)
  const currentGroupMember = activeGroup?.members?.find(
    (m) => Number(m.user_id) === Number(user?.id)
  );

  const isPendingGroupInvite = currentGroupMember?.status === 'pending';

  const isRemovedFromGroup = !!(
    activeGroup &&
    (activeGroup.is_removed ||
      currentGroupMember?.status === 'removed' ||
      (activeGroup.members && user?.id && !activeGroup.members.some((m) => Number(m.user_id) === Number(user.id))))
  );

  // Context: [訊息載入] 當切換群組時載入並解密群組歷史訊息
  useEffect(() => {
    const fetchGroupMessages = async () => {
      if (activeGroup && token) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<any[]>(`/groups/${activeGroup.id}/messages`, token);
          const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
          setGroupMessages(decryptedList);
        } catch (err) {
          console.error('獲取群組歷史訊息失敗:', err);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    fetchGroupMessages();
  }, [activeGroup?.id, token]);

  // Context: [訊息載入] 當切換私聊/陌生人時載入並解密一對一歷史訊息
  useEffect(() => {
    const fetchDirectMessages = async () => {
      if (activeChatUser && token && user) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<Message[]>(`/messages/${activeChatUser.id}`, token);
          if (Array.isArray(rawMsgs)) {
            const decryptedList = await e2eeService.decryptHistoryMessages(rawMsgs, user.id, activeChatUser.id, token);
            setMessages(decryptedList);
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

  // Context: [好友判定] 由 Zustand Store 的 friends 進行響應式訂閱
  const friends = useChatStore((s) => s.friends);

  useEffect(() => {
    if (activeChatUser) {
      setIsFriend(friends.some((f) => f.id === activeChatUser.id));
    }
  }, [activeChatUser, friends]);

  // Context: [群組管理] 同意群組邀請
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

  // Context: [群組管理] 拒絕群組邀請
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

  // Context: [一對一訊息發送] 封裝 E2EE 金鑰衍生與 WebSocket 即時傳送
  const sendDirectMessage = async (toUserId: number, partnerPublicKeyBase64: string | undefined, content: string) => {
    if (!user || !token) return;
    let partnerPubKey: string | undefined = partnerPublicKeyBase64 || friendsMap[toUserId];
    if (!partnerPubKey) {
      partnerPubKey = await e2eeService.fetchUserPublicKey(toUserId, token);
    }
    if (!partnerPubKey) {
      throw new Error('對方尚未完成設定，暫時無法傳送訊息');
    }

    const privateKey = await getLocalPrivateKey(user.id);
    if (!privateKey) {
      throw new Error('請先輸入 PIN 碼解鎖對話');
    }

    const targetPubKey: string = partnerPubKey;
    const importedPubKey = await importPublicKey(targetPubKey);
    const sharedKey = await deriveSharedKey(privateKey, importedPubKey);
    const { ciphertext, iv } = await encryptMessage(sharedKey, content);

    websocketService.send({
      type: 'message',
      to: toUserId,
      content: ciphertext,
      iv,
    });

    addMessage({
      id: Date.now(),
      sender_id: user.id,
      receiver_id: toUserId,
      to: toUserId,
      content,
      iv,
      timestamp: new Date().toISOString(),
      decrypted: true,
    });

    if (!isFriend && activeChatUser) {
      addStrangerUser(activeChatUser, true);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    if (activeGroup) {
      try {
        const { ciphertext, iv } = await e2eeService.encryptGroupMessage(activeGroup.id, inputText.trim());
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
          content: inputText.trim(),
          iv,
          timestamp: new Date().toISOString(),
          decrypted: true,
          sender: user,
        });

        setInputText('');
      } catch (err: any) {
        notify({ message: err.message || '群組訊息發送失敗', type: 'danger' });
      }
      return;
    }

    if (activeChatUser) {
      try {
        await sendDirectMessage(activeChatUser.id, activeChatUser.public_key, inputText.trim());
        setInputText('');
      } catch (err: any) {
        notify({ message: err.message || '訊息發送失敗', type: 'danger' });
      }
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatUser || !user || !token) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const privateKey = await getLocalPrivateKey(user.id);
      if (!privateKey || !activeChatUser.public_key) {
        notify({ message: '請先確認對方與自身的金鑰已備份', type: 'warning' });
        return;
      }

      const partnerPublicKey = await importPublicKey(activeChatUser.public_key);
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
      await sendDirectMessage(activeChatUser.id, activeChatUser.public_key, ipfsMessageContent);
      notify({ message: '檔案已成功傳送！', type: 'success' });
    } catch (err: any) {
      console.error('檔案傳送失敗:', err);
      notify({ message: err.message || '檔案傳送失敗', type: 'danger' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Context: [語音訊息] 處理語音錄製完成後的音訊安全傳送
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
        onViewProfile={() => {
          if (activeChatUser) setSelectedProfileUser(activeChatUser);
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
          <span>安全傳送檔案中...</span>
        </div>
      )}

      {/* 底部操作區域：若在截圖模式則直接呈現截圖控制列，否則呈現正常聊天輸入列 */}
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

          {/* Context: 聊天輸入區域狀態判定（已封鎖用戶 / 待同意邀請 / 被移出群組 / 正常輸入框） */}
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
              onSendMessage={(e) => {
                if (editingMessage) {
                  e.preventDefault();
                  handleSendEditedMessage(inputText);
                } else {
                  handleSend(e);
                }
              }}
              onFileUpload={handleFileUpload}
              onSendVoice={handleSendVoice}
              isUploadingIPFS={uploading}
              disabled={activeChatUser ? !activeChatUser.public_key : false}
            />
          )}
        </>
      )}

      {/* 訊息氣泡右鍵選單 */}
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
          onOpenFullEmojiPicker={(msg, x, y) => setEmojiPickerState({ message: msg, x, y })}
        />
      )}

      {/* 獨立全表情符號浮動選取器 (游標旁彈出) */}
      <EmojiPickerPopover
        isOpen={Boolean(emojiPickerState)}
        x={emojiPickerState?.x || 0}
        y={emojiPickerState?.y || 0}
        onClose={() => setEmojiPickerState(null)}
        onSelectEmoji={(emoji) => {
          if (emojiPickerState?.message.id) {
            handleReaction(emojiPickerState.message.id, emoji);
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
    </div>
  );
};

