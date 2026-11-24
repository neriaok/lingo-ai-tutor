import { GoogleGenAI } from '@google/genai';

let cached: { key: string; ai: GoogleGenAI } | null = null;

export const getClient = (apiKey: string): GoogleGenAI => {
  if (!apiKey) throw Object.assign(new Error('Missing Gemini API key'), { code: 'no_key' });
  if (cached?.key !== apiKey) cached = { key: apiKey, ai: new GoogleGenAI({ apiKey }) };
  return cached.ai;
};
