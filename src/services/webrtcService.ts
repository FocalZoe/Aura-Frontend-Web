// Context: 雙架構 WebRTC 通話引擎抽象介面與 P2P 實作 (自由鏡頭切換與對手 Track 狀態監聽)

export interface CallEngineEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export interface ICallEngine {
  initCall(audio: boolean, video: boolean): Promise<MediaStream>;
  createOffer(): Promise<RTCSessionDescriptionInit>;
  handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  handleAnswer(answer: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  toggleAudio(enabled?: boolean): boolean;
  toggleVideo(enabled?: boolean): boolean;
  close(): void;
}

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class PeerToPeerCallEngine implements ICallEngine {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private events: CallEngineEvents;

  constructor(events: CallEngineEvents, config?: RTCConfiguration) {
    this.events = events;
    const rtcConfig = config || DEFAULT_ICE_SERVERS;
    this.peerConnection = new RTCPeerConnection(rtcConfig);
    this.setupPeerListeners();
  }

  private setupPeerListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Local Candidate:', event.candidate.candidate);
        if (this.events.onIceCandidate) {
          this.events.onIceCandidate(event.candidate);
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote Track:', event.track.kind, event.track.id, 'enabled:', event.track.enabled);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }

      // 監聽 W3C WebRTC 底層 MediaStreamTrack 封包流暫停 (onmute) 與恢復 (onunmute) 事件
      event.track.onmute = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} track paused (onmute)`);
        if (this.events.onRemoteStream && this.remoteStream) {
          this.events.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote ${event.track.kind} track resumed (onunmute)`);
        if (this.events.onRemoteStream && this.remoteStream) {
          this.events.onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      if (this.events.onRemoteStream && this.remoteStream) {
        const freshStream = new MediaStream(this.remoteStream.getTracks());
        this.events.onRemoteStream(freshStream);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', this.peerConnection?.iceConnectionState);
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state changed:', state);
      if (state === 'failed' || state === 'closed') {
        if (this.events.onClose) {
          this.events.onClose();
        }
      }
    };
  }

  public async initCall(_audio: boolean, initialVideo: boolean): Promise<MediaStream> {
    try {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } },
        });
      } catch (err1) {
        console.warn('[WebRTC] 720p Video request failed, trying default constraints:', err1);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: true,
          });
        } catch (err2) {
          console.warn('[WebRTC] No camera available or camera blocked, falling back to audio only:', err2);
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
        }
      }

      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach((t) => {
        t.enabled = initialVideo;
      });

      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = true;
      });

      if (this.events.onLocalStream) {
        this.events.onLocalStream(this.localStream);
      }

      if (this.peerConnection) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      return this.localStream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.events.onError) {
        this.events.onError(error);
      }
      throw error;
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushIceCandidates();

    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushIceCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    if (!this.peerConnection.remoteDescription) {
      this.iceCandidateQueue.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] AddIceCandidate error:', err);
    }
  }

  private async flushIceCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] FlushIceCandidate error:', err);
        }
      }
    }
  }

  public toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return false;

    const newState = enabled !== undefined ? enabled : !audioTracks[0].enabled;
    audioTracks.forEach((track) => {
      track.enabled = newState;
    });
    return newState;
  }

  public toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const newState = enabled !== undefined ? enabled : !videoTracks[0].enabled;
    videoTracks.forEach((track) => {
      track.enabled = newState;
    });
    return newState;
  }

  public close(): void {
    if (this.peerConnection) {
      try {
        this.peerConnection.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop();
            sender.track.enabled = false;
          }
        });
        this.peerConnection.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            receiver.track.stop();
            receiver.track.enabled = false;
          }
        });
      } catch (err) {
        console.warn('[WebRTC] Stop senders/receivers error:', err);
      }
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.iceCandidateQueue = [];
  }
}

