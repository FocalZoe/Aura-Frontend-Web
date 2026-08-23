// Context: Zustand 全域群組 SFU 音視訊通話狀態機 (音效合成器、PiP 子母畫面、遠端軌道關聯修復與開始/結束歷史紀錄)

import { create } from 'zustand';
import { SFUCallClient } from '../services/sfuCallClient';
import { websocketService } from '../services/websocketService';
import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';
import { callSoundSynthesizer } from '../utils/CallSoundSynthesizer';

export type GroupCallType = 'audio' | 'video';
export type GroupCallLayoutMode = 'grid' | 'focus';

export interface GroupCallStore {
  activeGroupId: number | null;
  activeGroupName: string;
  callType: GroupCallType;
  initiatorId: number | null;
  isJoined: boolean;
  isCallActive: boolean; // 是否有進行中的通話 (供 Banner 顯示)
  isMinimized: boolean;  // 是否最小化為 PiP 子母畫面
  participants: number[]; // 房間內所有成員 UserID
  localStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>; // key: userId
  remoteAudioTracks: MediaStreamTrack[]; // 全域遠端音訊播放軌道池
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
  setMinimized: (minimized: boolean) => void;
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

// Context: 群組通話紀錄訊息推送
const sendGroupCallMessage = (groupId: number, content: string) => {
  try {
    websocketService.send({
      type: 'group_message',
      group_id: groupId,
      content,
    });
  } catch (e) {
    console.warn('[GroupCallStore] sendGroupCallMessage failed:', e);
  }
};

export const useGroupCallStore = create<GroupCallStore>((set, get) => ({
  activeGroupId: null,
  activeGroupName: '',
  callType: 'audio',
  initiatorId: null,
  isJoined: false,
  isCallActive: false,
  isMinimized: false,
  participants: [],
  localStream: null,
  remoteStreams: {},
  remoteAudioTracks: [],
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

  setMinimized: (minimized: boolean) => set({ isMinimized: minimized }),

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
      isMinimized: false,
      isVideoOff: type === 'audio',
      duration: 0,
    });

    // 發送群聊「通話已開始」系統紀錄
    const typeLabel = type === 'video' ? '視訊通話' : '語音通話';
    sendGroupCallMessage(groupId, `📞 群組${typeLabel}已開始`);

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
      isMinimized: false,
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
    const { sfuClient, activeGroupId, duration, callType, initiatorId, participants } = get();
    const selfUser = useAuthStore.getState().user;
    const isSelfInitiator = selfUser && Number(selfUser.id) === Number(initiatorId);

    callSoundSynthesizer.playLeave();

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

      // 若發起者離開或為最後一人，產生結算紀錄
      if (isSelfInitiator || participants.length <= 1) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        const typeLabel = callType === 'video' ? '視訊通話' : '語音通話';
        sendGroupCallMessage(activeGroupId, `📞 群組${typeLabel}已結束\n${durStr}`);
      }
    }

    set({
      isJoined: false,
      isMinimized: false,
      sfuClient: null,
      localStream: null,
      remoteStreams: {},
      remoteAudioTracks: [],
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
      callSoundSynthesizer.playMuteToggle(newMuted); // 僅自身本地聽到
      set({ isMuted: newMuted });
    } else {
      const newMuted = !isMuted;
      callSoundSynthesizer.playMuteToggle(newMuted);
      set({ isMuted: newMuted });
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
    set({ pinnedUserId: userId, layoutMode: userId ? 'focus' : 'grid' });
  },

  toggleLayoutMode: () => {
    const { layoutMode } = get();
    set({ layoutMode: layoutMode === 'grid' ? 'focus' : 'grid' });
  },

  dismissIncomingBanner: () => {
    set({ isCallActive: false });
  },

  // WebSocket Handlers
  onGroupCallIncoming: (groupId: number, initiatorId: number, callType: GroupCallType, participants: number[]) => {
    const { activeGroupId, isJoined } = get();
    if (isJoined && activeGroupId === groupId) {
      return;
    }

    const { groups } = useChatStore.getState();
    const group = groups.find((g) => Number(g.id) === Number(groupId));
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

    callSoundSynthesizer.playJoin();

    const client = new SFUCallClient(groupId, {
      onLocalStream: (stream) => {
        set({ localStream: stream });
      },
      onRemoteTrack: (track, stream) => {
        console.log('[SFU Store] Received remote track:', track.kind, track.id, 'streamId:', stream.id);

        if (track.kind === 'audio') {
          // 將音訊軌道加入全域音訊播放池
          const currentAudioTracks = [...get().remoteAudioTracks, track];
          set({ remoteAudioTracks: currentAudioTracks });
        }

        // 關聯遠端視訊 Stream
        const selfUser = useAuthStore.getState().user;
        const selfId = selfUser ? Number(selfUser.id) : 0;
        const currentRemotes = { ...get().remoteStreams };
        const otherParticipants = get().participants.filter((uid) => uid !== selfId);

        // 若 stream 具備明確標識或分配給未指派成員
        const targetUserId = otherParticipants[0] || (Date.now() as any);
        currentRemotes[targetUserId] = stream;

        set({ remoteStreams: currentRemotes });
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
    callSoundSynthesizer.playJoin();
    set({
      participants,
      activeGroupId: groupId,
      isCallActive: true,
    });
  },

  onUserLeft: (groupId: number, userId: number, remainingCount: number, participants: number[]) => {
    callSoundSynthesizer.playLeave();
    const remotes = { ...get().remoteStreams };
    delete remotes[userId];

    set({
      participants,
      remoteStreams: remotes,
      pinnedUserId: get().pinnedUserId === userId ? null : get().pinnedUserId,
      isCallActive: remainingCount > 0,
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
      const currentMediaStates = { ...get().participantMediaStates };
      currentMediaStates[senderId] = {
        isMuted: !!state.isMuted,
        isVideoOff: !!state.isVideoOff,
      };
      set({ participantMediaStates: currentMediaStates });
    } catch (e) {
      console.warn('[GroupCallStore] parse media toggle error:', e);
    }
  },

  onGroupCallEnded: (groupId: number, duration: number) => {
    const { activeGroupId } = get();
    if (activeGroupId === groupId) {
      get().leaveGroupCall();
    }
  },
}));
