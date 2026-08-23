// Context: 核心聊天室視窗 (包含歷史訊息自動載入、E2EE 解密、搜尋、截圖與即時通訊)

import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import { useCallStore } from '../stores/useCallStore';
import { useGroupCallStore } from '../stores/useGroupCallStore';
import { websocketService } from '../services/websocketService';
import { e2eeService } from '../services/e2eeService';
import { apiClient } from '../services/apiClient';
import { MessageSquare, AlertCircle, Edit2, X, Loader2 } from 'lucide-react';
import { Message, User } from '../types';

import { useMessageSender } from '../hooks/useMessageSender';
import { useChatSearch } from '../hooks/useChatSearch';
import { useChatScreenshot } from '../hooks/useChatScreenshot';

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

export const ChatWindow: React.FC = () => {
  const startCall = useCallStore((s: any) => s.startCall);
  const { user, token, API_BASE } = useContext(AuthContext);

  const {
    activeChatUser,
    activeGroup,
    messages,
    groupMessages,
    blockedUsers,
    onlineUsers,
    friends,
    friendsMap,
    setMessages,
    setGroupMessages,
    updateGroupInStore,
    removeGroup,
    recallMessageInStore,
    deleteMessageFromStore,
  } = useChatStore();

  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));

  const { setShowGroupMembersModal, setActiveGroupForModal, setSelectedProfileUser, showConfirmModal } = useUIStore();
  const { notify } = useNotification();

  // Context: 好友關係判定 (支援好友列表與公鑰快取字典)
  const isFriend = useMemo(() => {
    if (!activeChatUser) return true;
    return friends.some((f) => Number(f.id) === Number(activeChatUser.id)) || !!friendsMap[activeChatUser.id];
  }, [activeChatUser, friends, friendsMap]);

  // Context: [訊息右鍵選單狀態]
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; message: Message } | null>(null);

  // Context: [表情反應名單詳情狀態]
  const [selectedReactionMessage, setSelectedReactionMessage] = useState<Message | null>(null);
  const [emojiPickerState, setEmojiPickerState] = useState<{ x: number; y: number; message?: Message; isInputTarget?: boolean } | null>(null);

  // Context: [訊息載入狀態與分頁]
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState<boolean>(false);

  // Context: [群組歷史訊息自動載入與 E2EE 解密]
  useEffect(() => {
    const fetchGroupMessages = async () => {
      if (activeGroup && token) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<any[]>(`/groups/${activeGroup.id}/messages?limit=50`, token);
          if (Array.isArray(rawMsgs)) {
            const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
            setGroupMessages(decryptedList);
            setHasMoreMessages(rawMsgs.length >= 50);
          }
        } catch (err) {
          console.error('獲取群組歷史訊息失敗:', err);
        } finally {
          setLoadingMessages(false);
        }
      }
    };

    fetchGroupMessages();
  }, [activeGroup?.id, token]);

  // Context: [私聊歷史訊息自動載入與 E2EE 解密]
  useEffect(() => {
    const fetchDirectMessages = async () => {
      if (activeChatUser && token && user) {
        setLoadingMessages(true);
        try {
          const rawMsgs = await apiClient.get<Message[]>(`/messages/${activeChatUser.id}?limit=50`, token);
          if (Array.isArray(rawMsgs)) {
            const decryptedList = await e2eeService.decryptHistoryMessages(rawMsgs, user.id, activeChatUser.id, token);
            setMessages(decryptedList);
            setHasMoreMessages(rawMsgs.length >= 50);
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

  // Context: 接入三大解耦自訂 Hooks
  const {
    inputText,
    setInputText,
    pendingFiles,
    setPendingFiles,
    uploading,
    editingMessage,
    setEditingMessage,
    handleSend,
    handleSendVoice,
  } = useMessageSender({
    user,
    token,
    apiBase: API_BASE || '',
    activeChatUser,
    activeGroup,
    friendsMap,
    notify,
  });

  const {
    showSearch,
    setShowSearch,
    searchKeyword,
    setSearchKeyword,
    searchCurrentMatchIndex,
    matchedMessageIds,
    highlightedMessageId,
    jumpToMatchedMessage,
    closeSearch,
  } = useChatSearch(currentMessages);

  const {
    isScreenshotMode,
    screenshotRange,
    isAnonymousScreenshot,
    setIsAnonymousScreenshot,
    showScreenshotModal,
    setShowScreenshotModal,
    handleStartScreenshot,
    handleToggleSelectScreenshot,
    handleCancelScreenshot,
    handleGenerateScreenshot,
  } = useChatScreenshot(currentMessages);

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

  // 複製訊息
  const handleCopyMessage = (content: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    notify({ message: '訊息已複製至剪貼簿', type: 'info' });
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

  // 收回訊息
  const handleRecallMessage = (msg: Message) => {
    const msgId = msg.id;
    if (!msgId) return;
    showConfirmModal({
      title: '收回訊息',
      message: '確定要收回這則訊息嗎？所有成員將無法再看見此訊息內容。',
      danger: true,
      confirmText: '確定收回',
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
    const msgId = msg.id;
    if (!msgId || !token) return;
    showConfirmModal({
      title: '刪除對話記錄',
      message: '確定要在您的裝置上刪除此訊息嗎？此動作僅對您生效，不會影響對方。',
      danger: true,
      confirmText: '刪除',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/messages/single/${msgId}`, token);
          deleteMessageFromStore(msgId, !!activeGroup);
          notify({ message: '已為您清除此訊息', type: 'info' });
        } catch (err: any) {
          notify({ message: err.message || '刪除失敗', type: 'danger' });
        }
      },
    });
  };

  // 封鎖狀態檢查
  const isBlockedByMe = useMemo(() => {
    if (!activeChatUser) return false;
    return blockedUsers.some((u) => u.id === activeChatUser.id);
  }, [activeChatUser, blockedUsers]);

  // 群組邀請狀態判定
  const isPendingGroupInvite = useMemo(() => {
    if (!activeGroup || !user) return false;
    const myMembership = activeGroup.members?.find((m) => Number(m.user_id) === Number(user.id));
    return myMembership?.status === 'pending';
  }, [activeGroup, user]);

  // 群組被踢出檢查
  const isRemovedFromGroup = useMemo(() => {
    if (!activeGroup || !user) return false;
    const myMembership = activeGroup.members?.find((m) => Number(m.user_id) === Number(user.id));
    return myMembership?.status === 'removed';
  }, [activeGroup, user]);

  // 接受群組邀請
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
      notify({ message: '已成功加入群組！', type: 'success' });
    } catch (err: any) {
      notify({ message: err.message || '接受邀請失敗', type: 'danger' });
    }
  };

  // 拒絕群組邀請
  const handleRejectInvite = async () => {
    if (!activeGroup || !token) return;
    try {
      await apiClient.post(`/groups/${activeGroup.id}/reject`, {}, token);
      removeGroup(activeGroup.id);
      notify({ message: '已拒絕群組邀請', type: 'info' });
    } catch (err: any) {
      notify({ message: err.message || '拒絕邀請失敗', type: 'danger' });
    }
  };

  // 歷史訊息向上載入分頁
  const handleLoadMoreMessages = async () => {
    if (loadingMoreMessages || !hasMoreMessages || !token || !user || currentMessages.length === 0) return;
    const earliestMsgId = currentMessages[0]?.id;
    if (!earliestMsgId) return;

    setLoadingMoreMessages(true);
    try {
      if (activeGroup) {
        const rawMsgs = await apiClient.get<any[]>(
          `/groups/${activeGroup.id}/messages?limit=50&before_id=${earliestMsgId}`,
          token
        );
        if (Array.isArray(rawMsgs) && rawMsgs.length > 0) {
          const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
          setGroupMessages([...decryptedList, ...groupMessages]);
        }
        setHasMoreMessages(rawMsgs.length >= 50);
      } else if (activeChatUser) {
        const rawMsgs = await apiClient.get<Message[]>(
          `/messages/${activeChatUser.id}?limit=50&before_id=${earliestMsgId}`,
          token
        );
        if (Array.isArray(rawMsgs) && rawMsgs.length > 0) {
          const decryptedList = await e2eeService.decryptHistoryMessages(rawMsgs, user.id, activeChatUser.id, token);
          setMessages([...decryptedList, ...messages]);
        }
        setHasMoreMessages(rawMsgs.length >= 50);
      }
    } catch (err) {
      console.error('[ChatWindow] Load more history error:', err);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  // 渲染 IPFS 檔案卡片
  const renderIPFSFileCard = (msg: Message) => {
    if (!msg.filePayload) return null;
    return (
      <IPFSFileCard
        payload={msg.filePayload}
        iv={msg.iv}
        senderId={msg.sender_id}
        partnerId={activeChatUser?.id || 0}
        partnerPublicKeyBase64={activeChatUser?.public_key}
        groupId={activeGroup?.id}
      />
    );
  };

  // 空狀態視窗
  if (!activeChatUser && !activeGroup) {
    return (
      <div className={styles.chatWindowEmpty}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIconCircle}>
            <MessageSquare size={48} />
          </div>
          <h3>開啟私密端到端加密對話</h3>
          <p>選擇左側的好友或群組，開始安全、匿名的去中心化通訊</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatWindow}>
      {/* 群組即時通話常駐橫幅 */}
      {activeGroup && (
        <GroupCallBanner
          groupId={activeGroup.id}
          groupName={activeGroup.name}
          onOpenModal={() => useUIStore.getState().setShowGroupMembersModal(false)}
        />
      )}

      {/* 頂部導航標頭 (4 大標準對稱按鈕) */}
      <ChatHeader
        activeChatUser={activeChatUser}
        activeGroup={activeGroup}
        isUserOnline={activeChatUser ? isUserOnline(activeChatUser.id) : false}
        isStranger={!isFriend}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onStartAudioCall={() => {
          if (activeGroup) {
            useGroupCallStore.getState().startGroupCall(activeGroup.id, activeGroup.name, 'audio');
          } else if (activeChatUser) {
            if (!isFriend) {
              notify({ message: '需先新增為好友後方可發起語音通話', type: 'warning' });
              return;
            }
            startCall(activeChatUser, 'audio');
          }
        }}
        onStartVideoCall={() => {
          if (activeGroup) {
            useGroupCallStore.getState().startGroupCall(activeGroup.id, activeGroup.name, 'video');
          } else if (activeChatUser) {
            if (!isFriend) {
              notify({ message: '需先新增為好友後方可發起視訊通話', type: 'warning' });
              return;
            }
            startCall(activeChatUser, 'video');
          }
        }}
        onViewProfile={() => setSelectedProfileUser(activeChatUser)}
        onOpenGroupModal={() => {
          setActiveGroupForModal(activeGroup);
          setShowGroupMembersModal(true);
        }}
      />

      {/* 訊息即時搜尋列 */}
      {showSearch && (
        <ChatSearchBar
          keyword={searchKeyword}
          onKeywordChange={setSearchKeyword}
          matchCount={matchedMessageIds.length}
          currentIndex={searchCurrentMatchIndex}
          onPrev={() => jumpToMatchedMessage(searchCurrentMatchIndex - 1)}
          onNext={() => jumpToMatchedMessage(searchCurrentMatchIndex + 1)}
          onClose={closeSearch}
        />
      )}

      {/* 訊息滾動主列表 */}
      <MessageList
        messages={currentMessages}
        currentUserId={user?.id || 0}
        currentUser={user || undefined}
        partnerUser={activeChatUser || undefined}
        isGroup={!!activeGroup}
        groupMembersMap={groupMembersMap}
        loading={loadingMessages}
        renderIPFSFileCard={renderIPFSFileCard}
        onReaction={handleReaction}
        onViewProfile={(targetUser) => setSelectedProfileUser(targetUser)}
        onContextMenu={handleMessageContextMenu}
        onViewReactions={(msg) => setSelectedReactionMessage(msg)}
        isScreenshotMode={isScreenshotMode}
        selectedRange={screenshotRange}
        onToggleSelectScreenshot={handleToggleSelectScreenshot}
        highlightKeyword={searchKeyword}
        highlightedMessageId={highlightedMessageId}
        hasMore={hasMoreMessages}
        loadingMore={loadingMoreMessages}
        onLoadMore={handleLoadMoreMessages}
      />

      {/* 編輯訊息預覽列 */}
      {editingMessage && (
        <div className={styles.editingBanner}>
          <div className={styles.editingInfo}>
            <Edit2 size={16} color="var(--accent-color)" />
            <span>編輯訊息：{editingMessage.content}</span>
          </div>
          <button className={styles.cancelEditBtn} onClick={handleCancelEdit} title="取消編輯">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 底部輸入列 / 截圖模式工具列切換 */}
      {isScreenshotMode ? (
        <ScreenshotToolbar
          selectedCount={
            screenshotRange ? Math.max(0, screenshotRange.end - screenshotRange.start + 1) : 0
          }
          startIndex={screenshotRange?.start || 0}
          endIndex={screenshotRange?.end || 0}
          isAnonymous={isAnonymousScreenshot}
          onToggleAnonymous={() => setIsAnonymousScreenshot(!isAnonymousScreenshot)}
          onCancel={handleCancelScreenshot}
          onGenerate={handleGenerateScreenshot}
        />
      ) : isBlockedByMe ? (
        <div className={styles.blockedBanner}>
          <AlertCircle size={18} />
          <span>您已封鎖此用戶，無法傳送訊息</span>
        </div>
      ) : isPendingGroupInvite ? (
        <div className={styles.pendingInviteBanner}>
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
          onSendMessage={handleSend}
          onSendVoice={handleSendVoice}
          onStartScreenshot={() => handleStartScreenshot()}
          onOpenEmojiPicker={(x, y) => setEmojiPickerState({ x, y, isInputTarget: true })}
          isUploadingIPFS={uploading}
          disabled={false}
        />
      )}

      {/* 訊息右鍵選單 */}
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

      {/* 連續對話截圖預覽彈窗 */}
      {showScreenshotModal && screenshotRange && (
        <ChatScreenshotModal
          isOpen={showScreenshotModal}
          messages={currentMessages.slice(screenshotRange.start, screenshotRange.end + 1)}
          currentUserId={user?.id || 0}
          partnerUser={activeChatUser}
          groupName={activeGroup?.name}
          groupId={activeGroup?.id}
          isGroup={!!activeGroup}
          groupMembersMap={groupMembersMap}
          isAnonymous={isAnonymousScreenshot}
          onClose={() => {
            setShowScreenshotModal(false);
            handleCancelScreenshot();
          }}
        />
      )}

      {/* 表情反應名單詳情彈窗 */}
      {selectedReactionMessage && (
        <MessageReactionsModal
          isOpen={!!selectedReactionMessage}
          message={selectedReactionMessage}
          currentUser={user}
          partnerUser={activeChatUser}
          groupMembersMap={groupMembersMap}
          onClose={() => setSelectedReactionMessage(null)}
          onViewProfile={(targetUser) => setSelectedProfileUser(targetUser)}
        />
      )}

      {/* Emoji 表情選擇器彈窗 (支援表情 Emoji / 貼圖 Stickers / 表情貼 Custom 三大系統) */}
      {emojiPickerState && (
        <EmojiPickerPopover
          x={emojiPickerState.x}
          y={emojiPickerState.y}
          isOpen={!!emojiPickerState}
          mode={emojiPickerState.isInputTarget ? 'input' : 'reaction'}
          onSelectEmoji={(emoji) => {
            if (emojiPickerState.isInputTarget) {
              setInputText((prev) => prev + emoji);
            } else if (emojiPickerState.message?.id) {
              handleReaction(emojiPickerState.message.id, emoji);
            }
            setEmojiPickerState(null);
          }}
          onSelectSticker={(sticker) => {
            if (emojiPickerState.isInputTarget) {
              setInputText((prev) => prev + sticker.emoji);
            }
            setEmojiPickerState(null);
          }}
          onClose={() => setEmojiPickerState(null)}
        />
      )}

      {/* 群組通話主視窗 */}
      <GroupCallModal />
    </div>
  );
};
