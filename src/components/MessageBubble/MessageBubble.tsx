import { useState, type FC } from 'react';
import clsx from 'clsx';
import { LEVELS } from '../../data/catalog';
import { useStrings } from '../../hooks/useStrings';
import type { ChatMessage, Level, NewWord } from '../../types';
import Icon from '../Icon';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
  targetRtl: boolean;
  nativeRtl: boolean;
  savedWords: string[];
  onSpeak: (text: string, slow?: boolean) => void;
  onSaveWord: (word: NewWord) => void;
  onApplyLevel: (level: Level) => void;
}

const MessageBubble: FC<MessageBubbleProps> = ({ message, targetRtl, nativeRtl, savedWords, onSpeak, onSaveWord, onApplyLevel }) => {
  const s = useStrings();
  const [showTranslation, setShowTranslation] = useState(false);
  const tDir = targetRtl ? 'rtl' : 'ltr';
  const nDir = nativeRtl ? 'rtl' : 'ltr';

  if (message.role === 'user') {
    return (
      <div className={clsx(styles.row, styles.userRow)}>
        <p className={styles.user} dir="auto">{message.text}</p>
      </div>
    );
  }

  const turn = message.turn;
  if (!turn) {
    return (
      <div className={styles.row}>
        <div className={styles.tutor}>
          <p className={styles.reply} dir={tDir}>{message.text}</p>
          {message.pending && <span className={styles.pending} aria-label="…"><i /><i /><i /></span>}
        </div>
      </div>
    );
  }
  const levelInfo = turn.assessedLevel ? LEVELS.find((l) => l.id === turn.assessedLevel) : undefined;

  return (
    <div className={styles.row}>
      <div className={styles.tutor}>
        {turn.correction && (
          <div className={styles.correction} dir={nDir}>
            <span className={styles.corrTitle}><Icon name="check" size={16} /> {s.correctionTitle}</span>
            <p dir={tDir}>
              <del>{turn.correction.original}</del>
              <ins>{turn.correction.corrected}</ins>
            </p>
            <small>{turn.correction.explanation}</small>
          </div>
        )}

        <p className={styles.reply} dir={tDir}>{turn.reply}</p>
        {showTranslation && turn.translation && <p className={styles.translation} dir={nDir}>{turn.translation}</p>}

        {levelInfo && (
          <div className={styles.level}>
            <span>{s.levelResult}</span>
            <b>{levelInfo.id}</b>
            <button type="button" onClick={() => onApplyLevel(levelInfo.id)}>{s.applyLevel}</button>
          </div>
        )}

        <div className={styles.tools}>
          <button type="button" onClick={() => onSpeak(turn.reply)} aria-label={s.listen}><Icon name="speaker" size={18} /></button>
          <button type="button" onClick={() => onSpeak(turn.reply, true)} aria-label={s.slow}><Icon name="slow" size={18} /></button>
          {turn.translation && (
            <button type="button" className={clsx(showTranslation && styles.on)} onClick={() => setShowTranslation((v) => !v)}>
              <Icon name="translate" size={18} /> {showTranslation ? s.hideTranslation : s.translate}
            </button>
          )}
        </div>

        {turn.newWords.length > 0 && (
          <div className={styles.words}>
            {turn.newWords.map((w) => {
              const isSaved = savedWords.includes(w.word.toLowerCase());
              return (
                <div key={w.word} className={styles.word}>
                  <button type="button" className={styles.wordMain} onClick={() => onSpeak(w.word)}>
                    <b dir={tDir}>{w.word}</b>
                    <span dir={nDir}>{w.meaning}</span>
                  </button>
                  <button
                    type="button"
                    className={clsx(styles.save, isSaved && styles.savedBtn)}
                    disabled={isSaved}
                    onClick={() => onSaveWord(w)}
                  >
                    {isSaved ? <Icon name="check" size={16} /> : '+'} {isSaved ? s.saved : s.saveWord}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
