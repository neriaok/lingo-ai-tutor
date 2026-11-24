import type { FC } from 'react';
import clsx from 'clsx';
import { langInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { setView, startSession } from '../../features/session/sessionSlice';
import Avatar from '../Avatar';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Summary.module.css';

const Summary: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const { summary, scenarioId } = useAppSelector((st) => st.session);
  const { tutor, target } = useAppSelector((st) => st.profile.data);
  const tDir = langInfo(target).rtl ? 'rtl' : 'ltr';
  if (!summary) return null;

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <Avatar tutor={tutor} mood={summary.score >= 60 ? 'happy' : 'encouraging'} size={140} />
        <div className={styles.score}>
          <b>{summary.score}</b>
          <span>/100</span>
        </div>
        <h1>{s.summaryTitle}</h1>
        <p>{summary.headline}</p>
        <span className={styles.xp}><Icon name="star" size={18} /> +{summary.xp} {s.xp}</span>
      </section>

      {summary.strengths.length > 0 && (
        <section className={clsx(ui.card, styles.block)}>
          <h2>{s.strengths}</h2>
          <ul>{summary.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      )}

      {summary.mistakes.length > 0 && (
        <section className={clsx(ui.card, styles.block)}>
          <h2>{s.mistakesTitle}</h2>
          {summary.mistakes.map((m) => (
            <div key={m.original} className={styles.mistake}>
              <p dir={tDir}><del>{m.original}</del> <ins>{m.corrected}</ins></p>
              <small>{m.explanation}</small>
            </div>
          ))}
        </section>
      )}

      {summary.tip && (
        <section className={clsx(styles.block, styles.tip)}>
          <h2>{s.tipTitle}</h2>
          <p>{summary.tip}</p>
        </section>
      )}

      <div className={styles.actions}>
        <button type="button" className={clsx(ui.btn, ui.ghost)} onClick={() => dispatch(setView('home'))}>{s.backHome}</button>
        <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => dispatch(startSession(scenarioId))}>↻</button>
      </div>
    </div>
  );
};

export default Summary;
