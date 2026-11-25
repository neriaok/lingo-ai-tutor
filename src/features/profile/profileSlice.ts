import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { load } from '../../services/storage';
import { DEFAULT_LIVE_MODEL, DEFAULT_TEXT_MODEL } from '../../services/gemini/models';
import type { Profile } from '../../types';

export interface ProfileState {
  data: Profile;
  onboarded: boolean;
  /** Set once the one-time corrections migration has run. */
  correctionsV2?: boolean;
}

export const defaultProfile: Profile = {
  name: '',
  native: 'he',
  target: 'en',
  level: 'A2',
  interests: [],
  goal: 'conversation',
  tutor: 'maya',
  correction: 'instant',
  explainMode: 'target',
  turnMode: 'auto',
  backgroundCall: true,
  thinkTime: 'normal',
  videoAvatar: true,
  dailyMinutes: 10,
  speechRate: 0.95,
  autoSpeak: true,
  apiKey: '',
  liveModel: DEFAULT_LIVE_MODEL,
  textModel: DEFAULT_TEXT_MODEL,
};

const saved = load<ProfileState>('profile');
// v2: explicit corrections became the default (the goal is learning) — move "gentle" users up once.
const migrated = saved && !saved.correctionsV2 && saved.data?.correction === 'gentle' ? { ...saved.data, correction: 'instant' as const } : saved?.data;
const initialState: ProfileState = saved
  ? { onboarded: saved.onboarded, data: { ...defaultProfile, ...migrated }, correctionsV2: true }
  : { onboarded: false, data: defaultProfile, correctionsV2: true };

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    updateProfile: (state, action: PayloadAction<Partial<Profile>>) => {
      state.data = { ...state.data, ...action.payload };
    },
    completeOnboarding: (state, action: PayloadAction<Profile>) => {
      state.data = action.payload;
      state.onboarded = true;
    },
  },
});

export const { updateProfile, completeOnboarding } = profileSlice.actions;
export default profileSlice.reducer;
