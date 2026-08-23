// Context: [音波說話檢測器] 基于 Web Audio API 的即時語音活動檢測 (VAD)，驅動說話者翡翠綠邊框脈衝發光 (speakingGlow)

export interface VADOptions {
  threshold?: number;     // 音量判定閾值 (0-255，預設 14)
  silenceDelay?: number;  // 靜音平滑延遲 (毫秒，預設 350ms，防止綠框高頻閃爍)
}

export class VoiceActivityDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSpeaking: boolean = false;
  private onSpeakingChange: (speaking: boolean) => void;
  private threshold: number;
  private silenceDelay: number;

  constructor(
    stream: MediaStream,
    onSpeakingChange: (speaking: boolean) => void,
    options: VADOptions = {}
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.threshold = options.threshold ?? 14;
    this.silenceDelay = options.silenceDelay ?? 350;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.startLoop();
    } catch (e) {
      console.warn('[VAD] AudioContext init failed:', e);
    }
  }

  private startLoop() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength;

      if (averageVolume > this.threshold) {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.onSpeakingChange(true);
        }
      } else {
        if (this.isSpeaking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isSpeaking = false;
            this.onSpeakingChange(false);
            this.silenceTimer = null;
          }, this.silenceDelay);
        }
      }

      this.animFrameId = requestAnimationFrame(checkAudioLevel);
    };

    this.animFrameId = requestAnimationFrame(checkAudioLevel);
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    try {
      this.sourceNode?.disconnect();
      this.analyser?.disconnect();
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch (e) {
      // 忽略關閉異常
    }
    this.sourceNode = null;
    this.analyser = null;
    this.audioCtx = null;
    this.isSpeaking = false;
  }
}
