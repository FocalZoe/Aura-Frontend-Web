// TEAM_006: SocketContext 薄包裝適配器 (向下相容既有組件，底層由 websocketService & Zustand 驅動)
import React, { createContext, useEffect, useContext, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { Message, User, SocketContextType } from '../types';
import { useChatStore } from '../stores/useChatStore';
import { websocketService } from '../services/websocketService';
import { e2eeService } from '../services/e2eeService';
import { apiClient } from '../services/apiClient';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, encryptMessage } from '../utils/crypto';

export const SocketContext = createContext<SocketContextType>({} as SocketContextType);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { token, user } = useContext(AuthContext);

  const {
    activeChatUser,
    setActiveChatUser,
    messages,
    setMessages,
    unreadCounts,
    onlineUsers,
    friendsMap,
    incomingStrangerUsers,
    sentStrangerUsers,
    markChatAsRead,
    addStrangerUser,
    setFriendsMap,
    setIncomingStrangerUsers,
    setSentStrangerUsers,
  } = useChatStore();

  useEffect(() => {
    if (token && user) {
      websocketService.connect(token, user.id);
      fetchFriendsMap();
      fetchStrangerLists();
    } else {
      websocketService.disconnect();
      e2eeService.clearCache();
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (activeChatUser && token && user) {
      loadChatHistory(activeChatUser.id);
    }
  }, [activeChatUser?.id]);

  const fetchFriendsMap = async () => {
    if (!token) return;
    try {
      const data = await apiClient.get<User[]>('/friends', token);
      if (Array.isArray(data)) {
        const map: Record<number, string> = { ...friendsMap };
        data.forEach((f) => {
          if (f.public_key) map[f.id] = f.public_key;
        });
        setFriendsMap(map);
      }
    } catch (e) {
      console.error('[SocketContext] fetchFriendsMap failed', e);
    }
  };

  const fetchStrangerLists = async () => {
    if (!token) return;
    try {
      const [inc, sent] = await Promise.all([
        apiClient.get<User[]>('/messages/strangers/incoming', token),
        apiClient.get<User[]>('/messages/strangers/sent', token),
      ]);
      if (Array.isArray(inc)) setIncomingStrangerUsers(inc);
      if (Array.isArray(sent)) setSentStrangerUsers(sent);
    } catch (e) {
      console.error('[SocketContext] fetchStrangerLists failed', e);
    }
  };

  const loadChatHistory = async (partnerId: number) => {
    if (!token || !user) return;
    try {
      const data = await apiClient.get<Message[]>(`/messages/${partnerId}`, token);
      if (Array.isArray(data)) {
        const decryptedList = await e2eeService.decryptHistoryMessages(data, user.id, partnerId, token);
        setMessages(decryptedList);
      }
    } catch (e) {
      console.error('[SocketContext] loadChatHistory failed', e);
    }
  };

  const fetchUserPublicKey = async (userId: number): Promise<string | undefined> => {
    if (!token) return undefined;
    return e2eeService.fetchUserPublicKey(userId, token);
  };

  const sendChatMessage = async (toUserId: number, partnerPublicKeyBase64: string | undefined, content: string) => {
    if (!user || !token) return;
    try {
      let publicKeyBase64: string | undefined = partnerPublicKeyBase64 || friendsMap[toUserId];
      if (!publicKeyBase64) {
        publicKeyBase64 = await fetchUserPublicKey(toUserId);
      }

      if (!publicKeyBase64) {
        throw new Error('對方尚未建立密碼學金鑰對');
      }

      const privateKey = await getLocalPrivateKey(user.id);
      if (!privateKey) {
        throw new Error('請先輸入 PIN 碼解鎖私鑰');
      }

      const partnerPublicKey = await importPublicKey(publicKeyBase64);
      const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);

      const { ciphertext, iv } = await encryptMessage(sharedKey, content);

      const payload = {
        type: 'message',
        to: toUserId,
        content: ciphertext,
        iv,
      };

      websocketService.send(payload);

      const myMessage: Message = {
        id: Date.now(),
        sender_id: user.id,
        receiver_id: toUserId,
        to: toUserId,
        content,
        iv,
        timestamp: new Date().toISOString(),
        decrypted: true,
      };

      useChatStore.getState().addMessage(myMessage);
    } catch (err: any) {
      console.error('發送訊息失敗:', err);
      throw err;
    }
  };

  const isUserOnline = (userId: number) => onlineUsers.includes(userId);

  return (
    <SocketContext.Provider
      value={{
        socket: null,
        onlineUsers,
        messages,
        setMessages: (messagesOrFn: any) => setMessages(messagesOrFn),
        sendChatMessage,
        isUserOnline,
        loadChatHistory,
        fetchFriendsMap,
        fetchUserPublicKey,
        activeChatUser,
        setActiveChatUser: (val: any) => setActiveChatUser(typeof val === 'function' ? val(activeChatUser) : val),
        unreadCounts,
        markChatAsRead,
        strangers: [],
        addStrangerUser,
        incomingStrangerUsers,
        sentStrangerUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
