import { load, save } from './storage';

interface BackupFile {
  app: 'lingo';
  version: 1;
  createdAt: string;
  profile: unknown;
  progress: unknown;
  history: unknown;
}

/** Everything the learner built up, as JSON text. The API key is left out on purpose. */
export const createBackup = (): string => {
  const profile = load<{ data?: Record<string, unknown> }>('profile');
  const safeProfile = profile?.data ? { ...profile, data: { ...profile.data, apiKey: '' } } : profile;
  const file: BackupFile = {
    app: 'lingo',
    version: 1,
    createdAt: new Date().toISOString(),
    profile: safeProfile,
    progress: load('progress'),
    history: load('history'),
  };
  return JSON.stringify(file);
};

/** Restores a backup, keeping the API key already on this device. Returns false if the text isn't a Lingo backup. */
export const restoreBackup = (text: string): boolean => {
  try {
    const file = JSON.parse(text.trim()) as Partial<BackupFile>;
    if (file.app !== 'lingo' || file.version !== 1) return false;
    const currentKey = load<{ data?: { apiKey?: string } }>('profile')?.data?.apiKey ?? '';
    const profile = file.profile as { data?: Record<string, unknown> } | undefined;
    if (profile?.data) save('profile', { ...profile, data: { ...profile.data, apiKey: profile.data.apiKey || currentKey } });
    if (file.progress) save('progress', file.progress);
    if (file.history) save('history', file.history);
    return true;
  } catch {
    return false;
  }
};
