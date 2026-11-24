import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage, SessionSummary, View } from '../../types';

export interface SessionState {
  view: View;
  scenarioId: string;
  messages: ChatMessage[];
  startedAt: number;
  summary: SessionSummary | null;
}

const initialState: SessionState = {
  view: 'home',
  scenarioId: 'free',
  messages: [],
  startedAt: 0,
  summary: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setView: (state, action: PayloadAction<View>) => {
      state.view = action.payload;
    },
    startSession: (state, action: PayloadAction<string>) => {
      state.scenarioId = action.payload;
      state.messages = [];
      state.summary = null;
      state.startedAt = Date.now();
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

export const { setView, startSession, addMessage, updateMessage, setSummary } = sessionSlice.actions;
export default sessionSlice.reducer;
