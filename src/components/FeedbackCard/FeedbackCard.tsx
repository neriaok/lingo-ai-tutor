import { useState, type FC } from 'react';
import clsx from 'clsx';
import { useStrings } from '../../hooks/useStrings';
import type { NewWord, TutorTurn } from '../../types';
import Icon from '../Icon';
import styles from './FeedbackCard.module.css';

interface FeedbackCardProps {
  turn: TutorTurn;
  targetRtl: boolean;
  nativeRtl: boolean;
  savedWords: string[];
  onSaveWord: (word: NewWord) => void;
  onSpeakWord: (word: string) => void;
}

/** Compact written feedback under the live captions: correction, new words, answer hints. */
const FeedbackCard: FC<FeedbackCardProps> = ({ turn, targetRtl, nativeRtl, savedWords, onSaveWord, onSpeakWord }) => {
  const s = useStrings();
  const [showHelp, setShowHelp] = useState(false);
  const tDir = targetRtl ? 'rtl' : 'ltr';
  const nDir = nativeRtl ? 'rtl' : 'ltr';
  if (!turn.correction && turn.newWords.length === 0 && turn.suggestions.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {turn.correction && (
        <div className={styles.correction} dir={nDir}>
          <span className={styles.tag}><Icon name="check" size={14} /> {s.correctionTitle}</span>
          <p dir={tDir}><del>{turn.correction.original}</del> <ins>{turn.correction.corrected}</ins></p>
          <small>{turn.correction.explanation}</small>
        </div>
      )}
      {turn.newWords.length > 0 && (
        <div className={styles.words}>
          {turn.newWords.map((w) => {
            const saved = savedWords.includes(w.word.toLowerCase());
            return (
              <span key={w.word} className={styles.word}>
                <button type="button" className={styles.wordText} onClick={() => onSpeakWord(w.word)}>
                  <b dir={tDir}>{w.word}</b> <span dir={nDir}>{w.meaning}</span>
                </button>
                <button
                  type="button"
                  className={clsx(styles.add, saved && styles.added)}
                  disabled={saved}
                  aria-label={saved ? s.saved : s.saveWord}
                  onClick={() => onSaveWord(w)}
                >
                  {saved ? <Icon name="check" size={14} /> : '+'}
                </button>
              </span>
            );
          })}
        </div>
      )}
      {turn.suggestions.length > 0 && (
        <div className={styles.help}>
          <button type="button" className={styles.helpBtn} onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
            {s.helpMe}
          </button>
          {showHelp && (
            <ul dir={tDir}>
              {turn.suggestions.map((sg) => <li key={sg}>{sg}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackCard;
