import { create } from 'zustand';
import { Message, User, Group, GroupMessage } from '../types';

interface ChatState {
  activeChatUser: User | null;
  activeGroup: Group | null;
  messages: Message[];
  groupMessages: GroupMessage[];
  groups: Group[];
  blockedUsers: User[];
  unreadCounts: Record<number, number>;
  groupUnreadCounts: Record<number, number>;
  onlineUsers: number[];
  friends: User[];
  pendingRequests: User[];
  incomingStrangerUsers: User[];
  sentStrangerUsers: User[];
  friendsMap: Record<number, string>;

  setActiveChatUser: (user: User | null) => void;
  setActiveGroup: (group: Group | null) => void;
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  removeGroup: (groupId: number) => void;
  updateGroupInStore: (groupOrId: Group | number, group?: Group) => void;
  setGroupMessages: (messages: GroupMessage[] | ((prev: GroupMessage[]) => GroupMessage[])) => void;
  addGroupMessage: (message: GroupMessage) => void;
  setBlockedUsers: (users: User[]) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (message: Message) => void;
  markChatAsRead: (userId: number) => void;
  incrementUnread: (userId: number) => void;
  markGroupAsRead: (groupId: number) => void;
  incrementGroupUnread: (groupId: number) => void;
  setOnlineUsers: (users: number[]) => void;
  setFriends: (friends: User[]) => void;
  setPendingRequests: (requests: User[]) => void;
  setIncomingStrangerUsers: (users: User[]) => void;
  setSentStrangerUsers: (users: User[]) => void;
  setFriendsMap: (map: Record<number, string>) => void;
  addStrangerUser: (stranger: User, isSent?: boolean) => void;
  removeConversation: (id: number, isGroup?: boolean) => void;
  updateUserInStore: (userId: number, fields: Partial<User>) => void;
}

export const isOptimisticId = (id: any): boolean => !id || typeof id !== 'number' || id > 1000000000000;

