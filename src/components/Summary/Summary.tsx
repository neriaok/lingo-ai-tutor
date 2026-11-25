import type { FC } from 'react';
import clsx from 'clsx';
import { LEVELS, langInfo, levelIndex } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { updateProfile } from '../../features/profile/profileSlice';
import { setView, startSession } from '../../features/session/sessionSlice';
import TutorPortrait from '../TutorPortrait';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Summary.module.css';

const Summary: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const { summary, scenarioId } = useAppSelector((st) => st.session);
  const { tutor, target, level } = useAppSelector((st) => st.profile.data);
  const sessions = useAppSelector((st) => st.history.sessions);
  // Suggest moving up after three strong conversations in a row at the current level.
  const recent = sessions.filter((x) => x.summary && x.target === target && x.level === level).slice(0, 3);
  const nextLevel = LEVELS[levelIndex(level) + 1]?.id;
  const readyToLevelUp =
    !!nextLevel && recent.length === 3 && recent.every((x) => (x.summary?.score ?? 0) >= 85);
  const tDir = langInfo(target).rtl ? 'rtl' : 'ltr';
  if (!summary) return null;

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <TutorPortrait tutor={tutor} mood={summary.score >= 60 ? 'happy' : 'encouraging'} size={140} className={styles.portrait} />
        <div className={styles.score}>
          <b>{summary.score}</b>
          <span>/100</span>
        </div>
        <h1>{s.summaryTitle}</h1>
        <p>{summary.headline}</p>
        <span className={styles.xp}><Icon name="star" size={18} /> +{summary.xp} {s.xp}</span>
      </section>

      {readyToLevelUp && nextLevel && (
        <section className={clsx(styles.block, styles.levelUp)}>
          <h2>{s.levelUpTitle}</h2>
          <p>{s.levelUpBody}</p>
          <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => dispatch(updateProfile({ level: nextLevel }))}>
            {s.levelUpBtn}{nextLevel}
          </button>
        </section>
      )}

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
