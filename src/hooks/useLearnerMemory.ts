import { useMemo } from 'react';
import type { LearnerMemory } from '../types';
import { useAppSelector } from './useAppDispatch';

/** Recent words and unresolved mistakes the tutor should weave into conversation. */
export const useLearnerMemory = (): LearnerMemory => {
  const target = useAppSelector((s) => s.profile.data.target);
  const { cards, mistakes } = useAppSelector((s) => s.progress);
  const sessions = useAppSelector((s) => s.history.sessions);
  return useMemo(() => {
    const now = Date.now();
    const words = cards
      .filter((c) => c.lang === target)
      .sort((a, b) => Number(b.due <= now) - Number(a.due <= now) || a.box - b.box)
      .slice(0, 10)
      .map((c) => c.word);
    const errs = mistakes
      .filter((m) => m.lang === target && !m.fixed)
      .slice(0, 5)
      .map((m) => `"${m.original}" → "${m.corrected}"`);
    const recaps = sessions
      .filter((x) => x.target === target && x.summary?.recap)
      .slice(0, 3)
      .map((x) => x.summary?.recap ?? '');
    return { words, mistakes: errs, recaps };
  }, [cards, mistakes, sessions, target]);
};
