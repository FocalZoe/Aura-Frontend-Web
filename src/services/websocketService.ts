// TEAM_006 & TEAM_014: 獨立 WebSocket 單例服務 (包含多 JSON 黏包強健解析與通話信號轉發)
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { useUIStore } from '../stores/useUIStore';
import { useCallStore } from '../stores/useCallStore';
import { apiClient, getApiBase } from './apiClient';
import { e2eeService } from './e2eeService';
import { soundEffects } from '../utils/audio';
import { notificationManager } from '../utils/notification';
import { Message, WSMessage, Group, User } from '../types';

// TEAM_014: 動態推導 WebSocket URL，若跨網/區網存取自動將 localhost/127.0.0.1 替換為當前主機 IP
const getWsBase = (): string => {
  let url = import.meta.env.VITE_WS_URL || import.meta.env.VITE_WS_BASE_URL;
  if (!url) {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `${protocol}//${host}:8080/ws`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    url = url.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
  }
  return url;
};

class WebSocketService {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private userId: number | null = null;
  private reconnectTimer: any = null;
  private isDisposed = false;

  connect(token: string, userId: number) {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) &&
      this.token === token &&
      this.userId === userId
    ) {
      return;
    }

    this.token = token;
    this.userId = userId;
    this.isDisposed = false;

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.socket = new WebSocket(`${getWsBase()}?token=${token}`);

    this.socket.onopen = () => {
      console.log('[WebSocketService] Connected');
      this.fetchOnlineUsers();
    };

    this.socket.onmessage = async (event: MessageEvent) => {
      try {
        const raw = String(event.data).trim();
        if (!raw) return;

        // 處理由於 TCP 封包或 Go 傳輸緊黏之單個或多個 JSON 訊息
        const rawChunks = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
        for (const chunk of rawChunks) {
          try {
            const data: WSMessage | Message = JSON.parse(chunk);
            await this.handleMessage(data);
          } catch (e) {
            // 若 JSON 物件直接相黏 (如 }{" )
            if (chunk.includes('}{')) {
              const fixedChunks = chunk.replace(/}\s*{/g, '}\n{').split('\n');
              for (const fc of fixedChunks) {
                if (!fc.trim()) continue;
                try {
                  const data = JSON.parse(fc);
                  await this.handleMessage(data);
                } catch (err2) {
                  console.error('[WebSocketService] Split parse error:', err2, fc);
                }
              }
            } else {
              console.error('[WebSocketService] Chunk parse error:', e, chunk);
            }
          }
        }
      } catch (err) {
        console.error('[WebSocketService] Message parse error:', err);
      }
    };

    this.socket.onclose = () => {
      console.log('[WebSocketService] Disconnected');
      this.socket = null;
      if (!this.isDisposed) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WebSocketService] Error:', err);
    };
  }

  disconnect() {
    this.isDisposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.token = null;
    this.userId = null;
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocketService] Cannot send message: socket not open');
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.token && this.userId && !this.isDisposed) {
        console.log('[WebSocketService] Reconnecting...');
        this.connect(this.token, this.userId);
      }
    }, 3000);
  }

  private async fetchOnlineUsers() {
    if (!this.token) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/online`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (res.ok) {
        const onlineIds: number[] = await res.json();
        useChatStore.getState().setOnlineUsers(onlineIds);
      }
    } catch (err) {
      console.error('[WebSocketService] fetchOnlineUsers failed:', err);
    }
  }

  private async handleMessage(data: any) {
    const chatStore = useChatStore.getState();
    const activeToken = this.token;

    if (data.type === 'group_update') {
      const gMsg = data as any;
      if (activeToken) {
        if (gMsg.action === 'group_delete') {
          chatStore.removeGroup(gMsg.group_id);
        } else {
          apiClient
            .get<Group[]>('/groups', activeToken)
            .then((groupsData) => {
              if (Array.isArray(groupsData)) {
                chatStore.setGroups(groupsData);
              }
            })
            .catch(() => {});

          const activeGroup = chatStore.activeGroup;
          if (activeGroup && Number(activeGroup.id) === Number(gMsg.group_id)) {
            apiClient
              .get<Group>(`/groups/${activeGroup.id}`, activeToken)
              .then((updatedGroup) => {
                chatStore.updateGroupInStore(updatedGroup);
              })
              .catch(() => {
                chatStore.updateGroupInStore({ ...activeGroup, is_removed: true });
              });
          }

          if (gMsg.action === 'member_add') {
            soundEffects.playFriendRequestSound();
            if (notificationManager.isWindowUnfocused()) {
              notificationManager.sendNotification('Focal Aura 群組通知', '您已被加入一個新群組！');
            }
          }
        }
      }
    } else if (data.type === 'friend_update' || data.type === 'key_update' || data.type === 'user_update' || data.type === 'block_update') {
      if (data.type === 'user_update') {
        const uMsg = data as any;
        if (uMsg.user_id) {
          chatStore.updateUserInStore(uMsg.user_id, {
            account_id: uMsg.account_id,
            display_name: uMsg.display_name,
          });
        }
      }

      if (activeToken) {
        apiClient.get<User[]>('/friends', activeToken)
          .then((friendsData) => { if (Array.isArray(friendsData)) chatStore.setFriends(friendsData); })
          .catch(() => {});
        apiClient.get<User[]>('/friends/pending', activeToken)
          .then((pendingData) => { if (Array.isArray(pendingData)) chatStore.setPendingRequests(pendingData); })
          .catch(() => {});
        // TEAM_015: 即時同步拉取最新黑名單
        apiClient.get<User[]>('/blocks', activeToken)
          .then((blockedData) => { if (Array.isArray(blockedData)) chatStore.setBlockedUsers(blockedData); })
          .catch(() => {});
      }

      if (data.type === 'friend_update') {
        const friendMsg = data as any;
        const isRecipient = this.userId && Number(friendMsg.to) === Number(this.userId);

        if (friendMsg.action === 'request' && isRecipient) {
          if (notificationManager.isWindowUnfocused()) {
            notificationManager.sendNotification('Focal Aura 好友邀請', '您收到一則新的好友邀請！');
            document.title = '💬 (好友邀請) Focal Aura';
          } else {
            soundEffects.playFriendRequestSound();
          }
        } else if (friendMsg.action === 'accept' && isRecipient) {
          if (notificationManager.isWindowUnfocused()) {
            notificationManager.sendNotification('Focal Aura 好友通知', '對方已接受您的好友邀請！');
            document.title = '💬 (好友接受) Focal Aura';
          } else {
            soundEffects.playFriendRequestSound();
          }
        }
      }
    } else if (data.type === 'status') {
      const { user_id, online } = data as any;
      const current = chatStore.onlineUsers;
      if (online) {
        if (!current.includes(user_id)) {
          chatStore.setOnlineUsers([...current, user_id]);
        }
      } else {
        chatStore.setOnlineUsers(current.filter((id) => id !== user_id));
      }
    } else if (data.type === 'error') {
      const errData = data as any;
      if (errData.content) {
        useUIStore.getState().showConfirmModal({
          title: '系統提示',
          message: errData.content,
          danger: false,
          confirmText: '瞭解',
          onConfirm: () => {},
        });
      }
    } else if (data.type === 'group_message') {
      const groupMsg = data as any;
      const curGroup = chatStore.activeGroup;
      const decryptedGroupMsg = await e2eeService.decryptSingleGroupMessage(groupMsg, groupMsg.group_id);

      if (curGroup && curGroup.id === groupMsg.group_id) {
        chatStore.addGroupMessage(decryptedGroupMsg);
      } else {
        if (groupMsg.sender_id !== this.userId) {
          chatStore.incrementGroupUnread(groupMsg.group_id);
        }
      }

      if (groupMsg.sender_id !== this.userId) {
        if (notificationManager.isWindowUnfocused()) {
          notificationManager.sendNotification('Focal Aura 群組新訊息', '您收到一則群組加密新訊息');
          document.title = '💬 (群組新訊息) Focal Aura';
        } else {
          if (!curGroup || curGroup.id !== groupMsg.group_id) {
            soundEffects.playMessageSound();
          }
        }
      }
    } else if (data.type === 'message') {
      const msg = data as Message;
      const curActive = chatStore.activeChatUser;

      if (!this.userId || !this.token) return;

      const decryptedMsg = await e2eeService.decryptSingleMessage(msg, this.userId, this.token);
      const receiverId = decryptedMsg.receiver_id || decryptedMsg.to;
      const senderId = decryptedMsg.sender_id;

      if (receiverId && senderId) {
        const isIncoming = senderId !== this.userId;

        if (
          curActive &&
          ((senderId === this.userId && receiverId === curActive.id) ||
            (senderId === curActive.id && receiverId === this.userId))
        ) {
          chatStore.addMessage({ ...decryptedMsg, receiver_id: receiverId });
        }

        if (isIncoming) {
          if (!curActive || curActive.id !== senderId) {
            chatStore.incrementUnread(senderId);
          }

          if (notificationManager.isWindowUnfocused()) {
            notificationManager.sendNotification('Focal Aura 新訊息', '您收到了一則加密新訊息');
            document.title = '💬 (新訊息) Focal Aura';
          } else {
            if (!curActive || curActive.id !== senderId) {
              soundEffects.playMessageSound();
            }
          }
        }
      }
    } else if (
      data.type === 'call_request' ||
      data.type === 'call_response' ||
      data.type === 'webrtc_offer' ||
      data.type === 'webrtc_answer' ||
      data.type === 'webrtc_candidate' ||
      data.type === 'webrtc_media_toggle' ||
      data.type === 'call_hangup' ||
      data.type === 'busy_incoming_call'
    ) {
      // TEAM_014: 處理即時影音通話信號轉發至 useCallStore
      const callStore = useCallStore.getState();

      if (data.type === 'call_request') {
        const callerId = (data as any).sender_id;
        const callType = (data as any).content === 'video' ? 'video' : 'audio';

        if (notificationManager.isWindowUnfocused()) {
          notificationManager.sendNotification('Focal Aura 來電通知', `您收到一則${callType === 'video' ? '視訊' : '語音'}來電！`);
          document.title = '📞 (來電中) Focal Aura';
        }

        const friend = chatStore.friends.find((f) => Number(f.id) === Number(callerId));
        const callerName = friend ? (friend.display_name || friend.account_id || `User ${callerId}`) : `User ${callerId}`;
        const callerAvatar = friend?.avatar;

        callStore.handleIncomingCall(
          { id: callerId, name: callerName, avatar: callerAvatar },
          callType
        );
      } else if (data.type === 'call_response') {
        callStore.onReceiveResponse((data as any).content, (data as any).sender_id);
      } else if (data.type === 'webrtc_offer') {
        callStore.onReceiveOffer((data as any).content, (data as any).sender_id);
      } else if (data.type === 'webrtc_answer') {
        callStore.onReceiveAnswer((data as any).content);
      } else if (data.type === 'webrtc_candidate') {
        callStore.onReceiveCandidate((data as any).content);
      } else if (data.type === 'webrtc_media_toggle') {
        callStore.onReceiveMediaToggle((data as any).content);
      } else if (data.type === 'call_hangup') {
        callStore.onReceiveHangup();
      } else if (data.type === 'busy_incoming_call') {
        callStore.onReceiveBusyNotification((data as any).sender_id, (data as any).content);
      }
    }
  }
}

export const websocketService = new WebSocketService();
