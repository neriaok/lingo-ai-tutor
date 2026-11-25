import { describe, expect, it } from 'vitest';
import { SCENARIOS, TUTORS } from '../data/catalog';
import { defaultProfile } from '../features/profile/profileSlice';
import { buildLiveInstruction, explainRule } from '../services/tutorPrompt';

const scenario = SCENARIOS[0];

describe('tutor prompts', () => {
  it('keeps explanations in the target language in "target" mode', () => {
    const rule = explainRule({ ...defaultProfile, explainMode: 'target' });
    expect(rule).toContain('ENGLISH ONLY');
    expect(rule).toContain('never switch to Hebrew');
  });

  it('explains in the native language in "mixed" mode', () => {
    const rule = explainRule({ ...defaultProfile, explainMode: 'mixed' });
    expect(rule).toContain('BILINGUAL');
    expect(rule).toContain('of what you say should be in Hebrew');
    const live = buildLiveInstruction({ ...defaultProfile, explainMode: 'mixed' }, scenario);
    expect(live).not.toContain('- Speak English.');
  });

  it.each(TUTORS.map((t) => [t.id, t]))('gives %s its own personality', (_id, tutor) => {
    const text = buildLiveInstruction({ ...defaultProfile, tutor: tutor.id }, scenario);
    expect(text).toContain(`You are ${tutor.name}`);
    tutor.styleNotes.forEach((note) => expect(text).toContain(note));
  });

  it('puts the language mode last and flags a mid-call switch', () => {
    const text = buildLiveInstruction({ ...defaultProfile, explainMode: 'mixed' }, scenario, undefined, [
      { id: '1', role: 'tutor', text: 'What did you do today?', via: 'voice' },
    ], true);
    const modeAt = text.lastIndexOf('CURRENT LANGUAGE MODE');
    expect(modeAt).toBeGreaterThan(text.indexOf('THIS CALL SO FAR'));
    expect(text.slice(modeAt)).toContain('BILINGUAL');
    expect(text).toContain('has just changed the explanation language');
  });

  it('includes memory from past calls and the transcript when resuming', () => {
    const text = buildLiveInstruction(defaultProfile, scenario, { words: ['awesome'], mistakes: [], recaps: ['Neria has a job interview on Sunday.'] }, [
      { id: '1', role: 'user', text: 'I like football', via: 'voice' },
    ]);
    expect(text).toContain('awesome');
    expect(text).toContain('job interview');
    expect(text).toContain('LEARNER: I like football');
  });
});
