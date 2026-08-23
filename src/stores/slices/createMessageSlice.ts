// Context: [訊息領域 Slice] 管理私聊與群聊訊息佇列、未讀計數、表情反應、編輯與收回

import { StateCreator } from 'zustand';
import { Message, GroupMessage } from '../../types';

export const isOptimisticId = (id: any): boolean => !id || typeof id !== 'number' || id > 1000000000000;

export interface MessageSlice {
  messages: Message[];
  groupMessages: GroupMessage[];
  unreadCounts: Record<number, number>;
  groupUnreadCounts: Record<number, number>;

  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (message: Message) => void;
  setGroupMessages: (messages: GroupMessage[] | ((prev: GroupMessage[]) => GroupMessage[])) => void;
  addGroupMessage: (message: GroupMessage) => void;
  markChatAsRead: (userId: number) => void;
  incrementUnread: (userId: number) => void;
  markGroupAsRead: (groupId: number) => void;
  incrementGroupUnread: (groupId: number) => void;
  removeConversation: (id: number, isGroup?: boolean) => void;
  updateMessageReactions: (messageId: number, isGroup: boolean, reactions: any[]) => void;
  editMessageInStore: (messageId: number, isGroup: boolean, content: string, iv?: string, editedAt?: string) => void;
  recallMessageInStore: (messageId: number, isGroup: boolean) => void;
  deleteMessageFromStore: (messageId: number, isGroup: boolean) => void;
}

export const createMessageSlice: StateCreator<any, [], [], MessageSlice> = (set, get) => ({
  messages: [],
  groupMessages: [],
  unreadCounts: {},
  groupUnreadCounts: {},

  setMessages: (messagesOrUpdater) =>
    set((state: any) => ({
      messages: typeof messagesOrUpdater === 'function' ? messagesOrUpdater(state.messages) : messagesOrUpdater,
    })),

  addMessage: (message) =>
    set((state: any) => {
      const existingIdx = state.messages.findIndex(
        (m: Message) =>
          (m.id === message.id) ||
          (isOptimisticId(m.id) &&
            !isOptimisticId(message.id) &&
            m.sender_id === message.sender_id &&
            m.content === message.content)
      );

      if (existingIdx !== -1) {
        const next = [...state.messages];
        next[existingIdx] = { ...next[existingIdx], ...message };
        return { messages: next };
      }
      return { messages: [...state.messages, message] };
    }),

  setGroupMessages: (messagesOrUpdater) =>
    set((state: any) => ({
      groupMessages:
        typeof messagesOrUpdater === 'function' ? messagesOrUpdater(state.groupMessages) : messagesOrUpdater,
    })),

  addGroupMessage: (message) =>
    set((state: any) => {
      const existingIdx = state.groupMessages.findIndex(
        (m: GroupMessage) =>
          (m.id === message.id) ||
          (isOptimisticId(m.id) &&
            !isOptimisticId(message.id) &&
            m.sender_id === message.sender_id &&
            m.content === message.content)
      );

      if (existingIdx !== -1) {
        const next = [...state.groupMessages];
        next[existingIdx] = { ...next[existingIdx], ...message };
        return { groupMessages: next };
      }
      return { groupMessages: [...state.groupMessages, message] };
    }),

  markChatAsRead: (userId) =>
    set((state: any) => {
      if (!state.unreadCounts[userId]) return state;
      const next = { ...state.unreadCounts };
      delete next[userId];
      return { unreadCounts: next };
    }),

  incrementUnread: (userId) =>
    set((state: any) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: (state.unreadCounts[userId] || 0) + 1,
      },
    })),

  markGroupAsRead: (groupId) =>
    set((state: any) => {
      if (!state.groupUnreadCounts[groupId]) return state;
      const next = { ...state.groupUnreadCounts };
      delete next[groupId];
      return { groupUnreadCounts: next };
    }),

  incrementGroupUnread: (groupId) =>
    set((state: any) => ({
      groupUnreadCounts: {
        ...state.groupUnreadCounts,
        [groupId]: (state.groupUnreadCounts[groupId] || 0) + 1,
      },
    })),

  removeConversation: (id, isGroup = false) =>
    set((state: any) => {
      if (isGroup) {
        return {
          groupMessages: state.activeGroup?.id === id ? [] : state.groupMessages,
          groups: state.groups.filter((g: any) => Number(g.id) !== Number(id)),
          activeGroup: state.activeGroup?.id === id ? null : state.activeGroup,
        };
      }
      return {
        messages: state.activeChatUser?.id === id ? [] : state.messages,
        activeChatUser: state.activeChatUser?.id === id ? null : state.activeChatUser,
      };
    }),

  updateMessageReactions: (messageId, isGroup, reactions) =>
    set((state: any) => {
      if (isGroup) {
        return {
          groupMessages: state.groupMessages.map((m: GroupMessage) =>
            m.id === messageId ? { ...m, reactions } : m
          ),
        };
      }
      return {
        messages: state.messages.map((m: Message) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      };
    }),

  editMessageInStore: (messageId, isGroup, content, iv, editedAt) =>
    set((state: any) => {
      const now = editedAt || new Date().toISOString();
      if (isGroup) {
        return {
          groupMessages: state.groupMessages.map((m: GroupMessage) =>
            m.id === messageId
              ? {
                  ...m,
                  content,
                  iv: iv || m.iv,
                  is_edited: true,
                  edited_at: now,
                }
              : m
          ),
        };
      }
      return {
        messages: state.messages.map((m: Message) =>
          m.id === messageId
            ? {
                ...m,
                content,
                iv: iv || m.iv,
                is_edited: true,
                edited_at: now,
              }
            : m
        ),
      };
    }),

  recallMessageInStore: (messageId, isGroup) =>
    set((state: any) => {
      if (isGroup) {
        return {
          groupMessages: state.groupMessages.map((m: GroupMessage) =>
            m.id === messageId ? { ...m, is_recalled: true, content: '' } : m
          ),
        };
      }
      return {
        messages: state.messages.map((m: Message) =>
          m.id === messageId ? { ...m, is_recalled: true, content: '' } : m
        ),
      };
    }),

  deleteMessageFromStore: (messageId, isGroup) =>
    set((state: any) => {
      if (isGroup) {
        return {
          groupMessages: state.groupMessages.filter((m: GroupMessage) => m.id !== messageId),
        };
      }
      return {
        messages: state.messages.filter((m: Message) => m.id !== messageId),
      };
    }),
});
