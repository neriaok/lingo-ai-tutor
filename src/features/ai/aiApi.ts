import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { generateJson } from '../../services/gemini/text';
import { FEEDBACK_MODEL } from '../../services/gemini/models';
import { buildFeedbackPrompt, buildSongPrompt, buildSummaryPrompt, buildTutorPrompt } from '../../services/tutorPrompt';
import type { ChatMessage, Correction, LearnerMemory, Level, Mood, Profile, Scenario, SessionSummary, TutorTurn } from '../../types';

export interface AiError {
  code: string;
  message: string;
}

const MOODS: Mood[] = ['happy', 'thinking', 'surprised', 'encouraging'];
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const toCorrection = (v: unknown): Correction | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const c = { original: str(o.original), corrected: str(o.corrected), explanation: str(o.explanation) };
  return c.corrected && c.corrected !== c.original ? c : null;
};

const normalizeTurn = (raw: unknown): TutorTurn => {
  const o = (raw ?? {}) as Record<string, unknown>;
  const mood = MOODS.includes(o.mood as Mood) ? (o.mood as Mood) : 'happy';
  const assessed = LEVELS.includes(o.assessedLevel as Level) ? (o.assessedLevel as Level) : null;
  return {
    reply: str(o.reply) || '…',
    translation: str(o.translation),
    correction: toCorrection(o.correction),
    newWords: arr(o.newWords)
      .map((w) => {
        const x = (w ?? {}) as Record<string, unknown>;
        return { word: str(x.word), meaning: str(x.meaning), example: str(x.example) || undefined };
      })
      .filter((w) => w.word && w.meaning)
      .slice(0, 3),
    suggestions: arr(o.suggestions).map(str).filter(Boolean).slice(0, 3),
    mood,
    assessedLevel: assessed,
    song: (() => {
      const sg = (o.song ?? null) as Record<string, unknown> | null;
      const query = sg && typeof sg === 'object' ? str(sg.query).trim() : '';
      return query ? { query: query.slice(0, 120), why: str(sg?.why).slice(0, 160) } : null;
    })(),
  };
};

const toAiError = (e: unknown): AiError => {
  const o = (e ?? {}) as { code?: string; message?: string; status?: number };
  const msg = o.message ?? String(e);
  const code = o.code ?? (/429|quota|rate/i.test(msg) ? 'rate_limited' : /API key|401|403|permission/i.test(msg) ? 'bad_key' : 'error');
  return { code, message: msg };
};

export const aiApi = createApi({
  reducerPath: 'aiApi',
  baseQuery: fakeBaseQuery<AiError>(),
  endpoints: (builder) => ({
    tutorTurn: builder.mutation<TutorTurn, { profile: Profile; scenario: Scenario; history: ChatMessage[]; memory?: LearnerMemory }>({
      queryFn: async ({ profile, scenario, history, memory }) => {
        try {
          const raw = await generateJson(profile.apiKey, profile.textModel, buildTutorPrompt(profile, scenario, history, memory));
          return { data: normalizeTurn(raw) };
        } catch (e) {
          return { error: toAiError(e) };
        }
      },
    }),
    feedback: builder.mutation<TutorTurn, { profile: Profile; learner: string; tutor: string }>({
      queryFn: async ({ profile, learner, tutor }) => {
        try {
          let raw: Record<string, unknown>;
          try {
            raw = (await generateJson(profile.apiKey, FEEDBACK_MODEL, buildFeedbackPrompt(profile, learner, tutor))) as Record<string, unknown>;
          } catch {
            // Lite model unavailable or rate-limited: try the main text model once.
            raw = (await generateJson(profile.apiKey, profile.textModel, buildFeedbackPrompt(profile, learner, tutor))) as Record<string, unknown>;
          }
          return { data: normalizeTurn({ ...raw, reply: tutor }) };
        } catch (e) {
          return { error: toAiError(e) };
        }
      },
    }),
    suggestSong: builder.mutation<{ query: string; why: string }, { profile: Profile; history: ChatMessage[] }>({
      queryFn: async ({ profile, history }) => {
        try {
          const o = (await generateJson(profile.apiKey, profile.textModel, buildSongPrompt(profile, history))) as Record<string, unknown>;
          const query = str(o.query).trim();
          if (!query) return { error: { code: 'error', message: 'no song' } };
          return { data: { query: query.slice(0, 120), why: str(o.why).slice(0, 160) } };
        } catch (e) {
          return { error: toAiError(e) };
        }
      },
    }),
    summarize: builder.mutation<SessionSummary, { profile: Profile; history: ChatMessage[] }>({
      queryFn: async ({ profile, history }) => {
        try {
          const o = (await generateJson(profile.apiKey, profile.textModel, buildSummaryPrompt(profile, history))) as Record<string, unknown>;
          const userTurns = history.filter((m) => m.role === 'user').length;
          const score = Math.max(0, Math.min(100, Number(o.score) || 0));
          return {
            data: {
              score,
              headline: str(o.headline),
              strengths: arr(o.strengths).map(str).filter(Boolean).slice(0, 3),
              mistakes: arr(o.mistakes).map(toCorrection).filter((c): c is Correction => !!c).slice(0, 4),
              tip: str(o.tip),
              recap: str(o.recap) || undefined,
              xp: userTurns * 10 + Math.round(score / 5),
            },
          };
        } catch (e) {
          return { error: toAiError(e) };
        }
      },
    }),
  }),
});

export const { useTutorTurnMutation, useFeedbackMutation, useSuggestSongMutation, useSummarizeMutation } = aiApi;
