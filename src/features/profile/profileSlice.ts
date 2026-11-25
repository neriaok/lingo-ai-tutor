import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { load } from '../../services/storage';
import { DEFAULT_LIVE_MODEL, DEFAULT_TEXT_MODEL } from '../../services/gemini/models';
import type { Profile } from '../../types';

export interface ProfileState {
  data: Profile;
  onboarded: boolean;
}

export const defaultProfile: Profile = {
  name: '',
  native: 'he',
  target: 'en',
  level: 'A2',
  interests: [],
  goal: 'conversation',
  tutor: 'maya',
  correction: 'gentle',
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
const initialState: ProfileState = saved
  ? { onboarded: saved.onboarded, data: { ...defaultProfile, ...saved.data } }
  : { onboarded: false, data: defaultProfile };

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
