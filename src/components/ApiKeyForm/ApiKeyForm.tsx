import { useState, type FC, type FormEvent } from 'react';
import clsx from 'clsx';
import { useStrings } from '../../hooks/useStrings';
import { validateKey } from '../../services/gemini/models';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './ApiKeyForm.module.css';

interface ApiKeyFormProps {
  initialKey: string;
  onValid: (key: string) => void;
}

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

/** Lets the learner paste their own free Gemini key; verifies it before saving. */
const ApiKeyForm: FC<ApiKeyFormProps> = ({ initialKey, onValid }) => {
  const s = useStrings();
  const [key, setKey] = useState(initialKey);
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>(initialKey ? 'ok' : 'idle');

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const value = key.trim();
    if (!value) return;
    setStatus('checking');
    const ok = await validateKey(value);
    setStatus(ok ? 'ok' : 'bad');
    if (ok) onValid(value);
  };

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <p className={styles.body}>{s.noKeyBody}</p>
      <a className={styles.link} href={AI_STUDIO_URL} target="_blank" rel="noreferrer">
        <Icon name="key" size={18} /> {s.getKey} ↗
      </a>
      <input
        className={clsx(styles.input, status === 'bad' && styles.bad, status === 'ok' && styles.ok)}
        value={key}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        placeholder={s.keyPlaceholder}
        onChange={(e) => {
          setKey(e.target.value);
          setStatus('idle');
        }}
      />
      {status === 'bad' && <p className={styles.err}>{s.keyBad}</p>}
      {status === 'ok' && <p className={styles.okText}><Icon name="check" size={16} /> {s.keyOk}</p>}
      <button type="submit" className={ui.btn} disabled={!key.trim() || status === 'checking' || status === 'ok'}>
        {status === 'checking' ? s.thinking : s.checkKey}
      </button>
    </form>
  );
};

export default ApiKeyForm;
