import { setMouthSource, setSpeaking } from './mouth';

/**
 * Gapless player for the 24 kHz 16-bit PCM chunks streamed by Gemini Live.
 * Exposes the output amplitude to the avatar for real lip-sync, and can be
 * cut instantly when the learner interrupts.
 */
export class PcmPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private analyser: AnalyserNode;
  private buf: Uint8Array<ArrayBuffer>;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private idleTimer = 0;
  private element: HTMLAudioElement | null = null;

  constructor(private sampleRate = 24000) {
    this.ctx = new AudioContext();
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.buf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.gain.connect(this.analyser);
    setMouthSource(() => this.level());
  }

  /**
   * Routes the tutor's voice through an <audio> element. Browsers treat that as real media
   * playback, which keeps the call alive in the background and shows media controls.
   * Falls back to plain Web Audio output if the element can't play.
   */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.element) {
      if (this.element.paused) await this.element.play().catch(() => undefined);
      return;
    }
    try {
      const dest = this.ctx.createMediaStreamDestination();
      this.analyser.connect(dest);
      const el = new Audio();
      el.srcObject = dest.stream;
      el.setAttribute('playsinline', '');
      await el.play();
      this.element = el;
    } catch {
      this.analyser.disconnect();
      this.analyser.connect(this.ctx.destination);
    }
  }

  /** RMS of the current output, scaled to roughly 0..1. */
  level(): number {
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i += 1) {
      const v = (this.buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.buf.length) * 4.5);
  }

  play(base64: string): void {
    const bin = atob(base64);
    const len = bin.length >> 1;
    const audio = this.ctx.createBuffer(1, len, this.sampleRate);
    const ch = audio.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const lo = bin.charCodeAt(i * 2);
      const hi = bin.charCodeAt(i * 2 + 1);
      let v = (hi << 8) | lo;
      if (v >= 0x8000) v -= 0x10000;
      ch[i] = v / 0x8000;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.gain);
    const start = Math.max(this.ctx.currentTime + 0.03, this.nextTime);
    src.start(start);
    this.nextTime = start + audio.duration;
    this.sources.add(src);
    setSpeaking(true);
    window.clearTimeout(this.idleTimer);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) {
        this.idleTimer = window.setTimeout(() => setSpeaking(false), 250);
      }
    };
  }

  isPlaying(): boolean {
    return this.sources.size > 0;
  }

  /** Stops everything queued — used when the learner barges in. */
  interrupt(): void {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.nextTime = 0;
    setSpeaking(false);
  }

  async close(): Promise<void> {
    this.interrupt();
    setMouthSource(null);
    if (this.element) {
      this.element.pause();
      this.element.srcObject = null;
      this.element = null;
    }
    await this.ctx.close().catch(() => undefined);
  }
}
