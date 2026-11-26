import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { SCENARIOS, langInfo, tutorInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { useLearnerMemory } from '../../hooks/useLearnerMemory';
import { useCallMediaSession } from '../../hooks/useCallMediaSession';
import { useSpeaking } from '../../hooks/useSpeaking';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useTutorVoice } from '../../hooks/useTutorVoice';
import { useFeedbackMutation, useSummarizeMutation, useTutorTurnMutation, type AiError } from '../../features/ai/aiApi';
import { updateProfile } from '../../features/profile/profileSlice';
import { addMinutes, addMistake, addXp, saveWord } from '../../features/progress/progressSlice';
import { addMessage, setSummary, setView, updateMessage } from '../../features/session/sessionSlice';
import { LiveTutor, type CallState } from '../../services/gemini/liveTutor';
import { buildLiveInstruction } from '../../services/tutorPrompt';
import { isAndroidApp, onBackgroundCallAction, pingBackgroundCall, startBackgroundCall, stopBackgroundCall } from '../../services/nativeCall';
import { stopSpeaking } from '../../services/speech';
import type { ChatMessage, ExplainMode, Level, NewWord, Profile, ThinkTime, TurnMode } from '../../types';
import ApiKeyForm from '../ApiKeyForm';
import Avatar from '../Avatar';
import TutorPortrait from '../TutorPortrait';
import ChatPanel from '../ChatPanel';
import ExplainToggle from '../ExplainToggle';
import FeedbackCard from '../FeedbackCard';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Call.module.css';

const uid = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Mode = 'voice' | 'text';

const SILENCE_MS: Record<ThinkTime, number> = { short: 700, normal: 1100, long: 1700 };
/** Beginners pause mid-sentence to find words — give them extra time before the turn ends. */
const LEVEL_EXTRA_MS: Partial<Record<Level, number>> = { A1: 600, A2: 300 };
const silenceFor = (p: Profile): number => SILENCE_MS[p.thinkTime] + (LEVEL_EXTRA_MS[p.level] ?? 0);

