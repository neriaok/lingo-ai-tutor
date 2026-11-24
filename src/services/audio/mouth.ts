// Single source of truth for "how open is the tutor's mouth right now" (0..1).
// The live audio player feeds real amplitude; the browser-voice fallback feeds a pseudo signal.

type LevelReader = () => number;

let reader: LevelReader | null = null;
const listeners = new Set<(speaking: boolean) => void>();
let speaking = false;

export const setMouthSource = (r: LevelReader | null): void => {
  reader = r;
};

export const getMouthLevel = (): number => (reader ? Math.max(0, Math.min(1, reader())) : 0);

export const setSpeaking = (v: boolean): void => {
  if (v === speaking) return;
  speaking = v;
  listeners.forEach((l) => l(v));
};

export const isSpeaking = (): boolean => speaking;

export const subscribeSpeaking = (l: (speaking: boolean) => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
