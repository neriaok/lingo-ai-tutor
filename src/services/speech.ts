import { setMouthSource, setSpeaking } from './audio/mouth';

// Browser voice, used only in text-chat mode (no live call running).

let token = 0;
let boost = 0;

const hasSynth = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

const pickVoice = (langTag: string): SpeechSynthesisVoice | undefined => {
  if (!hasSynth()) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const base = langTag.split('-')[0];
  return (
    voices.find((v) => v.lang === langTag && /google|natural|premium|enhanced/i.test(v.name)) ??
    voices.find((v) => v.lang === langTag) ??
    voices.find((v) => v.lang.startsWith(base))
  );
};

const pseudoLevel = (): number => {
  // Syllable-like flapping, with a kick on every word boundary.
  const t = performance.now() / 1000;
  const base = 0.35 + 0.35 * Math.abs(Math.sin(t * 11)) * Math.abs(Math.sin(t * 3.7));
  boost *= 0.9;
  return Math.min(1, base + boost);
};

export const stopSpeaking = (): void => {
  token += 1;
  if (hasSynth()) window.speechSynthesis.cancel();
  setSpeaking(false);
};

export const speak = (text: string, langTag: string, rate: number, pitch: number): void => {
  stopSpeaking();
  const clean = text.replace(/[*_#`]/g, '').trim();
  if (!clean || !hasSynth()) return;
  const my = ++token;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = langTag;
  u.rate = rate;
  u.pitch = pitch;
  const v = pickVoice(langTag);
  if (v) u.voice = v;
  u.onstart = () => {
    setMouthSource(pseudoLevel);
    setSpeaking(true);
  };
  u.onboundary = () => (boost = 0.6);
  const end = (): void => {
    if (my === token) setSpeaking(false);
  };
  u.onend = end;
  u.onerror = end;
  window.speechSynthesis.speak(u);
};

if (hasSynth()) window.speechSynthesis.getVoices();
