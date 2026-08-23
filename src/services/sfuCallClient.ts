// Context: Go-Pion SFU 多人群組通話客戶端引擎 (單一 PeerConnection 發布、多軌道訂閱與螢幕分享)

import { websocketService } from './websocketService';

export interface SFUClientEvents {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
  onScreenShareStream?: (stream: MediaStream | null) => void;
  onSpeakingStateChange?: (speakingUserIds: number[]) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class SFUCallClient {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private groupId: number;
  private events: SFUClientEvents;
  private audioSenders: RTCRtpSender[] = [];
  private videoSenders: RTCRtpSender[] = [];
  private screenSenders: RTCRtpSender[] = [];
  private isMuted: boolean = false;
  private isVideoOff: boolean = false;

  constructor(groupId: number, events: SFUClientEvents) {
    this.groupId = groupId;
    this.events = events;
  }

  // 初始化連線與本地影音串流
  public async init(audio = true, video = false): Promise<MediaStream> {
    this.close();

    this.peerConnection = new RTCPeerConnection(DEFAULT_ICE_SERVERS);
    this.setupPeerListeners();

    // 取得使用者麥克風與鏡頭
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (err: any) {
      console.warn('[SFU Client] getUserMedia failed, fallback to audio only:', err);
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    // 將本地 Track 加入 PeerConnection (Publish)
    this.localStream.getTracks().forEach((track) => {
      if (this.peerConnection && this.localStream) {
        const sender = this.peerConnection.addTrack(track, this.localStream);
        if (track.kind === 'audio') {
          this.audioSenders.push(sender);
        } else if (track.kind === 'video') {
          this.videoSenders.push(sender);
        }
      }
    });

    if (this.events.onLocalStream && this.localStream) {
      this.events.onLocalStream(this.localStream);
    }

    // 發起 Offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);

    // 發送 sfu_offer 給後端
    websocketService.send({
      type: 'sfu_offer',
      group_id: this.groupId,
      sdp: offer.sdp,
    });

    return this.localStream;
  }

  private setupPeerListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        websocketService.send({
          type: 'sfu_candidate',
          group_id: this.groupId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // 接收 SFU 轉發過來的遠端軌道 (Subscribe)
    this.peerConnection.ontrack = (event) => {
      console.log('[SFU Client] Received remote track:', event.track.kind, event.track.id);
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      if (this.events.onRemoteTrack) {
        this.events.onRemoteTrack(event.track, stream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[SFU Client] Connection state:', state);
      if (state === 'failed' || state === 'closed') {
        if (this.events.onClose) {
          this.events.onClose();
        }
      }
    };
  }

  // 處理後端回傳的 Answer SDP
  public async handleAnswer(sdp: string): Promise<void> {
    if (!this.peerConnection) return;
    const answer: RTCSessionDescriptionInit = {
      type: 'answer',
      sdp,
    };
    await this.peerConnection.setRemoteDescription(answer);
  }

  // 處理後端發起的重新協商 Offer SDP (當有新成員推流時)
  public async handleOffer(sdp: string): Promise<void> {
    if (!this.peerConnection) return;
    const offer: RTCSessionDescriptionInit = {
      type: 'offer',
      sdp,
    };
    await this.peerConnection.setRemoteDescription(offer);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    websocketService.send({
      type: 'sfu_answer',
      group_id: this.groupId,
      sdp: answer.sdp,
    });
  }

  // 加入遠端 ICE Candidate
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[SFU Client] Add ICE Candidate error:', err);
      }
    }
  }

  // 切換麥克風靜音
  public toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;

      websocketService.send({
        type: 'sfu_media_toggle',
        group_id: this.groupId,
        content: JSON.stringify({ isMuted: this.isMuted, isVideoOff: this.isVideoOff }),
      });
      return this.isMuted;
    }
    return true;
  }

  // 切換鏡頭開啟/關閉
  public async toggleVideo(enabled?: boolean): Promise<boolean> {
    if (!this.peerConnection) return false;

    const shouldEnable = enabled !== undefined ? enabled : this.isVideoOff;

    if (shouldEnable) {
      // 開啟鏡頭
      if (!this.localStream) {
        this.localStream = new MediaStream();
      }
      let videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          this.localStream.addTrack(videoTrack);
          const sender = this.peerConnection.addTrack(videoTrack, this.localStream);
          this.videoSenders.push(sender);

          // 重新協商
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          websocketService.send({
            type: 'sfu_offer',
            group_id: this.groupId,
            sdp: offer.sdp,
          });
        } catch (err) {
          console.error('[SFU Client] Failed to open camera:', err);
          return false;
        }
      } else {
        videoTrack.enabled = true;
      }
      this.isVideoOff = false;
    } else {
      // 關閉鏡頭
      const videoTrack = this.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
        videoTrack.stop();
        if (this.localStream) {
          this.localStream.removeTrack(videoTrack);
        }
      }
      this.isVideoOff = true;
    }

    if (this.events.onLocalStream && this.localStream) {
      this.events.onLocalStream(new MediaStream(this.localStream.getTracks()));
    }

    websocketService.send({
      type: 'sfu_media_toggle',
      group_id: this.groupId,
      content: JSON.stringify({ isMuted: this.isMuted, isVideoOff: this.isVideoOff }),
    });

    return !this.isVideoOff;
  }

  // 開啟螢幕分享
  public async startScreenShare(): Promise<MediaStream | null> {
    if (!this.peerConnection) return null;

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          this.stopScreenShare();
        };

        const sender = this.peerConnection.addTrack(screenTrack, this.screenStream);
        this.screenSenders.push(sender);

        // 重新協商
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        websocketService.send({
          type: 'sfu_offer',
          group_id: this.groupId,
          sdp: offer.sdp,
        });
      }

      if (this.events.onScreenShareStream) {
        this.events.onScreenShareStream(this.screenStream);
      }

      return this.screenStream;
    } catch (err) {
      console.warn('[SFU Client] Screen share cancelled or failed:', err);
      return null;
    }
  }

  // 停止螢幕分享
  public stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (this.events.onScreenShareStream) {
      this.events.onScreenShareStream(null);
    }
  }

  // 釋放所有資源
  public close(): void {
    this.stopScreenShare();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.audioSenders = [];
    this.videoSenders = [];
    this.screenSenders = [];
  }
}