export const useChatStore = create<ChatState>((set) => ({
  activeChatUser: null,
  activeGroup: null,
  messages: [],
  groupMessages: [],
  groups: [],
  blockedUsers: [],
  unreadCounts: {},
  groupUnreadCounts: {},
  onlineUsers: [],
  friends: [],
  pendingRequests: [],
  incomingStrangerUsers: [],
  sentStrangerUsers: [],
  friendsMap: {},

  setActiveChatUser: (user) =>
    set((state) => {
      let unreadCounts = state.unreadCounts;
      if (user && unreadCounts[user.id]) {
        const next = { ...unreadCounts };
        delete next[user.id];
        unreadCounts = next;
      }
      return {
        activeChatUser: user,
        activeGroup: null,
        messages: user ? state.messages : [],
        unreadCounts,
      };
    }),

  setActiveGroup: (group) =>
    set((state) => {
      let groupUnreadCounts = state.groupUnreadCounts;
      if (group && groupUnreadCounts[group.id]) {
        const next = { ...groupUnreadCounts };
        delete next[group.id];
        groupUnreadCounts = next;
      }
      const isSameGroup = group && state.activeGroup && state.activeGroup.id === group.id;
      return {
        activeGroup: group,
        activeChatUser: null,
        groupMessages: isSameGroup ? state.groupMessages : [],
        groupUnreadCounts,
      };
    }),

  setGroups: (groups) =>
    set((state) => {
      const normalizedGroups = groups.map((g) => ({
        ...g,
        id: Number(g.id) || g.id,
        owner_id: Number(g.owner_id) || g.owner_id,
        members: g.members?.map((m) => ({
          ...m,
          id: Number(m.id) || m.id,
          group_id: Number(m.group_id) || m.group_id,
          user_id: Number(m.user_id) || m.user_id,
        })),
      }));

      let updatedActive = state.activeGroup;
      if (state.activeGroup) {
        const activeId = Number(state.activeGroup.id);
        const found = normalizedGroups.find((g) => Number(g.id) === activeId);
        if (found) {
          updatedActive = { ...state.activeGroup, ...found, is_removed: false };
        } else {
          updatedActive = { ...state.activeGroup, is_removed: true };
        }
      }
      return { groups: normalizedGroups, activeGroup: updatedActive };
    }),

  addGroup: (group) =>
    set((state) => ({
      groups: [group, ...state.groups.filter((g) => Number(g.id) !== Number(group.id))],
    })),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => Number(g.id) !== Number(groupId)),
      activeGroup: state.activeGroup && Number(state.activeGroup.id) === Number(groupId) ? null : state.activeGroup,
    })),

  updateGroupInStore: (groupOrId, updatedGroup) =>
    set((state) => {
      const groupObj = typeof groupOrId === 'object' ? groupOrId : updatedGroup!;
      const id = typeof groupOrId === 'number' ? groupOrId : Number(groupOrId?.id);
      if (!groupObj || !id) return state;

      const normalizedObj = {
        ...groupObj,
        id: Number(groupObj.id) || groupObj.id,
        owner_id: groupObj.owner_id ? Number(groupObj.owner_id) : groupObj.owner_id,
        members: groupObj.members?.map((m: any) => ({
          ...m,
          id: Number(m.id) || m.id,
          group_id: Number(m.group_id) || m.group_id,
          user_id: Number(m.user_id) || m.user_id,
        })),
      };

      return {
        groups: state.groups.map((g) => (Number(g.id) === id ? { ...g, ...normalizedObj } : g)),
        activeGroup:
          state.activeGroup && Number(state.activeGroup.id) === id
            ? { ...state.activeGroup, ...normalizedObj }
            : state.activeGroup,
      };
    }),

  setGroupMessages: (messagesOrFn) =>
    set((state) => ({
      groupMessages:
        typeof messagesOrFn === 'function' ? messagesOrFn(state.groupMessages) : messagesOrFn,
    })),

  addGroupMessage: (message) =>
    set((state) => {
      const normalizedMsg: GroupMessage = {
        ...message,
        sender_id: Number(message.sender_id) || message.sender_id,
        group_id: Number(message.group_id) || message.group_id,
      };

      // 1. 若為正式 DB ID 訊息
      if (normalizedMsg.id && !isOptimisticId(normalizedMsg.id)) {
        const dbIdIndex = state.groupMessages.findIndex(
          (m) => m.id && Number(m.id) === Number(normalizedMsg.id)
        );
        if (dbIdIndex >= 0) {
          const updated = [...state.groupMessages];
          updated[dbIdIndex] = { ...updated[dbIdIndex], ...normalizedMsg };
          return { groupMessages: updated };
        }

        // 搜尋當前列表中對應的「樂觀預覽訊息」並蓋換
        const optIndex = state.groupMessages.findIndex(
          (m) =>
            isOptimisticId(m.id) &&
            Number(m.sender_id) === Number(normalizedMsg.sender_id) &&
            Number(m.group_id) === Number(normalizedMsg.group_id) &&
            m.content === normalizedMsg.content
        );
        if (optIndex >= 0) {
          const updated = [...state.groupMessages];
          updated[optIndex] = { ...updated[optIndex], ...normalizedMsg };
          return { groupMessages: updated };
        }

        return { groupMessages: [...state.groupMessages, normalizedMsg] };
      }

      // 2. 若為樂觀預覽訊息
      const optIdIndex = state.groupMessages.findIndex(
        (m) => m.id && Number(m.id) === Number(normalizedMsg.id)
      );
      if (optIdIndex >= 0) {
        return state;
      }

      return { groupMessages: [...state.groupMessages, normalizedMsg] };
    }),

  setBlockedUsers: (users) => set({ blockedUsers: users }),

  setMessages: (messagesOrFn) =>
    set((state) => ({
      messages:
        typeof messagesOrFn === 'function' ? messagesOrFn(state.messages) : messagesOrFn,
    })),

  addMessage: (message) =>
    set((state) => {
      const normalizedMsg: Message = {
        ...message,
        sender_id: Number(message.sender_id) || message.sender_id,
        receiver_id: message.receiver_id ? Number(message.receiver_id) : message.receiver_id,
        to: message.to ? Number(message.to) : message.to,
      };

      if (normalizedMsg.id && !isOptimisticId(normalizedMsg.id)) {
        const dbIdIndex = state.messages.findIndex(
          (m) => m.id && Number(m.id) === Number(normalizedMsg.id)
        );
        if (dbIdIndex >= 0) {
          const updated = [...state.messages];
          updated[dbIdIndex] = { ...updated[dbIdIndex], ...normalizedMsg };
          return { messages: updated };
        }

        const optIndex = state.messages.findIndex(
          (m) =>
            isOptimisticId(m.id) &&
            Number(m.sender_id) === Number(normalizedMsg.sender_id) &&
            (Number(m.receiver_id) === Number(normalizedMsg.receiver_id) || Number(m.to) === Number(normalizedMsg.to)) &&
            m.content === normalizedMsg.content
        );
        if (optIndex >= 0) {
          const updated = [...state.messages];
          updated[optIndex] = { ...updated[optIndex], ...normalizedMsg };
          return { messages: updated };
        }

        return { messages: [...state.messages, normalizedMsg] };
      }

      const optIdIndex = state.messages.findIndex(
        (m) => m.id && Number(m.id) === Number(normalizedMsg.id)
      );
      if (optIdIndex >= 0) {
        return state;
      }

      return { messages: [...state.messages, normalizedMsg] };
    }),

  markChatAsRead: (userId) =>
    set((state) => {
      if (!state.unreadCounts[userId]) return state;
      const next = { ...state.unreadCounts };
      delete next[userId];
      return { unreadCounts: next };
    }),

  incrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: (state.unreadCounts[userId] || 0) + 1,
      },
    })),

  markGroupAsRead: (groupId) =>
    set((state) => {
      if (!state.groupUnreadCounts[groupId]) return state;
      const next = { ...state.groupUnreadCounts };
      delete next[groupId];
      return { groupUnreadCounts: next };
    }),

  incrementGroupUnread: (groupId) =>
    set((state) => ({
      groupUnreadCounts: {
        ...state.groupUnreadCounts,
        [groupId]: (state.groupUnreadCounts[groupId] || 0) + 1,
      },
    })),

  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setFriends: (friends) => set({ friends }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setIncomingStrangerUsers: (users) => set({ incomingStrangerUsers: users }),
  setSentStrangerUsers: (users) => set({ sentStrangerUsers: users }),
  setFriendsMap: (map) => set({ friendsMap: map }),

  addStrangerUser: (stranger, isSent = true) =>
    set((state) => {
      if (isSent) {
        const sentExists = state.sentStrangerUsers.some((s) => s.id === stranger.id);
        const nextSent = sentExists ? state.sentStrangerUsers : [...state.sentStrangerUsers, stranger];
        const nextIncoming = state.incomingStrangerUsers.filter((s) => s.id !== stranger.id);
        return { sentStrangerUsers: nextSent, incomingStrangerUsers: nextIncoming };
      } else {
        const incomingExists = state.incomingStrangerUsers.some((s) => s.id === stranger.id);
        const nextIncoming = incomingExists ? state.incomingStrangerUsers : [...state.incomingStrangerUsers, stranger];
        return { incomingStrangerUsers: nextIncoming };
      }
    }),

  removeConversation: (id, isGroup = false) =>
    set((state) => {
      if (isGroup) {
        return {
          groups: state.groups.filter((g) => g.id !== id),
          activeGroup: state.activeGroup?.id === id ? null : state.activeGroup,
          groupMessages: state.activeGroup?.id === id ? [] : state.groupMessages,
        };
      } else {
        return {
          friends: state.friends.filter((f) => f.id !== id),
          sentStrangerUsers: state.sentStrangerUsers.filter((s) => s.id !== id),
          incomingStrangerUsers: state.incomingStrangerUsers.filter((s) => s.id !== id),
          activeChatUser: state.activeChatUser?.id === id ? null : state.activeChatUser,
          messages: state.activeChatUser?.id === id ? [] : state.messages,
        };
      }
    }),

  updateUserInStore: (userId, fields) =>
    set((state) => ({
      friends: state.friends.map((f) => (f.id === userId ? { ...f, ...fields } : f)),
      activeChatUser:
        state.activeChatUser?.id === userId
          ? { ...state.activeChatUser, ...fields }
          : state.activeChatUser,
      incomingStrangerUsers: state.incomingStrangerUsers.map((u) =>
        u.id === userId ? { ...u, ...fields } : u
      ),
      sentStrangerUsers: state.sentStrangerUsers.map((u) =>
        u.id === userId ? { ...u, ...fields } : u
      ),
    })),
}));

// Context: [標題通知] 計算未讀訊息與好友邀請總數，自動同步網頁標題 Aura (<通知數量>)
export const computeTotalNotifications = (state: ChatState): number => {
  const directUnread = Object.values(state.unreadCounts || {}).reduce((acc, count) => acc + (Number(count) || 0), 0);
  const groupUnread = Object.values(state.groupUnreadCounts || {}).reduce((acc, count) => acc + (Number(count) || 0), 0);
  const pendingCount = (state.pendingRequests || []).length;
  return directUnread + groupUnread + pendingCount;
};

if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => {
    const total = computeTotalNotifications(state);
    if (total > 0) {
      document.title = `Aura (${total})`;
    } else {
      document.title = 'Aura';
    }
  });
}
