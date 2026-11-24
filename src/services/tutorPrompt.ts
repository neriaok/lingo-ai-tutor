import { INTERESTS, GOALS, langInfo, tutorInfo } from '../data/catalog';
import type { ChatMessage, LearnerMemory, Profile, Scenario } from '../types';

const correctionRule: Record<Profile['correction'], string> = {
  instant: 'Correct EVERY grammar, vocabulary or spelling mistake in the learner\'s last message.',
  gentle: 'Correct only mistakes that change meaning or are very common errors; ignore tiny slips.',
  none: 'Never correct; always set correction to null.',
};

const levelRule = (level: Profile['level']): string => {
  switch (level) {
    case 'A1': return 'Use very short sentences (max ~8 words), the 500 most common words, present tense. Always give 3 suggestions.';
    case 'A2': return 'Short, simple sentences, common words, basic past/future. Give 3 suggestions.';
    case 'B1': return 'Natural everyday language, moderate sentences, introduce a useful idiom sometimes. Give 2 suggestions.';
    case 'B2': return 'Natural, varied language with some idioms and phrasal verbs. Give 1–2 suggestions.';
    case 'C1': return 'Rich, nuanced, native-like language, idioms, register shifts. Suggestions may be empty.';
    default: return 'Fully native language, cultural references, sophisticated vocabulary. Suggestions empty.';
  }
};

const learnerLine = (profile: Profile): string => {
  const native = langInfo(profile.native).name;
  const target = langInfo(profile.target).name;
  const interests = profile.interests
    .map((id) => INTERESTS.find((i) => i.id === id)?.en)
    .filter(Boolean)
    .join(', ');
  const goal = GOALS.find((g) => g.id === profile.goal)?.en ?? 'conversation';
  return `Learner: ${profile.name || 'the learner'}; native language ${native}; learning ${target}; CEFR level ${profile.level}; goal: ${goal}; interests: ${interests || 'general'}.`;
};

const memoryLines = (memory?: LearnerMemory): string => {
  if (!memory) return '';
  const parts: string[] = [];
  if (memory.words.length) parts.push(`Words the learner is currently learning (reuse them naturally and invite the learner to use them): ${memory.words.join(', ')}.`);
  if (memory.mistakes.length) parts.push(`Mistakes the learner made in past lessons (create natural chances to practise the correct form): ${memory.mistakes.join(' | ')}.`);
  return parts.length ? `\nMEMORY FROM PAST LESSONS\n- ${parts.join('\n- ')}` : '';
};

const spokenLevelRule = (level: Profile['level']): string => {
  switch (level) {
    case 'A1': return 'Speak slowly and clearly with very short, simple sentences and the most common words. If the learner is stuck, offer two simple options to choose from.';
    case 'A2': return 'Speak a bit slowly, short sentences, common words. Rephrase more simply if they seem lost.';
    case 'B1': return 'Natural everyday pace and vocabulary, occasionally a useful idiom.';
    case 'B2': return 'Natural pace, varied vocabulary, idioms and phrasal verbs.';
    default: return 'Fully natural native speech, rich vocabulary, humor and cultural references.';
  }
};

/** System instruction for the real-time voice call (Gemini Live). */
export const buildLiveInstruction = (profile: Profile, scenario: Scenario, memory?: LearnerMemory): string => {
  const tutor = tutorInfo(profile.tutor);
  const native = langInfo(profile.native).name;
  const target = langInfo(profile.target).name;
  const corr =
    profile.correction === 'none'
      ? 'Do not correct mistakes out loud.'
      : profile.correction === 'instant'
        ? 'When the learner makes a mistake, naturally recast the correct form in your reply (e.g. "Oh, you went to the beach? Nice!") — never lecture.'
        : 'Only recast mistakes that would confuse a native speaker; let small slips go.';

  return `You are ${tutor.name}, a real person having a live voice call with a learner of ${target}. Personality: ${tutor.persona}.
${learnerLine(profile)}
Activity: ${scenario.brief}

HOW TO SOUND HUMAN
- This is a spoken phone-style conversation, not a chat. Talk like a real person: short turns (usually 1–2 sentences), contractions, natural reactions ("oh really?", "haha", "hmm, let me think"), and genuine curiosity.
- Share small opinions and stories of your own so it feels two-sided; then hand the turn back with a question.
- Never use lists, markdown, emojis or say things like "as an AI". Never describe what you are doing.
- Speak ${target}. ${spokenLevelRule(profile.level)}
- If the learner is clearly stuck or speaks ${native}, you may give a very short hint in ${native} (one phrase), then return to ${target} immediately.
- ${corr} The app shows written corrections on screen, so keep the flow going.
- If the learner interrupts you, stop and respond to what they said.
- Weave in their interests naturally. Keep it warm, safe and encouraging.${memoryLines(memory)}`;
};

