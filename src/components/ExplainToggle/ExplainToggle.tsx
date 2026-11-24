import type { FC } from 'react';
import clsx from 'clsx';
import { langInfo } from '../../data/catalog';
import type { ExplainMode, LangCode } from '../../types';
import styles from './ExplainToggle.module.css';

interface ExplainToggleProps {
  value: ExplainMode;
  native: LangCode;
  target: LangCode;
  label: string;
  onChange: (mode: ExplainMode) => void;
}

/** Two-way switch: everything in the target language, or explanations in the native one. */
const ExplainToggle: FC<ExplainToggleProps> = ({ value, native, target, label, onChange }) => {
  const isHe = native === 'he';
  const t = langInfo(target);
  const n = langInfo(native);
  const options: { id: ExplainMode; text: string }[] = [
    { id: 'target', text: isHe ? `רק ${t.he}` : `${t.name} only` },
    { id: 'mixed', text: isHe ? `+ הסברים ב${n.he}` : `+ ${n.name} explanations` },
  ];

  return (
    <div className={styles.toggle} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={clsx(styles.option, value === o.id && styles.on)}
          onClick={() => value !== o.id && onChange(o.id)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
};

export default ExplainToggle;
