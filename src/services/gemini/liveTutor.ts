import { EndSensitivity, Modality, StartSensitivity, Type, type LiveServerMessage, type Session } from '@google/genai';
import { getClient } from './client';
import { LIVE_MODEL_CANDIDATES } from './models';
import { startMic, type MicHandle } from '../audio/mic';
import { PcmPlayer } from '../audio/player';

export type CallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'reconnecting' | 'paused' | 'ended' | 'error';

export interface LiveTutorEvents {
  onState: (state: CallState, detail?: string) => void;
  /** Live caption of what the learner is saying (grows as they speak). */
  onUserCaption: (text: string) => void;
  /** Live caption of what the tutor is saying (grows as audio streams). */
  onTutorCaption: (text: string) => void;
  /** One full exchange finished. */
  onTurn: (turn: { user: string; tutor: string }) => void;
  onMicLevel: (level: number) => void;
  /** The tutor wants to show the learner a song/video (opened by the learner's tap — browsers block auto-opening). */
  onSong?: (song: { query: string; why: string }) => void;
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'show_song',
        description:
          'Shows the learner a button that opens a song or video on YouTube. Use it ONLY when the learner explicitly asks to hear a song or music video. You cannot play audio yourself.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'YouTube search query: song title and artist, e.g. "Bohemian Rhapsody Queen lyrics".' },
            why: { type: Type.STRING, description: 'One short line on why this song (in the learner\'s native language).' },
          },
          required: ['query'],
        },
      },
    ],
  },
];

export interface LiveTutorOptions {
  apiKey: string;
  model: string;
  voice: string;
  systemInstruction: string;
  opener: string;
  /** 'auto' = server voice-activity detection; 'tap' = the learner marks start/end of each turn. */
  turnMode: 'auto' | 'tap';
  /** Pause length (ms) that ends the learner's turn in auto mode. */
  silenceMs: number;
  /** BCP-47 codes the learner speaks (target + native), so captions aren't guessed as other languages. */
  languageCodes: string[];
}

/**
 * Owns one real-time voice call with Gemini Live: microphone in, tutor voice out,
 * barge-in, captions for both sides, and transparent reconnects (session resumption).
 */
const WORKING_KEY = 'lingo:v1:live-working';

type ConfigTier = 0 | 1 | 2;
interface Attempt {
  model: string;
  apiVersion?: string;
  tier: ConfigTier;
}

/** What the last successful call connected with — shown in Settings for troubleshooting. */
export const lastConnection = (): { model: string; songs: boolean; captionLanguages: boolean } | null => {
  try {
    const a = JSON.parse(localStorage.getItem(WORKING_KEY) ?? 'null') as Attempt | null;
    if (!a?.model || typeof a.tier !== 'number') return null;
    return { model: a.model, songs: a.tier < 2, captionLanguages: a.tier === 0 };
  } catch {
    return null;
  }
};
// Mic RMS that counts as the learner talking over the tutor (echo after cancellation is far quieter).
const BARGE_IN_LEVEL = 0.035;

export class LiveTutor {
  private session: Session | null = null;
  private mic: MicHandle | null = null;
  private player: PcmPlayer | null = null;
  private resumeHandle: string | undefined;
  private userText = '';
  private tutorText = '';
  private closedByUser = false;
  private model: string;
  private apiVersion: string | undefined;
  /** 0 = everything (tools, caption languages, long-call support), 1 = without caption languages, 2 = minimal. */
  private tier: ConfigTier = 0;
  private muted = false;
  private ready = false;
  private lastClose = '';
  /** In tap mode, mic audio is sent only between beginTurn() and endTurn(). */
  private talking = false;
  /** Short mic hold after a manual "your turn" nudge, so the stream really ends. */
  private holdMicUntil = 0;
  /**
   * While the app is in the background the phone's echo cancellation is less reliable, so the
   * mic is held back while the tutor is speaking — otherwise it hears (and imitates) its own voice.
   */
  private echoGuard = false;
  /** Keeps the gate open briefly after loud speech so a barge-in isn't chopped. */
  private bargeOpenUntil = 0;
  /** Re-sends a text turn through realtime input if the model ignored it (some models only answer that way). */
  private replyWatchdog = 0;
  /** Fires if the learner finished speaking but no reply started (e.g. after a long monologue). */
  private rescueTimer = 0;
  private rescued = false;

  constructor(private opts: LiveTutorOptions, private ev: LiveTutorEvents) {
    this.model = opts.model;
  }

