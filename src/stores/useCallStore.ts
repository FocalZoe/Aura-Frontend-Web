// TEAM_014: Zustand 全域通話狀態管理與 Signaling / 發起時間戳與統一紀錄 (Zero Tech Debt Architecture)
import { create } from 'zustand';
import { ICallEngine, PeerToPeerCallEngine } from '../services/webrtcService';
import { websocketService } from '../services/websocketService';
import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';
import { Message } from '../types';
import { e2eeService } from '../services/e2eeService';
import { getLocalPrivateKey, importPublicKey, deriveSharedKey, encryptMessage } from '../utils/crypto';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
export type CallType = 'audio' | 'video';

export interface PeerUser {
  id: number;
  name: string;
  avatar?: string;
}

interface CallStore {
  callState: CallState;
  callType: CallType;
  isCaller: boolean;
  callStartTime: string | null;
  peerUser: PeerUser | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isRemoteVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  duration: number;
  busyNotification: string | null;
  callEngine: ICallEngine | null;

  // Actions
  startCall: (targetUser: PeerUser, type: CallType) => Promise<void>;
  handleIncomingCall: (caller: PeerUser, type: CallType) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  setBusyNotification: (msg: string | null) => void;

  // WebRTC Signal Event Handlers
  onReceiveResponse: (content: string, senderId: number) => Promise<void>;
  onReceiveOffer: (sdp: string, senderId: number) => Promise<void>;
  onReceiveAnswer: (sdp: string) => Promise<void>;
  onReceiveCandidate: (candidate: any) => Promise<void>;
  onReceiveMediaToggle: (contentStr: string) => void;
  onReceiveHangup: () => void;
  onReceiveBusyNotification: (callerId: number, callType: CallType) => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let globalPendingCandidates: string[] = [];

const flushGlobalCandidates = async (engine: ICallEngine) => {
  if (globalPendingCandidates.length > 0) {
    console.log(`[CallStore] Flushing ${globalPendingCandidates.length} early received candidates to callEngine`);
    while (globalPendingCandidates.length > 0) {
      const candStr = globalPendingCandidates.shift();
      if (candStr) {
        try {
          const candidate = JSON.parse(candStr);
          await engine.addIceCandidate(candidate);
        } catch (err) {
          console.warn('[CallStore] Flush candidate failed:', err);
        }
      }
    }
  }
};

// 通話紀錄產生與加密持久化 (通話發起方單一權威原則與發起時間戳)
const recordCallHistory = async (
  peer: PeerUser,
  type: CallType,
  duration: number,
  isMissed = false,
  isRejected = false
) => {
  const { isCaller, callStartTime } = useCallStore.getState();

  // 100% 嚴格僅由通話發起方 (isCaller === true) 權威產生與傳送紀錄
  if (!isCaller) {
    console.log('[CallStore] Skipping recordCallHistory on callee side (Authoritative initiator rule)');
    return;
  }

  let recordText = '';
  if (isMissed) {
    recordText = '📞 未接來電';
  } else if (isRejected) {
    recordText = '📞 已拒絕來電';
  } else {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    recordText = `📞 通話\n${durStr}`;
  }

  const myUser = useAuthStore.getState().user;
  if (!myUser) return;

  const msgTimestamp = callStartTime || new Date().toISOString();

  // 1. 本地即時新增至聊天 Store 訊息列表
  const myMsg: Message = {
    id: Date.now(),
    sender_id: myUser.id,
    receiver_id: peer.id,
    to: peer.id,
    content: recordText,
    timestamp: msgTimestamp,
    decrypted: true,
  };
  useChatStore.getState().addMessage(myMsg);

  // 2. 加密並透過 WebSocket 傳送至對手端與伺服器落庫
  try {
    const token = useAuthStore.getState().token;
    const { friendsMap } = useChatStore.getState();
    let pubKey: string | undefined = friendsMap[peer.id];
    if (!pubKey && token) {
      pubKey = await e2eeService.fetchUserPublicKey(peer.id, token);
    }
    const privKey = await getLocalPrivateKey(myUser.id);
    if (pubKey && privKey) {
      const targetPubKey: string = pubKey;
      const partnerPubKey = await importPublicKey(targetPubKey);
      const sharedKey = await deriveSharedKey(privKey, partnerPubKey);
      const { ciphertext, iv } = await encryptMessage(sharedKey, recordText);
      websocketService.send({
        type: 'message',
        to: peer.id,
        content: ciphertext,
        iv,
      });
    }
  } catch (err) {
    console.warn('[CallStore] Persist call record failed:', err);
  }
};

export const useCallStore = create<CallStore>((set, get) => ({
  callState: 'idle',
  callType: 'audio',
  isCaller: false,
  callStartTime: null,
  peerUser: null,
  isMuted: false,
  isVideoOff: true,
  isRemoteVideoOff: true,
  localStream: null,
  remoteStream: null,
  duration: 0,
  busyNotification: null,
  callEngine: null,

  startCall: async (targetUser: PeerUser, type: CallType) => {
    const { callEngine } = get();
    if (callEngine) {
      callEngine.close();
    }
    globalPendingCandidates = [];

    const isInitialVideo = type === 'video';
    const startTime = new Date().toISOString();

    const engine = new PeerToPeerCallEngine({
      onLocalStream: (stream) => set({ localStream: stream }),
      onRemoteStream: (stream) => {
        console.log('[CallStore] Received remoteStream from callEngine:', stream.id, 'AudioTracks:', stream.getAudioTracks().length);
        set({ remoteStream: stream });
      },
      onIceCandidate: (candidate) => {
        const currentPeer = get().peerUser;
        if (currentPeer) {
          websocketService.send({
            type: 'webrtc_candidate',
            to: currentPeer.id,
            content: JSON.stringify(candidate),
          });
        }
      },
      onClose: () => {
        get().endCall();
      },
    });

    set({
      callState: 'calling',
      callType: type,
      isCaller: true,
      callStartTime: startTime,
      peerUser: targetUser,
      isMuted: false,
      isVideoOff: !isInitialVideo,
      isRemoteVideoOff: !isInitialVideo,
      localStream: null,
      remoteStream: null,
      duration: 0,
      callEngine: engine,
    });

    try {
      await engine.initCall(true, isInitialVideo);
      await flushGlobalCandidates(engine);

      websocketService.send({
        type: 'call_request',
        to: targetUser.id,
        content: type,
      });
    } catch (err) {
      console.error('[CallStore] Failed to initialize media device:', err);
      engine.close();
      set({
        callState: 'idle',
        isCaller: false,
        callStartTime: null,
        peerUser: null,
        callEngine: null,
        busyNotification: '無法取得麥克風或攝影機權限',
      });
    }
  },

  handleIncomingCall: (caller: PeerUser, type: CallType) => {
    const { callState } = get();
    if (callState !== 'idle') return;

    set({
      callState: 'incoming',
      callType: type,
      isCaller: false,
      callStartTime: new Date().toISOString(),
      peerUser: caller,
      isMuted: false,
      isVideoOff: type !== 'video',
      isRemoteVideoOff: type !== 'video',
      localStream: null,
      remoteStream: null,
      duration: 0,
    });
  },

  acceptCall: async () => {
    const { peerUser, callType, callEngine } = get();
    if (!peerUser) return;
    if (callEngine) callEngine.close();

    const isInitialVideo = callType === 'video';

    const engine = new PeerToPeerCallEngine({
      onLocalStream: (stream) => set({ localStream: stream }),
      onRemoteStream: (stream) => {
        console.log('[CallStore] Received remoteStream in acceptCall:', stream.id, 'AudioTracks:', stream.getAudioTracks().length);
        set({ remoteStream: stream });
      },
      onIceCandidate: (candidate) => {
        websocketService.send({
          type: 'webrtc_candidate',
          to: peerUser.id,
          content: JSON.stringify(candidate),
        });
      },
      onClose: () => {
        get().endCall();
      },
    });

    set({ callEngine: engine });

    try {
      await engine.initCall(true, isInitialVideo);
      await flushGlobalCandidates(engine);

      websocketService.send({
        type: 'call_response',
        to: peerUser.id,
        content: 'accept',
      });

      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((state) => ({ duration: state.duration + 1 }));
      }, 1000);

      set({ callState: 'connected' });
    } catch (err) {
      console.error('[CallStore] Accept call media error:', err);
      engine.close();
      websocketService.send({
        type: 'call_response',
        to: peerUser.id,
        content: 'reject',
      });
      set({ callState: 'idle', isCaller: false, callStartTime: null, peerUser: null, callEngine: null });
    }
  },

  rejectCall: () => {
    const { peerUser, callEngine } = get();
    if (peerUser) {
      websocketService.send({
        type: 'call_response',
        to: peerUser.id,
        content: 'reject',
      });
    }
    if (callEngine) callEngine.close();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    globalPendingCandidates = [];
    set({
      callState: 'idle',
      isCaller: false,
      callStartTime: null,
      peerUser: null,
      localStream: null,
      remoteStream: null,
      callEngine: null,
    });
  },

  endCall: () => {
    const { peerUser, callType, duration, callEngine, callState, isCaller } = get();
    if (peerUser) {
      websocketService.send({
        type: 'call_hangup',
        to: peerUser.id,
      });

      if (isCaller) {
        if (callState === 'connected') {
          recordCallHistory(peerUser, callType, duration);
        } else if (callState === 'calling') {
          // 撥打後立即取消通話
          recordCallHistory(peerUser, callType, 0, true, false);
        }
      }
    }
    if (callEngine) {
      callEngine.close();
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    globalPendingCandidates = [];
    set({
      callState: 'ended',
      localStream: null,
      remoteStream: null,
      callEngine: null,
    });

    setTimeout(() => {
      set({ callState: 'idle', isCaller: false, callStartTime: null, peerUser: null });
    }, 1200);
  },

  toggleAudio: () => {
    const { callEngine, isMuted } = get();
    if (!callEngine) return;
    const isAudioEnabled = callEngine.toggleAudio(isMuted);
    set({ isMuted: !isAudioEnabled });
  },

  toggleVideo: () => {
    const { callEngine, isVideoOff, peerUser } = get();
    if (!callEngine) return;
    const isVideoEnabled = callEngine.toggleVideo(isVideoOff);
    const newIsVideoOff = !isVideoEnabled;
    set({ isVideoOff: newIsVideoOff });

    if (peerUser) {
      websocketService.send({
        type: 'webrtc_media_toggle',
        to: peerUser.id,
        content: JSON.stringify({ isVideoOff: newIsVideoOff }),
      });
    }
  },

  setBusyNotification: (msg: string | null) => set({ busyNotification: msg }),

  // Signaling Callback Implementation
  onReceiveResponse: async (content: string, _senderId: number) => {
    const { callEngine, peerUser, callType, isCaller } = get();
    if (content === 'accept') {
      if (callEngine && peerUser) {
        try {
          const offer = await callEngine.createOffer();
          websocketService.send({
            type: 'webrtc_offer',
            to: peerUser.id,
            content: JSON.stringify(offer),
          });

          if (timerInterval) clearInterval(timerInterval);
          timerInterval = setInterval(() => {
            set((state) => ({ duration: state.duration + 1 }));
          }, 1000);

          set({ callState: 'connected' });
        } catch (err) {
          console.error('[CallStore] Create offer failed:', err);
          get().endCall();
        }
      }
    } else {
      let reasonText = '對方已拒絕通話';
      if (content === 'busy') reasonText = '對方正在通話中 (忙線)';
      if (content === 'offline') reasonText = '對方目前不線上';
      if (content === 'blocked') reasonText = '無法發起通話';

      // 撥號者接收到 reject 訊息時，由撥號者單一權威記錄已拒絕來電
      if (isCaller && peerUser && content === 'reject') {
        recordCallHistory(peerUser, callType, 0, false, true);
      }

      if (callEngine) callEngine.close();
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      globalPendingCandidates = [];
      set({
        callState: 'ended',
        busyNotification: reasonText,
        localStream: null,
        remoteStream: null,
        callEngine: null,
      });

      setTimeout(() => {
        set({ callState: 'idle', isCaller: false, callStartTime: null, peerUser: null });
      }, 2000);
    }
  },

  onReceiveOffer: async (sdpStr: string, senderId: number) => {
    const { callEngine } = get();
    if (!callEngine) return;

    try {
      const offer = JSON.parse(sdpStr);
      const answer = await callEngine.handleOffer(offer);
      websocketService.send({
        type: 'webrtc_answer',
        to: senderId,
        content: JSON.stringify(answer),
      });
    } catch (err) {
      console.error('[CallStore] Handle offer failed:', err);
    }
  },

  onReceiveAnswer: async (sdpStr: string) => {
    const { callEngine } = get();
    if (!callEngine) return;

    try {
      const answer = JSON.parse(sdpStr);
      await callEngine.handleAnswer(answer);
    } catch (err) {
      console.error('[CallStore] Handle answer failed:', err);
    }
  },

  onReceiveCandidate: async (candidateStr: string) => {
    const { callEngine } = get();
    if (!callEngine) {
      console.log('[CallStore] Candidate buffered');
      globalPendingCandidates.push(candidateStr);
      return;
    }

    try {
      const candidate = JSON.parse(candidateStr);
      await callEngine.addIceCandidate(candidate);
      await flushGlobalCandidates(callEngine);
    } catch (err) {
      console.error('[CallStore] Handle candidate failed:', err);
    }
  },

  onReceiveMediaToggle: (contentStr: string) => {
    try {
      const data = JSON.parse(contentStr);
      console.log('[CallStore] Received remote media toggle:', data);
      if (typeof data.isVideoOff === 'boolean') {
        set({ isRemoteVideoOff: data.isVideoOff });
      }
    } catch (err) {
      console.warn('[CallStore] Parse media toggle error:', err);
    }
  },

  onReceiveHangup: () => {
    const { peerUser, callType, duration, isCaller, callState, callEngine } = get();

    // 發起方接收到掛斷信號時，由發起方權威寫入通話紀錄
    if (isCaller && peerUser && callState === 'connected') {
      recordCallHistory(peerUser, callType, duration);
    }

    if (callEngine) callEngine.close();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    globalPendingCandidates = [];
    set({
      callState: 'ended',
      localStream: null,
      remoteStream: null,
      callEngine: null,
    });

    setTimeout(() => {
      set({ callState: 'idle', isCaller: false, callStartTime: null, peerUser: null });
    }, 1500);
  },

  onReceiveBusyNotification: (callerId: number, type: CallType) => {
    const friend = useChatStore.getState().friends.find((f) => Number(f.id) === Number(callerId));
    const peer: PeerUser = {
      id: callerId,
      name: friend ? (friend.display_name || friend.account_id) : `User ${callerId}`,
      avatar: friend?.avatar,
    };
    // 收到 busyNotification 時 (對方嘗試來電時我們正在通話中)，由發起方產生未接紀錄
    recordCallHistory(peer, type, 0, true);
    set({ busyNotification: `未接來電通知 (對方嘗試來電時您正忙線中)` });
  },
}));
