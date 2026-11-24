import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { load } from '../../services/storage';
import type { SavedSession } from '../../types';

export interface HistoryState {
  sessions: SavedSession[];
}

const MAX_SESSIONS = 40;

const initialState: HistoryState = { sessions: [], ...load<HistoryState>('history') };

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    upsertSession: (state, action: PayloadAction<SavedSession>) => {
      const i = state.sessions.findIndex((s) => s.id === action.payload.id);
      if (i >= 0) state.sessions.splice(i, 1);
      state.sessions.unshift(action.payload);
      state.sessions = state.sessions.slice(0, MAX_SESSIONS);
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
    },
  },
});

export const { upsertSession, removeSession } = historySlice.actions;
export default historySlice.reducer;
