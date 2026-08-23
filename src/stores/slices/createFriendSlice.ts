// Context: [好友與用戶領域 Slice] 管理好友列表、好友備註暱稱、黑名單、陌生人、在線狀態

import { StateCreator } from 'zustand';
import { User } from '../../types';

export interface FriendSlice {
  activeChatUser: User | null;
  onlineUsers: number[];
  friends: User[];
  pendingRequests: User[];
  incomingStrangerUsers: User[];
  sentStrangerUsers: User[];
  blockedUsers: User[];
  friendsMap: Record<number, string>;
  userAliases: Record<number, string>;

  setUserAlias: (targetId: number, alias: string) => void;
  setUserAliases: (aliases: Record<number, string>) => void;
  getUserDisplayName: (user?: User | null) => string;
  setActiveChatUser: (user: User | null) => void;
  setOnlineUsers: (users: number[]) => void;
  setFriends: (friends: User[]) => void;
  setPendingRequests: (requests: User[]) => void;
  setIncomingStrangerUsers: (users: User[]) => void;
  setSentStrangerUsers: (users: User[]) => void;
  setBlockedUsers: (users: User[]) => void;
  setFriendsMap: (map: Record<number, string>) => void;
  addStrangerUser: (stranger: User, isSent?: boolean) => void;
  updateUserInStore: (userId: number, fields: Partial<User>) => void;
}

export const createFriendSlice: StateCreator<any, [], [], FriendSlice> = (set, get) => ({
  activeChatUser: null,
  onlineUsers: [],
  friends: [],
  pendingRequests: [],
  incomingStrangerUsers: [],
  sentStrangerUsers: [],
  blockedUsers: [],
  friendsMap: {},
  userAliases: {},

  setUserAlias: (targetId, alias) =>
    set((state: any) => ({
      userAliases: {
        ...state.userAliases,
        [targetId]: alias,
      },
    })),

  setUserAliases: (aliases) => set({ userAliases: aliases || {} }),

  getUserDisplayName: (user) => {
    if (!user) return '';
    const aliases = get().userAliases || {};
    if (user.id && aliases[user.id] && aliases[user.id].trim() !== '') {
      return aliases[user.id].trim();
    }
    return user.display_name || user.account_id || `User_${user.id}`;
  },

  setActiveChatUser: (user) =>
    set((state: any) => {
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

  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setFriends: (friends) => set({ friends }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setIncomingStrangerUsers: (users) => set({ incomingStrangerUsers: users }),
  setSentStrangerUsers: (users) => set({ sentStrangerUsers: users }),
  setBlockedUsers: (users) => set({ blockedUsers: users }),
  setFriendsMap: (map) => set({ friendsMap: map }),

  addStrangerUser: (stranger, isSent = false) =>
    set((state: any) => {
      const targetListKey = isSent ? 'sentStrangerUsers' : 'incomingStrangerUsers';
      const existingList = state[targetListKey];
      if (existingList.some((u: User) => u.id === stranger.id)) {
        return state;
      }
      return { [targetListKey]: [stranger, ...existingList] };
    }),

  updateUserInStore: (userId, fields) =>
    set((state: any) => {
      const updateList = (list: User[]) =>
        list.map((u) => (u.id === userId ? { ...u, ...fields } : u));

      return {
        friends: updateList(state.friends),
        pendingRequests: updateList(state.pendingRequests),
        incomingStrangerUsers: updateList(state.incomingStrangerUsers),
        sentStrangerUsers: updateList(state.sentStrangerUsers),
        blockedUsers: updateList(state.blockedUsers),
        activeChatUser:
          state.activeChatUser?.id === userId
            ? { ...state.activeChatUser, ...fields }
            : state.activeChatUser,
      };
    }),
});
