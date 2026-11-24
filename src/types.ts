export type LangCode = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type CorrectionStyle = 'instant' | 'gentle' | 'none';
/** 'target': everything in the learned language. 'mixed': explanations in the native language. */
export type ExplainMode = 'target' | 'mixed';
export type Goal = 'conversation' | 'travel' | 'work' | 'exam' | 'school';
export type Mood = 'happy' | 'thinking' | 'surprised' | 'encouraging';
export type TutorId = 'maya' | 'leo' | 'noa' | 'sam';
export type View = 'onboarding' | 'home' | 'call' | 'vocab' | 'summary' | 'settings' | 'history';

export interface Profile {
  name: string;
  native: LangCode;
  target: LangCode;
  level: Level;
  interests: string[];
  goal: Goal;
  tutor: TutorId;
  correction: CorrectionStyle;
  explainMode: ExplainMode;
  dailyMinutes: number;
  speechRate: number;
  autoSpeak: boolean;
  apiKey: string;
  liveModel: string;
  textModel: string;
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface NewWord {
  word: string;
  meaning: string;
  example?: string;
}

export interface TutorTurn {
  reply: string;
  translation: string;
  correction: Correction | null;
  newWords: NewWord[];
  suggestions: string[];
  mood: Mood;
  assessedLevel?: Level | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'tutor';
  text: string;
  via: 'voice' | 'text';
  turn?: TutorTurn;
  /** True while feedback (translation, corrections, words) is being generated. */
  pending?: boolean;
}

export interface Scenario {
  id: string;
  icon: string;
  title: Record<'he' | 'en', string>;
  brief: string;
  minLevel?: Level;
}

export interface SessionSummary {
  score: number;
  headline: string;
  strengths: string[];
  mistakes: Correction[];
  tip: string;
  xp: number;
  /** Short English note of what the learner shared, so the tutor can remember it next time. */
  recap?: string;
}

export interface VocabCard {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  lang: LangCode;
  box: number;
  due: number;
  added: number;
}

export interface MistakeEntry extends Correction {
  id: string;
  lang: LangCode;
  added: number;
  count: number;
  fixed: boolean;
}

/** What the tutor should remember from earlier lessons. */
export interface LearnerMemory {
  words: string[];
  mistakes: string[];
  recaps: string[];
}

export interface SavedSession {
  id: string;
  scenarioId: string;
  tutor: TutorId;
  target: LangCode;
  level: Level;
  startedAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  summary: SessionSummary | null;
}
