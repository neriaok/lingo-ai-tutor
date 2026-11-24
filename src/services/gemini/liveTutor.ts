import { Modality, type LiveServerMessage, type Session } from '@google/genai';
import { getClient } from './client';
import { FALLBACK_LIVE_MODEL } from './models';
import { startMic, type MicHandle } from '../audio/mic';
import { PcmPlayer } from '../audio/player';

export type CallState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'ended' | 'error';

export interface LiveTutorEvents {
  onState: (state: CallState, detail?: string) => void;
  /** Live caption of what the learner is saying (grows as they speak). */
  onUserCaption: (text: string) => void;
  /** Live caption of what the tutor is saying (grows as audio streams). */
  onTutorCaption: (text: string) => void;
  /** One full exchange finished. */
  onTurn: (turn: { user: string; tutor: string }) => void;
  onMicLevel: (level: number) => void;
}

export interface LiveTutorOptions {
  apiKey: string;
  model: string;
  voice: string;
  systemInstruction: string;
  opener: string;
}

/**
 * Owns one real-time voice call with Gemini Live: microphone in, tutor voice out,
 * barge-in, captions for both sides, and transparent reconnects (session resumption).
 */
export class LiveTutor {
  private session: Session | null = null;
  private mic: MicHandle | null = null;
  private player: PcmPlayer | null = null;
  private resumeHandle: string | undefined;
  private userText = '';
  private tutorText = '';
  private closedByUser = false;
  private model: string;
  private muted = false;

  constructor(private opts: LiveTutorOptions, private ev: LiveTutorEvents) {
    this.model = opts.model;
  }

  async start(): Promise<void> {
    this.closedByUser = false;
    this.ev.onState('connecting');
    // Audio contexts must be created from the user's tap.
    this.player = new PcmPlayer();
    await this.player.resume();
    try {
      await this.connect(false);
    } catch (e) {
      if (this.model !== FALLBACK_LIVE_MODEL && /not found|404|not supported/i.test(String((e as Error)?.message ?? e))) {
        this.model = FALLBACK_LIVE_MODEL;
        await this.connect(false);
      } else {
        throw e;
      }
    }
    this.mic = await startMic(
      (data) => this.session?.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }),
      (lvl) => this.ev.onMicLevel(lvl),
    );
    this.mic.setMuted(this.muted);
    this.session?.sendClientContent({ turns: [{ role: 'user', parts: [{ text: this.opts.opener }] }], turnComplete: true });
  }

  private async connect(resuming: boolean): Promise<void> {
    const ai = getClient(this.opts.apiKey);
    this.session = await ai.live.connect({
      model: this.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.opts.systemInstruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.voice } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: resuming && this.resumeHandle ? { handle: this.resumeHandle } : {},
      },
      callbacks: {
        onopen: () => this.ev.onState('listening'),
        onmessage: (m) => this.handleMessage(m),
        onerror: (e) => this.ev.onState('error', e.message),
        onclose: (e) => void this.handleClose(e),
      },
    });
  }

  private handleMessage(m: LiveServerMessage): void {
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = m.sessionResumptionUpdate.newHandle;
    }
    if (m.goAway) void this.reconnect();

    const sc = m.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      // Learner barged in — cut the tutor off immediately.
      this.player?.interrupt();
      this.ev.onState('listening');
    }
    if (sc.inputTranscription?.text) {
      this.userText += sc.inputTranscription.text;
      this.ev.onUserCaption(this.userText.trim());
    }
    if (sc.outputTranscription?.text) {
      this.tutorText += sc.outputTranscription.text;
      this.ev.onTutorCaption(this.tutorText.trim());
    }
    for (const part of sc.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
        this.player?.play(part.inlineData.data);
        this.ev.onState('speaking');
      }
    }
    if (sc.turnComplete) {
      const turn = { user: this.userText.trim(), tutor: this.tutorText.trim() };
      this.userText = '';
      this.tutorText = '';
      if (turn.tutor) this.ev.onTurn(turn);
      this.ev.onState('listening');
    }
  }

  private async handleClose(e: CloseEvent): Promise<void> {
    if (this.closedByUser) return;
    if (this.resumeHandle) {
      await this.reconnect();
      return;
    }
    this.ev.onState('error', e.reason || `closed (${e.code})`);
  }

  private async reconnect(): Promise<void> {
    if (this.closedByUser) return;
    this.ev.onState('reconnecting');
    const old = this.session;
    this.session = null;
    try {
      old?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.connect(true);
    } catch (err) {
      this.ev.onState('error', String((err as Error)?.message ?? err));
    }
  }

  /** Typed message from the chat panel, answered by voice in the same call. */
  sendText(text: string): void {
    this.player?.interrupt();
    this.userText = text;
    this.session?.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.mic?.setMuted(muted);
    if (muted) this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }

  async stop(): Promise<void> {
    this.closedByUser = true;
    await this.mic?.stop();
    this.mic = null;
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    await this.player?.close();
    this.player = null;
    this.ev.onState('ended');
  }
}