  /** Model/API-version/config combinations to try, last working one first. */
  private attempts(): Attempt[] {
    const models = [...new Set([this.opts.model, ...LIVE_MODEL_CANDIDATES].filter(Boolean))];
    const list: Attempt[] = [];
    for (const model of models) {
      // The lean setup (tier 2) gives clearly better turn-taking: with the song tool and caption
      // language hints on, the model mis-hears the learner and flips between listening and speaking.
      // Song cards still come from the text model, so nothing is lost.
      list.push({ model, tier: 2 }, { model, apiVersion: 'v1alpha', tier: 2 });
    }
    try {
      const saved = JSON.parse(localStorage.getItem(WORKING_KEY) ?? 'null') as Attempt | null;
      if (saved?.model && saved.model === this.opts.model && saved.tier === 2) list.unshift(saved);
    } catch {
      /* ignore */
    }
    return list;
  }

  /** Tries each combination until one completes setup; reports the server's reason if all fail. */
  private async connectFirstWorking(): Promise<void> {
    const reasons: string[] = [];
    for (const a of this.attempts()) {
      this.model = a.model;
      this.apiVersion = a.apiVersion;
      this.tier = a.tier;
      this.lastClose = '';
      try {
        await this.connect(false);
        try {
          localStorage.setItem(WORKING_KEY, JSON.stringify(a));
        } catch {
          /* ignore */
        }
        return;
      } catch (e) {
        // The close event (with the server's reason) arrives just after the error event.
        await new Promise((r) => setTimeout(r, 400));
        const reason = this.lastClose || String((e as Error)?.message ?? e);
        reasons.push(`${a.model}${a.apiVersion ? ` (${a.apiVersion})` : ''}${a.tier ? ` tier${a.tier}` : ''}: ${reason}`);
        if (/API key|PERMISSION_DENIED|quota|RESOURCE_EXHAUSTED|429|billing/i.test(reason)) break;
      }
    }
    throw new Error(reasons.slice(-3).join(' | ') || 'Live connection failed');
  }

