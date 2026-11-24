import { FALLBACK_TEXT_MODEL } from './models';

// The Gemini SDK is loaded on demand to keep the first screen light.
const loadClient = async () => (await import('./client')).getClient;

const isModelMissing = (e: unknown): boolean => /not found|404|not supported/i.test(String((e as Error)?.message ?? e));

/** Runs a JSON-only prompt against the text model, falling back to a stable model if needed. */
export const generateJson = async (apiKey: string, model: string, prompt: string): Promise<unknown> => {
  const ai = (await loadClient())(apiKey);
  const run = async (m: string): Promise<unknown> => {
    const res = await ai.models.generateContent({
      model: m,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.7 },
    });
    const text = res.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Model did not return JSON');
    return JSON.parse(text.slice(start, end + 1));
  };
  try {
    return await run(model);
  } catch (e) {
    if (model !== FALLBACK_TEXT_MODEL && isModelMissing(e)) return run(FALLBACK_TEXT_MODEL);
    throw e;
  }
};
