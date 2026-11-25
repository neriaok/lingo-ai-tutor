export const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const FALLBACK_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
/** Tried in order after the configured model if a live connection is refused. */
export const LIVE_MODEL_CANDIDATES = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-live-2.5-flash-preview',
];
export const DEFAULT_TEXT_MODEL = 'gemini-3.5-flash';
export const FALLBACK_TEXT_MODEL = 'gemini-2.5-flash';
/** Per-turn feedback runs after every exchange, so it uses the lighter model with higher free-tier limits. */
export const FEEDBACK_MODEL = 'gemini-3.1-flash-lite';

/** Quick key check: lists models with the key (no SDK needed). */
export const validateKey = async (apiKey: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`);
    return res.ok;
  } catch {
    return false;
  }
};
