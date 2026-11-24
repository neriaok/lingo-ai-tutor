import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { aiApi } from '../features/ai/aiApi';
import historyReducer, { upsertSession } from '../features/history/historySlice';
import profileReducer from '../features/profile/profileSlice';
import progressReducer from '../features/progress/progressSlice';
import sessionReducer, { addMessage, setSummary, updateMessage } from '../features/session/sessionSlice';
import { save } from '../services/storage';

// Every change to the active conversation is mirrored into history, so nothing is lost
// if the app is closed, reloaded, or interrupted by a phone call.
const listener = createListenerMiddleware();

export const store = configureStore({
  reducer: {
    profile: profileReducer,
    session: sessionReducer,
    progress: progressReducer,
    history: historyReducer,
    [aiApi.reducerPath]: aiApi.reducer,
  },
  middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(aiApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

listener.startListening({
  matcher: isAnyOf(addMessage, updateMessage, setSummary),
  effect: (_action, api) => {
    const { session, profile } = api.getState() as RootState;
    if (!session.id || session.messages.length === 0) return;
    api.dispatch(
      upsertSession({
        id: session.id,
        scenarioId: session.scenarioId,
        tutor: profile.data.tutor,
        target: profile.data.target,
        level: profile.data.level,
        startedAt: session.createdAt,
        updatedAt: Date.now(),
        messages: session.messages,
        summary: session.summary,
      }),
    );
  },
});

let lastProfile: unknown;
let lastProgress: unknown;
let lastHistory: unknown;
store.subscribe(() => {
  const { profile, progress, history } = store.getState();
  if (profile !== lastProfile) save('profile', (lastProfile = profile));
  if (progress !== lastProgress) save('progress', (lastProgress = progress));
  if (history !== lastHistory) save('history', (lastHistory = history));
});
