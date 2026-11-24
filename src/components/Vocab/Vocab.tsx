import { useMemo, useState, type FC } from 'react';
import clsx from 'clsx';
import { langInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { useTutorVoice } from '../../hooks/useTutorVoice';
import { gradeCard, removeCard, toggleMistakeFixed } from '../../features/progress/progressSlice';
import { setView, startSession } from '../../features/session/sessionSlice';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Vocab.module.css';

const Vocab: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const say = useTutorVoice();
  const { target, native } = useAppSelector((st) => st.profile.data);
  const cards = useAppSelector((st) => st.progress.cards);
  const allMistakes = useAppSelector((st) => st.progress.mistakes);
  const [tab, setTab] = useState<'words' | 'mistakes'>('words');
  const [flipped, setFlipped] = useState(false);
  const [sessionStart] = useState(Date.now());
  const tDir = langInfo(target).rtl ? 'rtl' : 'ltr';
  const nDir = langInfo(native).rtl ? 'rtl' : 'ltr';

  const mine = useMemo(() => cards.filter((c) => c.lang === target), [cards, target]);
  const queue = useMemo(
    () => mine.filter((c) => c.due <= Math.max(Date.now(), sessionStart)).sort((a, b) => a.due - b.due),
    [mine, sessionStart],
  );
  const current = queue[0];
  const mistakes = useMemo(() => allMistakes.filter((m) => m.lang === target), [allMistakes, target]);

  const handleGrade = (grade: 0 | 1 | 2 | 3): void => {
    if (!current) return;
    dispatch(gradeCard({ id: current.id, grade }));
    setFlipped(false);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={ui.iconBtn} aria-label={s.back} onClick={() => dispatch(setView('home'))}>
          <span className={styles.backIcon}><Icon name="back" /></span>
        </button>
        <h1>{s.vocab}</h1>
        <span className={styles.count}>{queue.length} {s.dueNow}</span>
      </header>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'words'} className={clsx(styles.tab, tab === 'words' && styles.tabOn)} onClick={() => setTab('words')}>
          {s.tabWords} · {mine.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mistakes'} className={clsx(styles.tab, tab === 'mistakes' && styles.tabOn)} onClick={() => setTab('mistakes')}>
          {s.tabMistakes} · {mistakes.filter((m) => !m.fixed).length}
        </button>
      </div>

      {tab === 'mistakes' && (
        mistakes.length === 0 ? (
          <p className={clsx(ui.card, styles.empty)}>{s.noMistakes}</p>
        ) : (
          <ul className={styles.mistakes}>
            {mistakes.map((m) => (
              <li key={m.id} className={clsx(ui.card, m.fixed && styles.fixed)}>
                <p dir={tDir}><del>{m.original}</del> <ins>{m.corrected}</ins></p>
                <small dir={nDir}>{m.explanation}</small>
                <div className={styles.mRow}>
                  <span>{m.count} {s.times}</span>
                  <button type="button" className={clsx(styles.fixBtn, m.fixed && styles.fixOn)} onClick={() => dispatch(toggleMistakeFixed(m.id))}>
                    <Icon name="check" size={16} /> {s.markFixed}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'words' && mine.length >= 3 && (
        <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => dispatch(startSession('words'))}>
          <Icon name="phone" size={20} /> {s.practiseWords}
        </button>
      )}

      {tab === 'words' && (mine.length === 0 ? (
        <p className={clsx(ui.card, styles.empty)}>{s.noCards}</p>
      ) : current ? (
        <section className={styles.deck}>
          <button type="button" className={clsx(styles.card, flipped && styles.flipped)} onClick={() => { setFlipped(true); say(current.word); }}>
            <span className={styles.word} dir={tDir}>{current.word}</span>
            {flipped ? (
              <>
                <span className={styles.meaning} dir={nDir}>{current.meaning}</span>
                {current.example && <span className={styles.example} dir={tDir}>{current.example}</span>}
              </>
            ) : (
              <span className={styles.flipHint}>{s.flip}</span>
            )}
          </button>
          {flipped && (
            <div className={styles.grades}>
              <button type="button" className={styles.g0} onClick={() => handleGrade(0)}>{s.again}</button>
              <button type="button" className={styles.g1} onClick={() => handleGrade(1)}>{s.hard}</button>
              <button type="button" className={styles.g2} onClick={() => handleGrade(2)}>{s.good}</button>
              <button type="button" className={styles.g3} onClick={() => handleGrade(3)}>{s.easy}</button>
            </div>
          )}
        </section>
      ) : (
        <p className={clsx(ui.card, styles.empty, styles.done)}>{s.allDone}</p>
      ))}

      {tab === 'words' && mine.length > 0 && (
        <ul className={styles.list}>
          {[...mine].reverse().map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.listWord} onClick={() => say(c.word)}>
                <Icon name="speaker" size={16} />
                <b dir={tDir}>{c.word}</b>
                <span dir={nDir}>{c.meaning}</span>
              </button>
              <span className={styles.box} aria-label="level">{'●'.repeat(c.box + 1)}</span>
              <button type="button" className={styles.del} aria-label="delete" onClick={() => dispatch(removeCard(c.id))}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Vocab;
