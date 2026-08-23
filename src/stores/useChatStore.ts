// Context: [全域聊天狀態 SSOT Store] 透過 Slice Pattern 組合 MessageSlice, FriendSlice, GroupSlice

import { create } from 'zustand';
import { createMessageSlice, MessageSlice, isOptimisticId } from './slices/createMessageSlice';
import { createFriendSlice, FriendSlice } from './slices/createFriendSlice';
import { createGroupSlice, GroupSlice } from './slices/createGroupSlice';

export { isOptimisticId };
export type ChatState = MessageSlice & FriendSlice & GroupSlice;

export const useChatStore = create<ChatState>()((...a) => ({
  ...createMessageSlice(...a),
  ...createFriendSlice(...a),
  ...createGroupSlice(...a),
}));
