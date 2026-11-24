export const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const FALLBACK_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
export const DEFAULT_TEXT_MODEL = 'gemini-3.5-flash';
export const FALLBACK_TEXT_MODEL = 'gemini-2.5-flash';

/** Quick key check: lists models with the key (no SDK needed). */
export const validateKey = async (apiKey: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`);
    return res.ok;
  } catch {
    return false;
  }
};
