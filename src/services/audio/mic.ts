// Captures the microphone and emits 16 kHz mono 16-bit PCM chunks (base64) for Gemini Live.

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.acc = []; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    // Simple decimation with averaging to 16 kHz.
    while (this.pos < ch.length) {
      const a = Math.floor(this.pos), b = Math.min(ch.length - 1, Math.floor(this.pos + this.ratio));
      let s = 0, n = 0;
      for (let k = a; k <= b; k++) { s += ch[k]; n++; }
      this.acc.push(s / n);
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    if (this.acc.length >= 1600) {
      const out = new Int16Array(this.acc.length);
      for (let i = 0; i < this.acc.length; i++) {
        const v = Math.max(-1, Math.min(1, this.acc[i]));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      this.port.postMessage({ pcm: out.buffer, level: Math.sqrt(sum / ch.length) }, [out.buffer]);
      this.acc = [];
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export interface MicHandle {
  setMuted: (muted: boolean) => void;
  /** Wakes the capture graph if the OS suspended it while the app was in the background. */
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

export const startMic = async (
  onChunk: (base64: string) => void,
  onLevel: (level: number) => void,
): Promise<MicHandle> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-capture');
  let muted = false;
  node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
    onLevel(muted ? 0 : e.data.level);
    if (!muted) onChunk(toBase64(e.data.pcm));
  };
  source.connect(node);
  // Keep the graph pulled without sending mic audio to the speakers.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink);
  sink.connect(ctx.destination);

  return {
    resume: async () => {
      if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    },
    setMuted: (m) => {
      muted = m;
      stream.getAudioTracks().forEach((t) => (t.enabled = !m));
    },
    stop: async () => {
      stream.getTracks().forEach((t) => t.stop());
      node.port.onmessage = null;
      await ctx.close().catch(() => undefined);
    },
  };
};
