import { configureStore } from '@reduxjs/toolkit';
import { aiApi } from '../features/ai/aiApi';
import profileReducer from '../features/profile/profileSlice';
import progressReducer from '../features/progress/progressSlice';
import sessionReducer from '../features/session/sessionSlice';
import { save } from '../services/storage';

export const store = configureStore({
  reducer: {
    profile: profileReducer,
    session: sessionReducer,
    progress: progressReducer,
    [aiApi.reducerPath]: aiApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(aiApi.middleware),
});

let lastProfile: unknown;
let lastProgress: unknown;
store.subscribe(() => {
  const { profile, progress } = store.getState();
  if (profile !== lastProfile) save('profile', (lastProfile = profile));
  if (progress !== lastProgress) save('progress', (lastProgress = progress));
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
