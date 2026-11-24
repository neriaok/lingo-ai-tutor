import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { load } from '../../services/storage';
import type { Correction, LangCode, MistakeEntry, NewWord, VocabCard } from '../../types';

export interface ProgressState {
  xp: number;
  streak: number;
  lastDay: string;
  minutesByDay: Record<string, number>;
  cards: VocabCard[];
  mistakes: MistakeEntry[];
}

const DAY = 86_400_000;
// Leitner boxes → days until the next review.
const INTERVALS = [0, 1, 3, 7, 14, 30];

export const dayKey = (t = Date.now()): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const initialState: ProgressState = {
  xp: 0,
  streak: 0,
  lastDay: '',
  minutesByDay: {},
  cards: [],
  mistakes: [],
  ...load<ProgressState>('progress'),
};

const touchStreak = (state: ProgressState): void => {
  const today = dayKey();
  if (state.lastDay === today) return;
  state.streak = state.lastDay === dayKey(Date.now() - DAY) ? state.streak + 1 : 1;
  state.lastDay = today;
};

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    addXp: (state, action: PayloadAction<number>) => {
      state.xp += action.payload;
      touchStreak(state);
    },
    addMinutes: (state, action: PayloadAction<number>) => {
      const k = dayKey();
      state.minutesByDay[k] = (state.minutesByDay[k] ?? 0) + action.payload;
      touchStreak(state);
    },
    saveWord: (state, action: PayloadAction<{ word: NewWord; lang: LangCode }>) => {
      const { word, lang } = action.payload;
      const exists = state.cards.some((c) => c.lang === lang && c.word.toLowerCase() === word.word.toLowerCase());
      if (exists) return;
      state.cards.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        word: word.word,
        meaning: word.meaning,
        example: word.example,
        lang,
        box: 0,
        due: Date.now(),
        added: Date.now(),
      });
    },
    gradeCard: (state, action: PayloadAction<{ id: string; grade: 0 | 1 | 2 | 3 }>) => {
      const card = state.cards.find((c) => c.id === action.payload.id);
      if (!card) return;
      const { grade } = action.payload;
      card.box = grade === 0 ? 0 : Math.min(INTERVALS.length - 1, card.box + (grade === 3 ? 2 : grade === 2 ? 1 : 0));
      card.due = grade === 0 ? Date.now() + 60_000 : Date.now() + Math.max(1, INTERVALS[card.box]) * DAY * (grade === 1 ? 0.5 : 1);
      state.xp += grade === 0 ? 1 : 3;
      touchStreak(state);
    },
    addMistake: (state, action: PayloadAction<{ correction: Correction; lang: LangCode }>) => {
      const { correction, lang } = action.payload;
      const key = correction.corrected.toLowerCase();
      const existing = state.mistakes.find((m) => m.lang === lang && m.corrected.toLowerCase() === key);
      if (existing) {
        existing.count += 1;
        existing.added = Date.now();
        return;
      }
      state.mistakes.unshift({ ...correction, id: `${Date.now()}`, lang, added: Date.now(), count: 1, fixed: false });
      state.mistakes = state.mistakes.slice(0, 200);
    },
    toggleMistakeFixed: (state, action: PayloadAction<string>) => {
      const m = state.mistakes.find((x) => x.id === action.payload);
      if (m) m.fixed = !m.fixed;
    },
    removeCard: (state, action: PayloadAction<string>) => {
      state.cards = state.cards.filter((c) => c.id !== action.payload);
    },
  },
});

export const { addXp, addMinutes, saveWord, gradeCard, addMistake, toggleMistakeFixed, removeCard } = progressSlice.actions;
export default progressSlice.reducer;
