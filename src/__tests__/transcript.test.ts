import { describe, expect, it } from 'vitest';
import { cleanTranscript } from '../services/gemini/transcript';

describe('cleanTranscript', () => {
  it('collapses a looping phrase', () => {
    expect(cleanTranscript(`${'What is '.repeat(40)}your name?`)).toBe('What is your name?');
  });
  it('collapses a repeated single word', () => {
    expect(cleanTranscript('I I I I I like it')).toBe('I like it');
  });
  it('keeps natural repetition', () => {
    expect(cleanTranscript('very very good, no no')).toBe('very very good, no no');
  });
  it('caps very long text', () => {
    const long = Array.from({ length: 400 }, (_, k) => `w${k}`).join(' ');
    expect(cleanTranscript(long, 100).length).toBeLessThanOrEqual(101);
  });
});
