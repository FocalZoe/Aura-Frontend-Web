import React, { useContext, useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import { websocketService } from '../services/websocketService';
import { e2eeService } from '../services/e2eeService';
import { apiClient, getApiBase } from '../services/apiClient';
import { MessageSquare, File, Download, Loader2, X, AlertCircle } from 'lucide-react';
import { IPFSFilePayload, Message } from '../types';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, encryptFileBuffer, decryptFileBuffer } from '../utils/crypto';
import { uploadToIPFS, fetchFromIPFS } from '../utils/ipfs';

import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';
import { IPFSFileCard } from './chat/IPFSFileCard';
import styles from './ChatWindow.module.css';



import { useCallStore } from '../stores/useCallStore';

export const ChatWindow: React.FC = () => {
  const startCall = useCallStore((s) => s.startCall);
  const { user, token, API_BASE } = useContext(AuthContext);

  const {
    activeChatUser,
    sendChatMessage,
    isUserOnline,
    addStrangerUser,
  } = useContext(SocketContext);

  const {
    activeGroup,
    groupMessages,
    setGroupMessages,
    addGroupMessage,
    messages,
    blockedUsers,
    updateGroupInStore,
    removeGroup,
  } = useChatStore();

  const { setShowGroupMembersModal, setActiveGroupForModal } = useUIStore();
  const { notify } = useNotification();
  const [inputText, setInputText] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [isFriend, setIsFriend] = useState<boolean>(true);

  // TEAM_009: 判斷當前一對一對象是否已被自己封鎖
  const isBlockedByMe = !!(
    activeChatUser &&
    blockedUsers.some((b) => Number(b.id) === Number(activeChatUser.id))
  );

  // TEAM_009: 判斷當前使用者在群組中的 status (accepted, pending, removed)
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

  useEffect(() => {
    const fetchGroupMessages = async () => {
      if (activeGroup && token) {
        try {
          const rawMsgs = await apiClient.get<any[]>(`/groups/${activeGroup.id}/messages`, token);
          const decryptedList = await e2eeService.decryptGroupMessages(rawMsgs, activeGroup.id);
          setGroupMessages(decryptedList);
        } catch (err) {
          console.error('獲取群組歷史訊息失敗:', err);
        }
      }
    };

    fetchGroupMessages();
  }, [activeGroup?.id, token]);

  // TEAM_013: 由 Zustand Store 的 friends 進行純淨響應式訂閱，消除重複 HTTP 請求與 DOM Event 監聽
  const friends = useChatStore((s) => s.friends);

  useEffect(() => {
    if (activeChatUser) {
      setIsFriend(friends.some((f) => f.id === activeChatUser.id));
    }
  }, [activeChatUser, friends]);

  // TEAM_009: 同意群組邀請
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

  // TEAM_009: 拒絕群組邀請
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
        await sendChatMessage(activeChatUser.id, activeChatUser.public_key, inputText.trim());
        setInputText('');
        if (!isFriend) {
          addStrangerUser(activeChatUser, true);
        }
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
      await sendChatMessage(activeChatUser.id, activeChatUser.public_key, ipfsMessageContent);
      notify({ message: '檔案已安全加密傳送！', type: 'success' });
    } catch (err: any) {
      console.error('檔案傳送失敗:', err);
      notify({ message: err.message || '檔案傳送失敗', type: 'danger' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!activeChatUser && !activeGroup) {
    return (
      <div className={styles.chatWindow}>
        <div className={styles.chatEmpty}>
          <MessageSquare size={48} strokeWidth={1.5} />
          <h3>點擊聯絡人或群組開始聊天</h3>
          <p>選擇左側的好友、群組或陌生人，即可開始點對點加密通訊。</p>
        </div>
      </div>
    );
  }

  const currentMessages: Message[] = activeGroup
    ? groupMessages.map((gm) => ({
        id: gm.id,
        sender_id: gm.sender_id,
        content: gm.content,
        iv: gm.iv,
        timestamp: gm.timestamp,
        decrypted: gm.decrypted,
        error: gm.error,
      }))
    : messages;

  return (
    <div className={styles.chatWindow}>
      <ChatHeader
        activeChatUser={activeChatUser}
        activeGroup={activeGroup}
        isUserOnline={activeChatUser ? isUserOnline(activeChatUser.id) : false}
        isStranger={activeChatUser ? !isFriend : false}
        onOpenGroupModal={() => {
          if (activeGroup) {
            setActiveGroupForModal(activeGroup);
            setShowGroupMembersModal(true);
          }
        }}
        onStartAudioCall={
          activeChatUser
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
          activeChatUser
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
        partnerUser={activeChatUser || undefined}
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

      {/* TEAM_009: 聊天輸入區域狀態判定（已封鎖用戶 / 待同意邀請 / 被移出群組 / 正常輸入框） */}
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
          onSendMessage={handleSend}
          onFileUpload={handleFileUpload}
          isUploadingIPFS={uploading}
          disabled={activeChatUser ? !activeChatUser.public_key : false}
        />
      )}
    </div>
  );
};
