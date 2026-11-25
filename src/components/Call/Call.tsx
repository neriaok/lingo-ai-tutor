import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { SCENARIOS, langInfo, tutorInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { useLearnerMemory } from '../../hooks/useLearnerMemory';
import { useSpeaking } from '../../hooks/useSpeaking';
import { useTutorVoice } from '../../hooks/useTutorVoice';
import { useFeedbackMutation, useSummarizeMutation, useTutorTurnMutation, type AiError } from '../../features/ai/aiApi';
import { updateProfile } from '../../features/profile/profileSlice';
import { addMinutes, addMistake, addXp, saveWord } from '../../features/progress/progressSlice';
import { addMessage, setSummary, setView, updateMessage } from '../../features/session/sessionSlice';
import { LiveTutor, type CallState } from '../../services/gemini/liveTutor';
import { buildLiveInstruction, explainRule } from '../../services/tutorPrompt';
import { stopSpeaking } from '../../services/speech';
import type { ChatMessage, ExplainMode, Level, NewWord, ThinkTime } from '../../types';
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
        if (res.data.correction) dispatch(addMistake({ correction: res.data.correction, lang: profileRef.current.target }));
      } else {
        dispatch(updateMessage({ id: messageId, patch: { pending: false } }));
      }
    },
    [dispatch, feedback],
  );

  // ---------- Voice call ----------
  const startCall = useCallback(async () => {
    if (!profileRef.current.apiKey) return;
    setNotice(null);
    const p = profileRef.current;
    const live = new LiveTutor(
      {
        apiKey: p.apiKey,
        model: p.liveModel,
        voice: tutorInfo(p.tutor).voice,
        systemInstruction: buildLiveInstruction(p, scenario, memoryRef.current, messagesRef.current),
        turnMode: p.turnMode,
        silenceMs: SILENCE_MS[p.thinkTime],
        opener: messagesRef.current.length
          ? '(The learner is back after a short break. Welcome them back in one short sentence and continue the conversation right where it stopped.)'
          : `(${p.name || 'The learner'} just joined the call. Greet them warmly by name and open the activity.)`,
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

  // Phone call, app switch or screen lock: hang up cleanly and offer to resume (transcript is saved).
  useEffect(() => {
    const handleHidden = (): void => {
      if (document.visibilityState !== 'hidden' || !tutorRef.current) return;
      const t = tutorRef.current;
      tutorRef.current = null;
      void t.stop('paused');
    };
    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', handleHidden);
    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', handleHidden);
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

  const handleExplainMode = (explainMode: ExplainMode): void => {
    dispatch(updateProfile({ explainMode }));
    const rule = explainRule({ ...profileRef.current, explainMode });
    tutorRef.current?.sendInstruction(`(The learner just changed a setting. ${rule} Apply it from your next sentence on, without commenting on the change.)`);
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

  // Auto mode: once you stop talking and the tutor hasn't started yet, show "thinking" instead of "listening".
  useEffect(() => {
    if (!userCaption || profile.turnMode !== 'auto') return undefined;
    setThinkingHint(false);
    const timer = window.setTimeout(() => setThinkingHint(true), SILENCE_MS[profile.thinkTime] + 250);
    return () => window.clearTimeout(timer);
  }, [userCaption, profile.turnMode, profile.thinkTime]);

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
        <ExplainToggle
          value={profile.explainMode}
          native={profile.native}
          target={profile.target}
          label={s.explainLabel}
          onChange={handleExplainMode}
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
        {!caption && !userCaption && live && <p className={styles.hint}>{profile.turnMode === 'tap' ? s.tapModeHint : s.tapToTalk}</p>}
        {profile.turnMode === 'auto' && userCaption && !audioPlaying && live && (
          <button type="button" className={styles.nudge} onClick={handleNudge}>
            {s.yourTurn}
          </button>
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
