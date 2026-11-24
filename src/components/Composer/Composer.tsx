import { useRef, useState, type FC, type FormEvent } from 'react';
import { useStrings } from '../../hooks/useStrings';
import Icon from '../Icon';
import styles from './Composer.module.css';

interface ComposerProps {
  suggestions: string[];
  disabled: boolean;
  targetRtl: boolean;
  onSend: (text: string) => void;
}

const Composer: FC<ComposerProps> = ({ suggestions, disabled, targetRtl, onSend }) => {
  const s = useStrings();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: FormEvent): void => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  };

  const handleSuggestion = (value: string): void => {
    setText(value);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.wrap}>
      {suggestions.length > 0 && !disabled && (
        <div className={styles.suggestions}>
          <span>{s.suggestions}</span>
          <div className={styles.chips}>
            {suggestions.map((sg) => (
              <button key={sg} type="button" dir={targetRtl ? 'rtl' : 'ltr'} onClick={() => handleSuggestion(sg)}>
                {sg}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          rows={1}
          dir="auto"
          value={text}
          placeholder={s.typeHere}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={disabled || !text.trim()} aria-label={s.send}>
          <Icon name="send" />
        </button>
      </form>
    </div>
  );
};

export default Composer;
