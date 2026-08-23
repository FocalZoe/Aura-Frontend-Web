// Context: 原生 Web Audio API 音效合成器 (免外掛音訊檔、零延遲、加入/離開/靜音切換與來電響鈴)

class CallSoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;

  private getCtx(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // 1. 加入通話音效 (清脆上升雙音階 C5 -> G5)
  public playJoin(): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(783.99, now + 0.12); // G5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('[CallSound] playJoin error:', e);
    }
  }

  // 2. 離開通話音效 (柔和下降雙音階 G5 -> C5)
  public playLeave(): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.setValueAtTime(523.25, now + 0.12); // C5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('[CallSound] playLeave error:', e);
    }
  }

  // 3. 靜音/取消靜音切換音效 (僅自身本地耳機/揚聲器聽到，不外漏)
  public playMuteToggle(isMuted: boolean): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      if (isMuted) {
        // 靜音：略降調提示 (440Hz -> 330Hz)
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
      } else {
        // 取消靜音：升調清脆提示 (330Hz -> 480Hz)
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('[CallSound] playMuteToggle error:', e);
    }
  }

  // 4. 來電與撥號響鈴 (雙音和弦週期震盪)
  public startRingtone(): void {
    this.stopRingtone();
    const ctx = this.getCtx();
    if (!ctx) return;

    const playTone = () => {
      if (!this.audioCtx) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch {}
    };

    playTone();
    this.ringtoneInterval = setInterval(playTone, 3000);
  }

  public stopRingtone(): void {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }
}

export const callSoundSynthesizer = new CallSoundSynthesizer();
