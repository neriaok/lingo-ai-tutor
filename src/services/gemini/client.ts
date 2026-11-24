import { GoogleGenAI } from '@google/genai';

const cache = new Map<string, GoogleGenAI>();

export const getClient = (apiKey: string, apiVersion?: string): GoogleGenAI => {
  if (!apiKey) throw Object.assign(new Error('Missing Gemini API key'), { code: 'no_key' });
  const id = `${apiVersion ?? 'default'}:${apiKey}`;
  let ai = cache.get(id);
  if (!ai) {
    ai = new GoogleGenAI(apiVersion ? { apiKey, apiVersion } : { apiKey });
    cache.set(id, ai);
  }
  return ai;
};
