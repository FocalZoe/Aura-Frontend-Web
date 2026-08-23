// Context: Zustand 全域群組 SFU 音視訊通話狀態機 (雙排版、多成員串流映射與發言者檢測)

import { create } from 'zustand';
import { SFUCallClient } from '../services/sfuCallClient';
import { websocketService } from '../services/websocketService';
import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';

export type GroupCallType = 'audio' | 'video';
export type GroupCallLayoutMode = 'grid' | 'focus';

export interface GroupCallStore {
  activeGroupId: number | null;
  activeGroupName: string;
  callType: GroupCallType;
  initiatorId: number | null;
  isJoined: boolean;
  isCallActive: boolean; // 是否有進行中的通話 (供 Banner 顯示)
  participants: number[]; // 房間內所有成員 UserID
  localStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>; // key: userId
  screenShareStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  participantMediaStates: Record<number, { isMuted: boolean; isVideoOff: boolean }>;
  speakingUserIds: number[];
  pinnedUserId: number | null; // 主舞台置頂成員 ID
  layoutMode: GroupCallLayoutMode;
  duration: number;
  sfuClient: SFUCallClient | null;

  // Actions
  startGroupCall: (groupId: number, groupName: string, type: GroupCallType) => Promise<void>;
  joinGroupCall: (groupId: number, groupName: string, type?: GroupCallType) => Promise<void>;
  leaveGroupCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setPinnedUser: (userId: number | null) => void;
  toggleLayoutMode: () => void;
  dismissIncomingBanner: () => void;

  // WebSocket Handlers
  onGroupCallIncoming: (groupId: number, initiatorId: number, callType: GroupCallType, participants: number[]) => void;
  onRoomJoined: (groupId: number, callType: GroupCallType, initiatorId: number, participants: number[]) => Promise<void>;
  onUserJoined: (groupId: number, userId: number, participants: number[]) => void;
  onUserLeft: (groupId: number, userId: number, remainingCount: number, participants: number[]) => void;
  onReceiveOffer: (sdp: string) => Promise<void>;
  onReceiveAnswer: (sdp: string) => Promise<void>;
  onReceiveCandidate: (candidate: any) => Promise<void>;
  onReceiveMediaToggle: (senderId: number, contentStr: string) => void;
  onGroupCallEnded: (groupId: number, duration: number) => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const useGroupCallStore = create<GroupCallStore>((set, get) => ({
  activeGroupId: null,
  activeGroupName: '',
  callType: 'audio',
  initiatorId: null,
  isJoined: false,
  isCallActive: false,
  participants: [],
  localStream: null,
  remoteStreams: {},
  screenShareStream: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  participantMediaStates: {},
  speakingUserIds: [],
  pinnedUserId: null,
  layoutMode: 'grid',
  duration: 0,
  sfuClient: null,

  // 發起群通話
  startGroupCall: async (groupId: number, groupName: string, type: GroupCallType) => {
    const { leaveGroupCall } = get();
    leaveGroupCall();

    set({
      activeGroupId: groupId,
      activeGroupName: groupName,
      callType: type,
      isJoined: true,
      isCallActive: true,
      isVideoOff: type === 'audio',
      duration: 0,
    });

    // 啟動計時器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set((state) => ({ duration: state.duration + 1 }));
    }, 1000);

    // 發送 sfu_join 給後端
    websocketService.send({
      type: 'sfu_join',
      group_id: groupId,
      call_type: type,
    });
  },

  // 加入群通話
  joinGroupCall: async (groupId: number, groupName: string, type?: GroupCallType) => {
    const currentType = type || get().callType || 'audio';
    set({
      activeGroupId: groupId,
      activeGroupName: groupName,
      callType: currentType,
      isJoined: true,
      isCallActive: true,
      isVideoOff: currentType === 'audio',
      duration: 0,
    });

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set((state) => ({ duration: state.duration + 1 }));
    }, 1000);

