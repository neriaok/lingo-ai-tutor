import type { Goal, LangCode, Level, Scenario, TutorId } from '../types';

export interface LanguageInfo {
  code: LangCode;
  name: string;
  he: string;
  flag: string;
  speech: string;
  rtl: boolean;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'he', name: 'Hebrew', he: 'עברית', flag: 'IL', speech: 'he-IL', rtl: true },
  { code: 'en', name: 'English', he: 'אנגלית', flag: 'EN', speech: 'en-US', rtl: false },
  { code: 'ar', name: 'Arabic', he: 'ערבית', flag: 'AR', speech: 'ar-SA', rtl: true },
  { code: 'ru', name: 'Russian', he: 'רוסית', flag: 'RU', speech: 'ru-RU', rtl: false },
  { code: 'fr', name: 'French', he: 'צרפתית', flag: 'FR', speech: 'fr-FR', rtl: false },
  { code: 'es', name: 'Spanish', he: 'ספרדית', flag: 'ES', speech: 'es-ES', rtl: false },
];

export const langInfo = (code: LangCode): LanguageInfo =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1];

export interface LevelInfo {
  id: Level;
  he: string;
  en: string;
  heDesc: string;
  enDesc: string;
}

export const LEVELS: LevelInfo[] = [
  { id: 'A1', he: 'מתחיל', en: 'Beginner', heDesc: 'מכיר מילים בודדות', enDesc: 'A few words' },
  { id: 'A2', he: 'בסיסי', en: 'Elementary', heDesc: 'משפטים פשוטים על עצמי', enDesc: 'Simple sentences' },
  { id: 'B1', he: 'בינוני', en: 'Intermediate', heDesc: 'מסתדר בשיחה יומיומית', enDesc: 'Everyday talk' },
  { id: 'B2', he: 'בינוני-גבוה', en: 'Upper-int.', heDesc: 'מביע דעה ומתווכח', enDesc: 'Discuss & argue' },
  { id: 'C1', he: 'מתקדם', en: 'Advanced', heDesc: 'שוטף, עם ניואנסים', enDesc: 'Fluent, nuanced' },
  { id: 'C2', he: 'כמעט שפת אם', en: 'Proficient', heDesc: 'רמה של דובר ילידי', enDesc: 'Near-native' },
];

export const levelIndex = (l: Level): number => LEVELS.findIndex((x) => x.id === l);

export interface InterestInfo {
  id: string;
  he: string;
  en: string;
}

export const INTERESTS: InterestInfo[] = [
  { id: 'tech', he: 'טכנולוגיה', en: 'Tech' },
  { id: 'music', he: 'מוזיקה', en: 'Music' },
  { id: 'sport', he: 'ספורט', en: 'Sport' },
  { id: 'travel', he: 'טיולים', en: 'Travel' },
  { id: 'food', he: 'אוכל ובישול', en: 'Food' },
  { id: 'movies', he: 'סרטים וסדרות', en: 'Movies & TV' },
  { id: 'business', he: 'עסקים', en: 'Business' },
  { id: 'science', he: 'מדע', en: 'Science' },
  { id: 'history', he: 'היסטוריה', en: 'History' },
  { id: 'gaming', he: 'גיימינג', en: 'Gaming' },
  { id: 'fashion', he: 'אופנה ויופי', en: 'Fashion' },
  { id: 'animals', he: 'בעלי חיים', en: 'Animals' },
  { id: 'family', he: 'משפחה והורות', en: 'Family' },
  { id: 'health', he: 'כושר ובריאות', en: 'Fitness' },
  { id: 'books', he: 'ספרים', en: 'Books' },
  { id: 'nature', he: 'טבע', en: 'Nature' },
];

export const GOALS: { id: Goal; he: string; en: string }[] = [
  { id: 'conversation', he: 'לדבר בביטחון', en: 'Speak confidently' },
  { id: 'travel', he: 'להסתדר בחו"ל', en: 'Travel' },
  { id: 'work', he: 'עבודה וראיונות', en: 'Work & interviews' },
  { id: 'exam', he: 'מבחן / פסיכומטרי', en: 'Exam prep' },
  { id: 'school', he: 'בית ספר / לימודים', en: 'School' },
];

export interface TutorInfo {
  id: TutorId;
  name: string;
  he: string;
  en: string;
  persona: string;
  /** Concrete speaking habits that make the personality audible in conversation. */
  styleNotes: string[];
  voice: string;
  pitch: number;
  skin: string;
  hair: string;
  shirt: string;
  style: 'bob' | 'short' | 'curly' | 'bun';
  glasses: boolean;
  /** Animated clips in public/avatars (Gemini/Veo renders), cropped to the same face position. */
  clips?: ('idle' | 'talk')[];
  /** Background colour of those clips, used for the stage behind them. */
  videoBg?: string;
}