  async start(): Promise<void> {
    this.closedByUser = false;
    this.ev.onState('connecting');
    // Audio contexts must be created from the user's tap.
    this.player = new PcmPlayer();
    await this.player.resume();
    await this.connectFirstWorking();
    this.mic = await startMic(
      (data, level) => {
        if (this.opts.turnMode === 'tap' && !this.talking) return;
        const now = Date.now();
        if (now < this.holdMicUntil) return;
        if (this.player?.isPlaying() && this.opts.turnMode === 'auto') {
          // Echo gate: while the tutor speaks, only real speech close to the mic gets through
          // (so you can still interrupt), never the tutor's own voice leaking from the speaker —
          // hearing itself makes the native-audio model drift into a different voice.
          if (this.echoGuard) return;
          if (level >= BARGE_IN_LEVEL) this.bargeOpenUntil = now + 400;
          if (now > this.bargeOpenUntil) return;
        }
        this.session?.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } });
      },
      (lvl) => this.ev.onMicLevel(lvl),
    );
    this.mic.setMuted(this.muted);
    this.sendTurn(this.opts.opener);
  }

  /** Sends a text turn; if no reply starts within a few seconds, retries it as realtime text. */
  private sendTurn(text: string): void {
    this.session?.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
    window.clearTimeout(this.replyWatchdog);
    this.replyWatchdog = window.setTimeout(() => {
      if (!this.session) return;
      if (this.opts.turnMode === 'tap') this.session.sendRealtimeInput({ activityStart: {} });
      this.session.sendRealtimeInput({ text });
      if (this.opts.turnMode === 'tap') this.session.sendRealtimeInput({ activityEnd: {} });
    }, 6000);
  }

  private async connect(resuming: boolean): Promise<void> {
    const ai = getClient(this.opts.apiKey, this.apiVersion);
    this.ready = false;
    const base = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: this.opts.systemInstruction,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.voice } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig:
        this.opts.turnMode === 'tap'
          ? { automaticActivityDetection: { disabled: true } }
          : {
              automaticActivityDetection: {
                // Low start sensitivity: background noise or the tutor's own echo won't count as you talking.
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                // Low end sensitivity + a learner-friendly pause: thinking mid-sentence won't end your turn.
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 300,
                silenceDurationMs: this.opts.silenceMs,
              },
            },
    };
    const config =
      this.tier === 2
        ? base
        : {
            ...base,
            tools: this.ev.onSong ? TOOLS : undefined,
            ...(this.tier === 0 && this.opts.languageCodes.length
              ? { inputAudioTranscription: { languageCodes: this.opts.languageCodes } }
              : {}),
            contextWindowCompression: { slidingWindow: {} },
            sessionResumption: resuming && this.resumeHandle ? { handle: this.resumeHandle } : {},
          };
    this.session = await ai.live.connect({
      model: this.model,
      config,
      callbacks: {
        onmessage: (m) => this.handleMessage(m),
        onerror: (e) => {
          if (this.ready) this.ev.onState('error', e.message);
        },
        onclose: (e) => {
          this.lastClose = e.reason ? `${e.reason} (${e.code})` : `closed (${e.code})`;
          if (this.ready) void this.handleClose(e);
        },
      },
    });
    // connect() resolves only after the server confirmed setup.
    this.ready = true;
    this.ev.onState('listening');
  }

  private handleMessage(m: LiveServerMessage): void {
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = m.sessionResumptionUpdate.newHandle;
    }
    if (m.goAway) void this.reconnect();

    for (const call of m.toolCall?.functionCalls ?? []) {
      if (call.name === 'show_song') {
        const args = (call.args ?? {}) as { query?: string; why?: string };
        if (args.query) this.ev.onSong?.({ query: args.query, why: args.why ?? '' });
        this.session?.sendToolResponse({
          functionResponses: { id: call.id, name: call.name, response: { result: 'A button that opens this song on YouTube is now on the learner\'s screen. Tell them to tap it, and that the microphone will be muted while it plays.' } },
        });
      }
    }

    const sc = m.serverContent;
    if (!sc) return;

    if (sc.modelTurn || sc.outputTranscription) {
      window.clearTimeout(this.replyWatchdog);
      window.clearTimeout(this.rescueTimer);
    }

    if (sc.interrupted) {
      // Learner barged in — cut the tutor off immediately.
      this.player?.interrupt();
      this.ev.onState('listening');
    }
    if (sc.inputTranscription?.text && this.opts.turnMode === 'auto' && !this.player?.isPlaying()) {
      this.ev.onState('listening');
    }
    if (sc.inputTranscription?.text) {
      this.userText += sc.inputTranscription.text;
      this.ev.onUserCaption(this.userText.trim());
      this.rescued = false;
      this.armRescue(this.opts.silenceMs + 6000);
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
      if (!turn.tutor && turn.user) {
        // The model closed the turn without answering — keep what the learner said and ask again.
        this.rescue();
        return;
      }
      this.userText = '';
      this.tutorText = '';
      window.clearTimeout(this.rescueTimer);
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

  /** A turn from the app itself (not the learner's words) that the tutor should react to out loud. */
  sendAppTurn(text: string): void {
    this.player?.interrupt();
    this.sendTurn(text);
  }

  /** Typed message from the chat panel, answered by voice in the same call. */
  sendText(text: string): void {
    this.player?.interrupt();
    this.userText = text;
    this.sendTurn(text);
  }

  /** Tap mode: learner starts talking (also cuts the tutor off). */
  beginTurn(): void {
    if (!this.session) return;
    this.player?.interrupt();
    this.talking = true;
    this.session.sendRealtimeInput({ activityStart: {} });
    this.ev.onState('listening');
  }

  /** Tap mode: learner finished — the tutor answers right away. */
  endTurn(): void {
    if (!this.session || !this.talking) return;
    this.talking = false;
    this.session.sendRealtimeInput({ activityEnd: {} });
    this.ev.onState('thinking');
    this.armRescue(7000);
  }

  /** Auto mode: "I'm done, your turn" — closes the audio stream so the tutor replies now. */
  nudge(): void {
    if (!this.session) return;
    this.holdMicUntil = Date.now() + 400;
    this.session.sendRealtimeInput({ audioStreamEnd: true });
    this.ev.onState('thinking');
    // If closing the audio stream isn't enough, send the words as text a moment later.
    this.armRescue(2500);
  }

  private armRescue(ms: number): void {
    window.clearTimeout(this.rescueTimer);
    if (this.opts.turnMode === 'tap' && this.talking) return;
    this.rescueTimer = window.setTimeout(() => this.rescue(), ms);
  }

  /** Makes sure the tutor answers: re-sends the learner's transcribed words as a text turn (once per turn). */
  private rescue(): void {
    window.clearTimeout(this.rescueTimer);
    const said = this.userText.trim();
    if (!this.session || this.rescued || this.player?.isPlaying()) return;
    this.rescued = true;
    this.ev.onState('thinking');
    this.sendTurn(
      said
        ? `(The learner just said: "${said.slice(-1200)}". You haven't answered yet — reply to it now, naturally and briefly.)`
        : "(The learner finished speaking. Reply to what they said, naturally and briefly.)",
    );
  }

  setBackground(background: boolean): void {
    this.echoGuard = background;
  }

  /** Called when the app returns to the foreground: resume audio the OS may have suspended. */
  async wake(): Promise<void> {
    this.echoGuard = false;
    await this.player?.resume().catch(() => undefined);
    await this.mic?.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Silent instruction to the tutor mid-call (e.g. switching explanation language). */
  sendInstruction(text: string): void {
    this.session?.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: false });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.mic?.setMuted(muted);
    if (muted) this.session?.sendRealtimeInput({ audioStreamEnd: true });
  }

  async stop(finalState: CallState = 'ended'): Promise<void> {
    this.closedByUser = true;
    window.clearTimeout(this.replyWatchdog);
    window.clearTimeout(this.rescueTimer);
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
    this.ev.onState(finalState);
  }
}