const Call: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const say = useTutorVoice();
  const profile = useAppSelector((st) => st.profile.data);
  const { messages, scenarioId, startedAt } = useAppSelector((st) => st.session);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const cards = useAppSelector((st) => st.progress.cards);
  const [chatTurn, { isLoading: chatLoading }] = useTutorTurnMutation();
  const [feedback] = useFeedbackMutation();
  const [summarize, { isLoading: summarizing }] = useSummarizeMutation();

  const audioPlaying = useSpeaking();
  const [mode, setMode] = useState<Mode>('voice');
  const [callState, setCallState] = useState<CallState>('idle');
  const [userCaption, setUserCaption] = useState('');
  const [tutorCaption, setTutorCaption] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tapTalking, setTapTalking] = useState(false);
  const [thinkingHint, setThinkingHint] = useState(false);
  const [song, setSong] = useState<{ query: string; why: string } | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  const tutorRef = useRef<LiveTutor | null>(null);
  const typedRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const memory = useLearnerMemory();
  const memoryRef = useRef(memory);
  memoryRef.current = memory;

  const scenario = SCENARIOS.find((sc) => sc.id === scenarioId) ?? SCENARIOS[0];
  const tutor = tutorInfo(profile.tutor);
  const target = langInfo(profile.target);
  const nativeRtl = langInfo(profile.native).rtl;
  const isHe = profile.native === 'he';
  const lastTutor = [...messages].reverse().find((m) => m.role === 'tutor');
  const savedWords = cards.filter((c) => c.lang === profile.target).map((c) => c.word.toLowerCase());

  const errorText = useCallback(
    (e: AiError | undefined): string =>
      e?.code === 'rate_limited' ? s.rateLimited : e?.code === 'bad_key' || e?.code === 'no_key' ? s.badKey : s.aiError,
    [s],
  );

  /** Adds written feedback (translation, correction, words) to a tutor message. */
  const enrich = useCallback(
    async (messageId: string, learner: string, tutorText: string) => {
      const res = await feedback({ profile: profileRef.current, learner, tutor: tutorText });
      if ('data' in res && res.data) {
        dispatch(updateMessage({ id: messageId, patch: { turn: res.data, pending: false } }));
        // Backup for the song tool: the feedback model also spots song requests.
        if (res.data.song) setSong(res.data.song);
        if (res.data.correction) dispatch(addMistake({ correction: res.data.correction, lang: profileRef.current.target }));
      } else {
        dispatch(updateMessage({ id: messageId, patch: { pending: false } }));
      }
    },
    [dispatch, feedback],
  );

  // ---------- Voice call ----------
  const startCall = useCallback(async (openerOverride?: string, modeJustChanged = false) => {
    if (!profileRef.current.apiKey) return;
    setNotice(null);
    const p = profileRef.current;
    const live = new LiveTutor(
      {
        apiKey: p.apiKey,
        model: p.liveModel,
        voice: tutorInfo(p.tutor).voice,
        systemInstruction: buildLiveInstruction(p, scenario, memoryRef.current, messagesRef.current, modeJustChanged),
        turnMode: p.turnMode,
        silenceMs: silenceFor(p),
        languageCodes: [langInfo(p.target).speech, langInfo(p.native).speech],
        refreshInstruction: () => buildLiveInstruction(profileRef.current, scenario, memoryRef.current, messagesRef.current),
        opener: openerOverride ?? (messagesRef.current.length
          ? '(The learner is back after a short break. Welcome them back in one short sentence and continue the conversation right where it stopped.)'
          : `(${p.name || 'The learner'} just joined the call. Greet them warmly by name and open the activity.)`),
      },
      {
        onState: (st, detail) => {
          setCallState(st);
          if (st === 'error' && detail) setNotice(/429|quota|exhaust/i.test(detail) ? s.rateLimited : `${s.callError} · ${detail}`);
        },
        onUserCaption: setUserCaption,
        onTutorCaption: (t) => {
          setTutorCaption(t);
          setShowTranslation(false);
        },
        onMicLevel: setMicLevel,
        onSong: setSong,
        onTurn: ({ user, tutor: tutorText }) => {
          if (user && !typedRef.current) {
            dispatch(addMessage({ id: uid(), role: 'user', text: user, via: 'voice' }));
            dispatch(addXp(5));
          }
          typedRef.current = false;
          const id = uid();
          dispatch(addMessage({ id, role: 'tutor', text: tutorText, via: 'voice', pending: true }));
          setUserCaption('');
          void enrich(id, user, tutorText);
        },
      },
    );
    tutorRef.current = live;
    try {
      await live.start();
    } catch (e) {
      await live.stop();
      tutorRef.current = null;
      const msg = String((e as Error)?.message ?? e);
      if (/permission|denied|notallowed|getUserMedia|audio/i.test(msg)) {
        setMode('text');
        setChatOpen(true);
        setNotice(s.micDenied);
      } else {
        setCallState('error');
        setNotice(/API key|401|403/i.test(msg) ? s.badKey : `${s.callError} · ${msg}`);
      }
    }
  }, [dispatch, enrich, s, scenario]);

  // Start once on open; hang up on leave.
  useEffect(() => {
    if (profile.apiKey) void startCall();
    return () => {
      void tutorRef.current?.stop();
      tutorRef.current = null;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browsers suspend the mic of a hidden page, so background calls need the Android app's service.
  const canRunInBackground = (): boolean => profileRef.current.backgroundCall && isAndroidApp();

  // Leaving the app: in background mode the call simply continues (like a phone call);
  // otherwise hang up cleanly and offer to resume (the transcript is saved either way).
  useEffect(() => {
    const handleVisibility = (): void => {
      const t = tutorRef.current;
      if (!t) return;
      if (document.visibilityState === 'visible') {
        void t.wake();
        return;
      }
      if (canRunInBackground()) {
        t.setBackground(true);
        return;
      }
      tutorRef.current = null;
      void t.stop('paused');
    };
    const handlePageHide = (): void => {
      const t = tutorRef.current;
      if (!t || canRunInBackground()) return;
      tutorRef.current = null;
      void t.stop('paused');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(
    () => () => {
      const mins = Math.min(30, (Date.now() - startedAt) / 60000);
      if (mins > 0.2) dispatch(addMinutes(mins));
    },
    [dispatch, startedAt],
  );

  // ---------- Text chat (typed) ----------
  const requestTextTurn = useCallback(
    async (history: ChatMessage[]) => {
      const res = await chatTurn({ profile: profileRef.current, scenario, history, memory: memoryRef.current });
      if ('data' in res && res.data) {
        dispatch(addMessage({ id: uid(), role: 'tutor', text: res.data.reply, via: 'text', turn: res.data }));
        if (res.data.song) setSong(res.data.song);
        if (res.data.correction) dispatch(addMistake({ correction: res.data.correction, lang: profileRef.current.target }));
        if (profileRef.current.autoSpeak) say(res.data.reply);
      } else {
        setNotice(errorText('error' in res ? (res.error as AiError) : undefined));
      }
    },
    [chatTurn, dispatch, errorText, say, scenario],
  );

  // Text-only mode opens the conversation itself.
  useEffect(() => {
    if (mode === 'text' && messages.length === 0 && profile.apiKey) void requestTextTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleSend = (text: string): void => {
    const msg: ChatMessage = { id: uid(), role: 'user', text, via: 'text' };
    dispatch(addMessage(msg));
    dispatch(addXp(5));
    const live = tutorRef.current;
    if (live && (callState === 'listening' || callState === 'speaking' || callState === 'thinking')) {
      typedRef.current = true;
      live.sendText(text);
    } else {
      stopSpeaking();
      void requestTextTurn([...messages, msg]);
    }
  };

  /** The explanation language lives in the system instruction, so switching reconnects with the transcript. */
  const handleExplainMode = async (explainMode: ExplainMode): Promise<void> => {
    if (explainMode === profileRef.current.explainMode || switchingMode) return;
    setSwitchingMode(true);
    dispatch(updateProfile({ explainMode }));
    profileRef.current = { ...profileRef.current, explainMode };
    const t = tutorRef.current;
    if (!t) {
      setSwitchingMode(false);
      return;
    }
    tutorRef.current = null;
    setTapTalking(false);
    await t.stop('connecting');
    const native = langInfo(profileRef.current.native).name;
    const target = langInfo(profileRef.current.target).name;
    await startCall(
      explainMode === 'mixed'
        ? `(The learner switched ON ${native} explanations. Do not greet again. Start right away by explaining your last message briefly in ${native} — what it meant and any useful word in it — then ask your question again in ${target}. Keep explaining in ${native} like this from now on.)`
        : `(The learner switched to ${target} ONLY. Do not greet again and do not speak ${native} at all from now on — not even for explanations. Briefly repeat your last question in simple ${target} and continue.)`,
      true,
    );
    setSwitchingMode(false);
  };

  /** Switching turn mode needs a new Live session; the transcript carries the conversation over. */
  const handleTurnMode = async (turnMode: TurnMode): Promise<void> => {
    if (turnMode === profileRef.current.turnMode) return;
    dispatch(updateProfile({ turnMode }));
    profileRef.current = { ...profileRef.current, turnMode };
    setTapTalking(false);
    const t = tutorRef.current;
    if (!t) return;
    tutorRef.current = null;
    await t.stop('connecting');
    await startCall('(Same call, just reconnected. Do not greet again. Continue naturally from the last message, briefly repeating your last question if needed.)');
  };

  const handleTapTalk = (): void => {
    const t = tutorRef.current;
    if (!t) return;
    if (tapTalking) {
      t.endTurn();
      setTapTalking(false);
    } else {
      t.beginTurn();
      setTapTalking(true);
    }
  };

  const handleNudge = (): void => {
    tutorRef.current?.nudge();
    setThinkingHint(true);
  };

  const silenceMs = silenceFor(profile);

  // Auto mode: once you stop talking and the tutor hasn't started yet, show "thinking" instead of "listening".
  useEffect(() => {
    if (!userCaption || profile.turnMode !== 'auto') return undefined;
    setThinkingHint(false);
    const timer = window.setTimeout(() => setThinkingHint(true), silenceMs + 250);
    return () => window.clearTimeout(timer);
  }, [userCaption, profile.turnMode, silenceMs]);

  useEffect(() => {
    if (audioPlaying) setThinkingHint(false);
  }, [audioPlaying]);

  const handleMute = (): void => {
    const next = !muted;
    setMuted(next);
    tutorRef.current?.setMuted(next);
  };

  const handleSaveWord = (word: NewWord): void => {
    dispatch(saveWord({ word, lang: profile.target }));
  };

  const handleApplyLevel = (level: Level): void => {
    dispatch(updateProfile({ level }));
  };

  const handleEnd = async (): Promise<void> => {
    await tutorRef.current?.stop();
    tutorRef.current = null;
    stopSpeaking();
    const userTurns = messages.filter((m) => m.role === 'user').length;
    if (userTurns < 2) {
      dispatch(setView('home'));
      return;
    }
    const res = await summarize({ profile, history: messages });
    if ('data' in res && res.data) {
      dispatch(addXp(res.data.xp));
      dispatch(setSummary(res.data));
    } else {
      dispatch(setView('home'));
    }
  };

  const live = callState === 'listening' || callState === 'speaking' || callState === 'thinking';
  // The model finishes generating before its audio finishes playing, so trust the speaker.
  const shownState: CallState = live
    ? audioPlaying
      ? 'speaking'
      : tapTalking
        ? 'listening'
        : callState === 'thinking' || thinkingHint
          ? 'thinking'
          : profile.turnMode === 'tap'
            ? 'idle'
            : 'listening'
    : callState;
  const statusLabel: Record<CallState, string> = {
    idle: profile.turnMode === 'tap' && live ? s.tapToSpeak : s.callConnecting,
    thinking: s.callThinking,
    connecting: s.callConnecting,
    listening: muted ? s.mute : s.callListening,
    speaking: s.callSpeaking,
    reconnecting: s.callReconnecting,
    paused: s.callPaused,
    ended: s.endCall,
    error: s.callError,
  };
  useWakeLock(live);

  // Android app: a foreground service keeps the mic alive while you use other apps.
  const backgroundActive = live && mode === 'voice' && profile.backgroundCall && isAndroidApp();
  const actionsRef = useRef({ handleMute, handleEnd });
  actionsRef.current = { handleMute, handleEnd };
  useEffect(() => {
    if (!backgroundActive) return undefined;
    return onBackgroundCallAction((action) => {
      if (action === 'mute') {
        actionsRef.current.handleMute();
        return;
      }
      // Hang up immediately (mic off, socket closed); the summary is prepared after that.
      const t = tutorRef.current;
      tutorRef.current = null;
      void (t ? t.stop() : Promise.resolve()).then(() => actionsRef.current.handleEnd());
    });
  }, [backgroundActive]);
  useEffect(() => {
    if (!backgroundActive) return;
    void startBackgroundCall({
      title: tutor.name,
      text: muted ? s.mute : s.backgroundNotice,
      tutor: tutor.id,
      muted,
      muteLabel: s.mute,
      unmuteLabel: s.unmute,
      hangupLabel: s.endCall,
    });
  }, [backgroundActive, muted, tutor.name, tutor.id, s]);
  useEffect(() => {
    if (!backgroundActive) return undefined;
    const beat = window.setInterval(pingBackgroundCall, 5000);
    return () => {
      window.clearInterval(beat);
      void stopBackgroundCall();
    };
  }, [backgroundActive]);
  // Leaving the call screen for any reason always clears the notification.
  useEffect(() => () => void stopBackgroundCall(), []);
  useCallMediaSession({
    active: live && mode === 'voice',
    title: `${tutor.name} · Lingo`,
    subtitle: scenario.title[isHe ? 'he' : 'en'],
    artwork: `./avatars/${tutor.id}-poster.jpg`,
    muted,
    onToggleMute: handleMute,
    onHangUp: () => void handleEnd(),
  });

  const caption = tutorCaption || lastTutor?.text || '';
  const captionTurn = !tutorCaption || tutorCaption === lastTutor?.text ? lastTutor?.turn : undefined;
  const mood = callState === 'connecting' || chatLoading ? 'thinking' : lastTutor?.turn?.mood ?? 'happy';

  if (!profile.apiKey) {
    return (
      <div className={styles.noKey}>
        <Avatar tutor={profile.tutor} size={150} mood="thinking" />
        <h2>{s.noKeyTitle}</h2>
        <ApiKeyForm initialKey="" onValid={(apiKey) => { dispatch(updateProfile({ apiKey })); dispatch(setView('home')); }} />
        <button type="button" className={clsx(ui.btn, ui.ghost)} onClick={() => dispatch(setView('home'))}>{s.backHome}</button>
      </div>
    );
  }

  return (
    <div
      className={styles.wrap}
      style={profile.videoAvatar && tutor.videoBg ? { ['--stage' as string]: tutor.videoBg } : undefined}
    >
      <header className={styles.header}>
        <button type="button" className={styles.topBtn} aria-label={s.back} onClick={() => void handleEnd()}>
          <span className={styles.flip}><Icon name="back" /></span>
        </button>
        <div className={styles.title}>
          <strong>{tutor.name}</strong>
          <small>{scenario.title[isHe ? 'he' : 'en']} · {isHe ? target.he : target.name} {profile.level}</small>
        </div>
        {mode === 'voice' && (
          <span className={clsx(styles.status, styles[shownState])}>
            <i />
            {statusLabel[shownState]}
          </span>
        )}
      </header>

      <div className={styles.modeRow}>
        {mode === 'voice' && (
          <div className={styles.turnToggle} role="radiogroup" aria-label={s.turnModeLabel}>
            {([['auto', s.turnAutoShort], ['tap', s.turnTapShort]] as [TurnMode, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={profile.turnMode === id}
                className={clsx(styles.turnOpt, profile.turnMode === id && styles.turnOn)}
                onClick={() => void handleTurnMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <ExplainToggle
          value={profile.explainMode}
          native={profile.native}
          target={profile.target}
          label={s.explainLabel}
          onChange={(m) => void handleExplainMode(m)}
          disabled={switchingMode}
        />
      </div>

      <div className={styles.stage}>
        <div
          className={clsx(styles.ring, shownState === 'listening' && !muted && styles.ringOn)}
          style={{ ['--lvl' as string]: Math.min(1, micLevel * 6).toFixed(2) }}
        >
          <TutorPortrait tutor={profile.tutor} mood={mood} size={220} live />
        </div>
      </div>

      <div className={styles.captions}>
        {mode === 'voice' && (callState === 'paused' || (callState === 'error' && messages.length > 0)) && (
          <div className={styles.pausedCard}>
            <strong>{callState === 'paused' ? s.pausedTitle : s.callError}</strong>
            <p>{s.pausedBody}</p>
            <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => void startCall()}>
              <Icon name="phone" size={20} /> {s.resumeCall}
            </button>
          </div>
        )}
        {caption && (
          <p className={styles.tutorCaption} dir={target.rtl ? 'rtl' : 'ltr'}>{caption}</p>
        )}
        {showTranslation && captionTurn?.translation && (
          <p className={styles.translation} dir={nativeRtl ? 'rtl' : 'ltr'}>{captionTurn.translation}</p>
        )}
        {captionTurn?.translation && (
          <button type="button" className={styles.translateBtn} onClick={() => setShowTranslation((v) => !v)}>
            <Icon name="translate" size={16} /> {showTranslation ? s.hideTranslation : s.translate}
          </button>
        )}
        {userCaption && (
          <p className={styles.userCaption} dir="auto"><span>{s.youSaid}</span> {userCaption}</p>
        )}
        {!caption && !userCaption && live && (
          <>
            <p className={styles.hint}>{profile.turnMode === 'tap' ? s.tapModeHint : s.tapToTalk}</p>
            <p className={styles.hint}>{s.songTip}</p>
          </>
        )}
        {song && (
          <div className={styles.song}>
            <Icon name="music" size={22} />
            <span className={styles.songText}>
              <strong dir="auto">{song.query}</strong>
              {song.why && <small dir="auto">{song.why}</small>}
            </span>
            <a
              className={styles.songBtn}
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(song.query)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                // Mute so the tutor doesn't "hear" the song; unmute when you're back.
                if (!muted) handleMute();
              }}
            >
              {s.openSong}
            </a>
            <button type="button" className={styles.songClose} aria-label={s.closeChat} onClick={() => setSong(null)}>✕</button>
          </div>
        )}
        {captionTurn && (
          <FeedbackCard
            turn={captionTurn}
            targetRtl={target.rtl}
            nativeRtl={nativeRtl}
            savedWords={savedWords}
            onSaveWord={handleSaveWord}
            onSpeakWord={(w) => say(w)}
          />
        )}
        {notice && (
          <div className={styles.notice}>
            <p>{notice}</p>
            {mode === 'voice' && callState === 'error' && messages.length === 0 && (
              <button type="button" className={ui.btn} onClick={() => void startCall()}>{s.callRetry}</button>
            )}
          </div>
        )}
      </div>

      <footer className={styles.controls}>
        <button type="button" className={clsx(styles.ctrl, chatOpen && styles.ctrlOn)} onClick={() => setChatOpen((v) => !v)}>
          <Icon name="chat" />
          <span>{s.openChat}</span>
        </button>
        {mode === 'voice' && profile.turnMode === 'tap' && (
          <button
            type="button"
            className={clsx(styles.ctrl, styles.talk, tapTalking && styles.talkOn)}
            onClick={handleTapTalk}
            disabled={!live}
            aria-pressed={tapTalking}
          >
            <Icon name={tapTalking ? 'check' : 'mic'} />
            <span>{tapTalking ? s.doneTalking : s.tapToSpeak}</span>
          </button>
        )}
        {mode === 'voice' && profile.turnMode === 'auto' && (
          <button type="button" className={clsx(styles.ctrl, muted && styles.ctrlOn)} onClick={handleMute} disabled={!live} aria-pressed={muted}>
            <Icon name={muted ? 'micOff' : 'mic'} />
            <span>{muted ? s.unmute : s.mute}</span>
          </button>
        )}
        {mode === 'voice' && profile.turnMode === 'auto' && (
          <button type="button" className={clsx(styles.ctrl, styles.turnBtn)} onClick={handleNudge} disabled={!live || audioPlaying}>
            <Icon name="send" />
            <span>{s.yourTurnShort}</span>
          </button>
        )}
        <button type="button" className={clsx(styles.ctrl, styles.hang)} onClick={() => void handleEnd()} disabled={summarizing}>
          <Icon name="phoneOff" />
          <span>{summarizing ? s.thinking : s.endCall}</span>
        </button>
      </footer>

      {chatOpen && (
        <ChatPanel
          messages={messages}
          busy={chatLoading || summarizing}
          targetRtl={target.rtl}
          nativeRtl={nativeRtl}
          savedWords={savedWords}
          suggestions={lastTutor?.turn?.suggestions ?? []}
          closable={mode === 'voice'}
          onClose={() => setChatOpen(false)}
          onSend={handleSend}
          onSpeak={say}
          onSaveWord={handleSaveWord}
          onApplyLevel={handleApplyLevel}
        />
      )}
    </div>
  );
};

export default Call;