export const TUTORS: TutorInfo[] = [
  {
    id: 'maya', name: 'Maya', he: 'חמה וסבלנית', en: 'Warm & patient',
    persona: 'warm, patient and encouraging; celebrates small wins; speaks slowly and clearly',
    styleNotes: [
      'Celebrate effort with genuine, specific praise ("I love how you used \'actually\' there!").',
      'Never rush the learner; if they hesitate, reassure them gently and offer a simple way to continue.',
      'Ask caring, personal questions and remember the answers within the call.',
    ],
    voice: 'Aoede', pitch: 1.15, skin: '#f2c6a0', hair: '#3b2416', shirt: '#ff4f6d', style: 'bob', glasses: false,
    clips: ['idle', 'talk'], videoBg: '#f5bd23',
  },
  {
    id: 'leo', name: 'Leo', he: 'נחמד, אנושי ורגוע', en: 'Friendly & down-to-earth',
    persona: 'a regular, friendly, down-to-earth guy; relaxed and genuinely human, like chatting with a good friend over coffee',
    styleNotes: [
      'Talk about ordinary life — your day, food, weekends, small frustrations — so it feels like two normal people talking.',
      'Show empathy and relate to what the learner says ("Oh man, I know that feeling").',
      'Keep a calm, easy pace; no lecturing, no over-excitement.',
    ],
    voice: 'Charon', pitch: 0.9, skin: '#c98e62', hair: '#1c1c1c', shirt: '#2ec4b6', style: 'short', glasses: false,
    clips: ['idle', 'talk'], videoBg: '#efbd38',
  },
  {
    id: 'noa', name: 'Noa', he: 'חכמה וחדה — כמו מראיינת', en: 'Smart & sharp — an interviewer',
    persona: 'smart, sharp and direct, with the style of a seasoned job interviewer or journalist; professional but fair, and quietly encouraging',
    styleNotes: [
      'Ask probing follow-up questions and dig deeper ("Why?", "Can you give me a concrete example?", "What would you do differently?").',
      'Challenge vague or short answers politely and push the learner to be precise and structured.',
      'Give crisp, honest feedback in one sentence, then move on. Use precise vocabulary and model well-structured answers.',
    ],
    voice: 'Kore', pitch: 1.05, skin: '#f7d9c4', hair: '#b5532a', shirt: '#4361ee', style: 'bun', glasses: true,
    clips: ['idle', 'talk'], videoBg: '#efc243',
  },
  {
    id: 'sam', name: 'Sam', he: 'מצחיק — בדיחות וצחוקים', en: 'Funny — jokes & laughs',
    persona: 'the funny one: playful, witty and full of jokes, puns and silly stories, while still making the learner talk a lot',
    styleNotes: [
      'Drop a joke, pun or funny observation often (roughly every second or third turn), matched to the learner\'s level so they get it.',
      'Laugh naturally ("haha"), tease playfully but kindly, exaggerate for comic effect, and invite the learner to joke back.',
      'If you explain a joke or wordplay, keep it to one short line — it is a great way to teach idioms.',
    ],
    voice: 'Puck', pitch: 0.95, skin: '#8d5a3b', hair: '#2a1a12', shirt: '#ffb703', style: 'curly', glasses: false,
    clips: ['idle', 'talk'], videoBg: '#eec14c',
  },
];

export const tutorInfo = (id: TutorId): TutorInfo => TUTORS.find((t) => t.id === id) ?? TUTORS[0];

export const SCENARIOS: Scenario[] = [
  { id: 'free', icon: 'chat', title: { he: 'שיחה חופשית', en: 'Free talk' }, brief: 'Free, natural conversation like two friends catching up. Draw on the learner\'s interests, share small opinions of your own, react naturally.' },
  { id: 'cafe', icon: 'cup', title: { he: 'הזמנה בבית קפה', en: 'At the café' }, brief: 'Role-play: you are a barista in a busy café; the learner orders. Add small surprises (out of stock, size questions).' },
  { id: 'airport', icon: 'plane', title: { he: 'בשדה התעופה', en: 'At the airport' }, brief: 'Role-play: you are a check-in agent; handle passport, luggage, seat choice, a delay.' },
  { id: 'interview', icon: 'brief', title: { he: 'ראיון עבודה', en: 'Job interview' }, brief: 'Role-play: you interview the learner for a job related to their interests/profession. Ask classic interview questions one at a time.', minLevel: 'A2' },
  { id: 'doctor', icon: 'heart', title: { he: 'אצל הרופא', en: 'At the doctor' }, brief: 'Role-play: you are a family doctor; the learner describes mild symptoms (cold, back pain).' },
  { id: 'directions', icon: 'map', title: { he: 'לשאול דרך', en: 'Asking directions' }, brief: 'Role-play: you are a local; the learner is lost and asks for directions to a museum.' },
  { id: 'shopping', icon: 'bag', title: { he: 'קניות', en: 'Shopping' }, brief: 'Role-play: you are a shop assistant in a clothing store; sizes, prices, returns.' },
  { id: 'debate', icon: 'spark', title: { he: 'ויכוח ידידותי', en: 'Friendly debate' }, brief: 'Pick a light debatable topic from the learner\'s interests and take the opposite side politely. Push them to justify opinions.', minLevel: 'B1' },
  { id: 'story', icon: 'book', title: { he: 'סיפור משותף', en: 'Story together' }, brief: 'Co-write a short story: you write 1–2 sentences, then ask the learner to continue. Base it on their interests.' },
  { id: 'words', icon: 'cards', title: { he: 'תרגול המילים שלי', en: 'Practise my words' }, brief: 'WORD PRACTICE: steer a light, natural conversation so the learner has to USE each of the words listed under MEMORY, one or two at a time. When they use one correctly, praise briefly and move on.' },
  { id: 'placement', icon: 'target', title: { he: 'מבחן רמה', en: 'Level check' }, brief: 'PLACEMENT TEST: ask 6 progressively harder questions (A1→C1), one at a time, in the target language. After the 6th answer, tell the learner their estimated CEFR level (say it clearly, e.g. "I think you are B1").' },
];
