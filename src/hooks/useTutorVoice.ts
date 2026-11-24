import { useCallback } from 'react';
import { langInfo, tutorInfo } from '../data/catalog';
import { speak } from '../services/speech';
import { useAppSelector } from './useAppDispatch';

/** Speaks text in the target language with the browser voice (used outside live calls). */
export const useTutorVoice = (): ((text: string, slow?: boolean) => void) => {
  const { target, tutor, speechRate } = useAppSelector((s) => s.profile.data);
  return useCallback(
    (text: string, slow = false) => {
      speak(text, langInfo(target).speech, slow ? Math.max(0.6, speechRate * 0.75) : speechRate, tutorInfo(tutor).pitch);
    },
    [target, tutor, speechRate],
  );
};
