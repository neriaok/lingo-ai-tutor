import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, restoreBackup } from '../services/backup';
import { load, save } from '../services/storage';

describe('backup', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips progress and history but never exports the API key', () => {
    save('profile', { onboarded: true, data: { name: 'Neria', apiKey: 'SECRET' } });
    save('progress', { xp: 42 });
    save('history', { sessions: [{ id: 's1' }] });
    const text = createBackup();
    expect(text).not.toContain('SECRET');

    localStorage.clear();
    save('profile', { onboarded: true, data: { name: 'x', apiKey: 'DEVICE_KEY' } });
    expect(restoreBackup(text)).toBe(true);
    expect(load<{ xp: number }>('progress')?.xp).toBe(42);
    expect(load<{ data: { name: string; apiKey: string } }>('profile')?.data).toMatchObject({ name: 'Neria', apiKey: 'DEVICE_KEY' });
  });

  it('rejects text that is not a Lingo backup', () => {
    expect(restoreBackup('{"hello":1}')).toBe(false);
    expect(restoreBackup('not json')).toBe(false);
  });
});
