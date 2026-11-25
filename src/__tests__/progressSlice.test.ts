import { describe, expect, it } from 'vitest';
import reducer, { addMistake, gradeCard, saveWord, type ProgressState } from '../features/progress/progressSlice';

const empty: ProgressState = { xp: 0, streak: 0, lastDay: '', minutesByDay: {}, cards: [], mistakes: [] };

describe('progressSlice', () => {
  it('saves a word once per language (case-insensitive)', () => {
    let s = reducer(empty, saveWord({ word: { word: 'Interesting', meaning: 'מעניין' }, lang: 'en' }));
    s = reducer(s, saveWord({ word: { word: 'interesting', meaning: 'מעניין' }, lang: 'en' }));
    expect(s.cards).toHaveLength(1);
  });

  it('moves a card up the Leitner boxes and schedules it later', () => {
    const s1 = reducer(empty, saveWord({ word: { word: 'cat', meaning: 'חתול' }, lang: 'en' }));
    const id = s1.cards[0].id;
    const s2 = reducer(s1, gradeCard({ id, grade: 3 }));
    expect(s2.cards[0].box).toBe(2);
    expect(s2.cards[0].due).toBeGreaterThan(Date.now() + 2 * 86_400_000);
    expect(s2.xp).toBe(3);
  });

  it('resets a card to box 0 on "again"', () => {
    let s = reducer(empty, saveWord({ word: { word: 'dog', meaning: 'כלב' }, lang: 'en' }));
    const id = s.cards[0].id;
    s = reducer(s, gradeCard({ id, grade: 3 }));
    s = reducer(s, gradeCard({ id, grade: 0 }));
    expect(s.cards[0].box).toBe(0);
  });

  it('counts a repeated mistake instead of duplicating it', () => {
    const correction = { original: 'I goed', corrected: 'I went', explanation: 'past of go' };
    let s = reducer(empty, addMistake({ correction, lang: 'en' }));
    s = reducer(s, addMistake({ correction, lang: 'en' }));
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0].count).toBe(2);
  });
});