    websocketService.send({
      type: 'sfu_join',
      group_id: groupId,
      call_type: currentType,
    });
  },

  // 離開群通話
  leaveGroupCall: () => {
    const { sfuClient, activeGroupId } = get();

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (sfuClient) {
      sfuClient.close();
    }

    if (activeGroupId) {
      websocketService.send({
        type: 'sfu_leave',
        group_id: activeGroupId,
      });
    }

    set({
      isJoined: false,
      sfuClient: null,
      localStream: null,
      remoteStreams: {},
      screenShareStream: null,
      isScreenSharing: false,
      pinnedUserId: null,
      duration: 0,
    });
  },

  toggleAudio: () => {
    const { sfuClient, isMuted } = get();
    if (sfuClient) {
      const newMuted = sfuClient.toggleAudio();
      set({ isMuted: newMuted });
    } else {
      set({ isMuted: !isMuted });
    }
  },

  toggleVideo: async () => {
    const { sfuClient, isVideoOff } = get();
    if (sfuClient) {
      const newVideoEnabled = await sfuClient.toggleVideo();
      set({ isVideoOff: !newVideoEnabled });
    } else {
      set({ isVideoOff: !isVideoOff });
    }
  },

  toggleScreenShare: async () => {
    const { sfuClient, isScreenSharing } = get();
    if (!sfuClient) return;

    if (isScreenSharing) {
      sfuClient.stopScreenShare();
      set({ isScreenSharing: false, screenShareStream: null });
    } else {
      const stream = await sfuClient.startScreenShare();
      if (stream) {
        set({ isScreenSharing: true, screenShareStream: stream });
      }
    }
  },

  setPinnedUser: (userId: number | null) => {
    set({
      pinnedUserId: userId,
      layoutMode: userId !== null ? 'focus' : 'grid',
    });
  },

  toggleLayoutMode: () => {
    set((state) => ({
      layoutMode: state.layoutMode === 'grid' ? 'focus' : 'grid',
    }));
  },

  dismissIncomingBanner: () => {
    set({ isCallActive: false });
  },

  // WebSocket 事件：收到其他成員發起的群通話通知 (Banner 顯示)
  onGroupCallIncoming: (groupId: number, initiatorId: number, callType: GroupCallType, participants: number[]) => {
    const chatStore = useChatStore.getState();
    const group = chatStore.groups.find((g) => g.id === groupId);
    const groupName = group ? group.name : '群組通話';

    set({
      activeGroupId: groupId,
      activeGroupName: groupName,
      callType,
      initiatorId,
      participants,
      isCallActive: true,
    });
  },

  // 成功加入房間：建立 SFUClient 並推流
  onRoomJoined: async (groupId: number, callType: GroupCallType, initiatorId: number, participants: number[]) => {
    const currentClient = get().sfuClient;
    if (currentClient) {
      currentClient.close();
    }

    const client = new SFUCallClient(groupId, {
      onLocalStream: (stream) => {
        set({ localStream: stream });
      },
      onRemoteTrack: (track, stream) => {
        // 解析遠端軌道並更新 remoteStreams
        // Pion SFU 將各成員 Stream 保持，我們動態更新
        const currentRemotes = { ...get().remoteStreams };
        // 若 stream 具備 ID 則關聯
        const remotes = { ...currentRemotes, [Date.now()]: stream };
        set({ remoteStreams: remotes });
      },
      onScreenShareStream: (screenStream) => {
        set({ screenShareStream: screenStream, isScreenSharing: screenStream !== null });
      },
      onClose: () => {
        get().leaveGroupCall();
      },
    });

    set({
      sfuClient: client,
      activeGroupId: groupId,
      callType,
      initiatorId,
      participants,
      isJoined: true,
      isCallActive: true,
    });

    // 初始化並發布本地麥克風/鏡頭
    try {
      await client.init(true, callType === 'video');
    } catch (err) {
      console.error('[GroupCallStore] SFU Client init error:', err);
    }
  },

  onUserJoined: (groupId: number, userId: number, participants: number[]) => {
    set({
      participants,
      activeGroupId: groupId,
      isCallActive: true,
    });
  },

  onUserLeft: (groupId: number, userId: number, remainingCount: number, participants: number[]) => {
    const remotes = { ...get().remoteStreams };
    delete remotes[userId];

    set({
      participants,
      remoteStreams: remotes,
      pinnedUserId: get().pinnedUserId === userId ? null : get().pinnedUserId,
    });
  },

  onReceiveOffer: async (sdp: string) => {
    const { sfuClient } = get();
    if (sfuClient) {
      await sfuClient.handleOffer(sdp);
    }
  },

  onReceiveAnswer: async (sdp: string) => {
    const { sfuClient } = get();
    if (sfuClient) {
      await sfuClient.handleAnswer(sdp);
    }
  },

  onReceiveCandidate: async (candidate: any) => {
    const { sfuClient } = get();
    if (sfuClient && candidate) {
      await sfuClient.addIceCandidate(candidate);
    }
  },

  onReceiveMediaToggle: (senderId: number, contentStr: string) => {
    try {
      const state = JSON.parse(contentStr);
      set((prev) => ({
        participantMediaStates: {
          ...prev.participantMediaStates,
          [senderId]: state,
        },
      }));
    } catch (e) {
      // ignore
    }
  },

  onGroupCallEnded: (groupId: number, duration: number) => {
    const { activeGroupId, isJoined } = get();
    if (activeGroupId === groupId) {
      if (isJoined) {
        get().leaveGroupCall();
      }
      set({ isCallActive: false, activeGroupId: null });
    }
  },
}));
