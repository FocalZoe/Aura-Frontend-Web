import { create } from 'zustand';
import { User, Group } from '../types';

export interface ConfirmConfig {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface UIState {
  currentTab: 'chats' | 'groups' | 'strangers';
  showSearchModal: boolean;
  showSettingsModal: boolean;
  showPendingModal: boolean;
  showCreateGroupModal: boolean;
  showGroupMembersModal: boolean;
  activeGroupForModal: Group | null;
  selectedProfileUser: User | null;
  deleteTargetUser: { id: number; name: string } | null;
  contextMenu: { x: number; y: number; targetUser?: User; targetGroup?: Group } | null;
  confirmConfig: ConfirmConfig | null;

  setCurrentTab: (tab: 'chats' | 'groups' | 'strangers') => void;
  setShowSearchModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowPendingModal: (show: boolean) => void;
  setShowCreateGroupModal: (show: boolean) => void;
  setShowGroupMembersModal: (show: boolean) => void;
  setActiveGroupForModal: (group: Group | null) => void;
  setSelectedProfileUser: (user: User | null) => void;
  setDeleteTargetUser: (user: { id: number; name: string } | null) => void;
  setContextMenu: (menu: { x: number; y: number; targetUser?: User; targetGroup?: Group } | null) => void;
  showConfirmModal: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
  closeConfirmModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentTab: 'chats',
  showSearchModal: false,
  showSettingsModal: false,
  showPendingModal: false,
  showCreateGroupModal: false,
  showGroupMembersModal: false,
  activeGroupForModal: null,
  selectedProfileUser: null,
  deleteTargetUser: null,
  contextMenu: null,
  confirmConfig: null,

  setCurrentTab: (tab) => set({ currentTab: tab }),
  setShowSearchModal: (show) => set({ showSearchModal: show }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setShowPendingModal: (show) => set({ showPendingModal: show }),
  setShowCreateGroupModal: (show) => set({ showCreateGroupModal: show }),
  setShowGroupMembersModal: (show) => set({ showGroupMembersModal: show }),
  setActiveGroupForModal: (group) => set({ activeGroupForModal: group }),
  setSelectedProfileUser: (user) => set({ selectedProfileUser: user }),
  setDeleteTargetUser: (user) => set({ deleteTargetUser: user }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  showConfirmModal: (config) =>
    set({
      confirmConfig: {
        ...config,
        isOpen: true,
      },
    }),

  closeConfirmModal: () => set({ confirmConfig: null }),
}));
