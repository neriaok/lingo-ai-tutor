import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage, SavedSession, SessionSummary, View } from '../../types';

export interface SessionState {
  view: View;
  id: string;
  scenarioId: string;
  messages: ChatMessage[];
  startedAt: number;
  /** When the conversation first began (kept when resuming). */
  createdAt: number;
  summary: SessionSummary | null;
  /** True when the current conversation was reopened from history. */
  resumed: boolean;
}

const newId = (): string => `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const initialState: SessionState = {
  view: 'home',
  id: '',
  scenarioId: 'free',
  messages: [],
  startedAt: 0,
  createdAt: 0,
  summary: null,
  resumed: false,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setView: (state, action: PayloadAction<View>) => {
      state.view = action.payload;
    },
    startSession: (state, action: PayloadAction<string>) => {
      state.id = newId();
      state.scenarioId = action.payload;
      state.messages = [];
      state.summary = null;
      state.startedAt = Date.now();
      state.createdAt = state.startedAt;
      state.resumed = false;
      state.view = 'call';
    },
    resumeSession: (state, action: PayloadAction<SavedSession>) => {
      const s = action.payload;
      state.id = s.id;
      state.scenarioId = s.scenarioId;
      state.messages = s.messages.map((m) => ({ ...m, pending: false }));
      state.summary = null;
      state.startedAt = Date.now();
      state.createdAt = s.startedAt;
      state.resumed = true;
      state.view = 'call';
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    updateMessage: (state, action: PayloadAction<{ id: string; patch: Partial<ChatMessage> }>) => {
      const m = state.messages.find((x) => x.id === action.payload.id);
      if (m) Object.assign(m, action.payload.patch);
    },
    setSummary: (state, action: PayloadAction<SessionSummary>) => {
      state.summary = action.payload;
      state.view = 'summary';
    },
  },
});

export const { setView, startSession, resumeSession, addMessage, updateMessage, setSummary } = sessionSlice.actions;
export default sessionSlice.reducer;