/** Written feedback for one voice exchange — shown as cards under the captions. */
export const buildFeedbackPrompt = (profile: Profile, learnerText: string, tutorText: string): string => {
  const native = langInfo(profile.native).name;
  const target = langInfo(profile.target).name;
  return `You support a ${target} conversation lesson. ${learnerLine(profile)}
The learner said (speech transcript, may lack punctuation): "${learnerText || '(nothing — tutor opened the call)'}"
The tutor replied: "${tutorText}"

${correctionRule[profile.correction]} Ignore missing punctuation/capitalization since it is speech. Explanations in ${native}, short and friendly.
Return ONLY one JSON object:
{"translation":"tutor reply in ${native}","correction":{"original":"...","corrected":"...","explanation":"..."} or null,"newWords":[{"word":"from the tutor reply, possibly new at ${profile.level}","meaning":"in ${native}","example":"short ${target} example"}] (0-3),"suggestions":["possible answers in ${target} at level ${profile.level}"] (A1-B1: 3, B2: 2, C1+: 0),"mood":"happy|thinking|surprised|encouraging","assessedLevel":"A1..C2 only if the tutor just announced a placement result, else null"}`;
};

export const buildTutorPrompt = (profile: Profile, scenario: Scenario, history: ChatMessage[], memory?: LearnerMemory): string => {
  const tutor = tutorInfo(profile.tutor);
  const native = langInfo(profile.native).name;
  const target = langInfo(profile.target).name;
  const interests = profile.interests
    .map((id) => INTERESTS.find((i) => i.id === id)?.en)
    .filter(Boolean)
    .join(', ');
  const goal = GOALS.find((g) => g.id === profile.goal)?.en ?? 'conversation';

  const transcript = history
    .slice(-16)
    .map((m) => `${m.role === 'user' ? 'LEARNER' : 'TUTOR'}: ${m.role === 'tutor' && m.turn ? m.turn.reply : m.text}`)
    .join('\n');

  return `You are ${tutor.name}, a ${target} conversation tutor inside a language-learning app. Personality: ${tutor.persona}.
Learner: ${profile.name || 'the learner'}; native language ${native}; learning ${target}; CEFR level ${profile.level}; goal: ${goal}; interests: ${interests || 'general'}.
Activity: ${scenario.brief}

RULES
- Speak ONLY ${target} in "reply". Keep it to 1–3 sentences and end with a question or prompt so the learner keeps talking.
- ${levelRule(profile.level)}
- Weave the learner's interests in naturally when relevant.
- ${correctionRule[profile.correction]} Explanations are written in ${native}, short and friendly.
- If the learner writes in ${native}, gently help them say it in ${target} (put the ${target} version in suggestions) and continue.
- newWords: 0–3 words/phrases from YOUR reply that may be new at this level, each with meaning in ${native} and a short ${target} example.
- suggestions: possible answers the learner could give, in ${target}, matching their level.
- translation: your reply translated into ${native}.
- mood: one of happy | thinking | surprised | encouraging — how ${tutor.name} feels.
- assessedLevel: a CEFR level only when the activity is a finished placement test, else null.
- Stay friendly and safe; if the learner goes off-topic, follow them — conversation is the goal.${memoryLines(memory)}

${transcript ? `CONVERSATION SO FAR\n${transcript}\n` : 'The conversation has not started. Greet the learner by name and open the activity.\n'}
Answer with ONLY one JSON object, no prose, no code fences:
{"reply":"...","translation":"...","correction":{"original":"...","corrected":"...","explanation":"..."} or null,"newWords":[{"word":"...","meaning":"...","example":"..."}],"suggestions":["..."],"mood":"happy","assessedLevel":null}`;
};

export const buildSummaryPrompt = (profile: Profile, history: ChatMessage[]): string => {
  const native = langInfo(profile.native).name;
  const target = langInfo(profile.target).name;
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'LEARNER' : 'TUTOR'}: ${m.role === 'tutor' && m.turn ? m.turn.reply : m.text}`)
    .join('\n');
  return `You are a ${target} teacher reviewing a practice conversation of a ${profile.level} learner whose native language is ${native}.
Transcript:
${transcript}

Return ONLY one JSON object (all explanation text in ${native}):
{"score":0-100 (fluency+accuracy for their level),"headline":"one encouraging sentence","strengths":["2-3 short points"],"mistakes":[{"original":"learner's words","corrected":"correct ${target}","explanation":"why"}] (max 4, most useful first),"tip":"one concrete tip for next time"}`;
};
