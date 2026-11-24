import { useState, type FC } from 'react';
import clsx from 'clsx';
import { SCENARIOS, langInfo, tutorInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { removeSession } from '../../features/history/historySlice';
import { resumeSession, setView } from '../../features/session/sessionSlice';
import type { SavedSession } from '../../types';
import Avatar from '../Avatar';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './History.module.css';

const History: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const native = useAppSelector((st) => st.profile.data.native);
  const sessions = useAppSelector((st) => st.history.sessions);
  const [openId, setOpenId] = useState<string | null>(null);
  const isHe = native === 'he';

  const dayLabel = (t: number): string => {
    const d = new Date(t);
    const today = new Date();
    const y = new Date(Date.now() - 86_400_000);
    const same = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString();
    const time = d.toLocaleTimeString(isHe ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    if (same(d, today)) return `${s.today} · ${time}`;
    if (same(d, y)) return `${s.yesterday} · ${time}`;
    return `${d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })} · ${time}`;
  };

  const handleContinue = (session: SavedSession): void => {
    dispatch(resumeSession(session));
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={ui.iconBtn} aria-label={s.back} onClick={() => dispatch(setView('home'))}>
          <span className={styles.flip}><Icon name="back" /></span>
        </button>
        <h1>{s.history}</h1>
      </header>

      {sessions.length === 0 && <p className={clsx(ui.card, styles.empty)}>{s.noHistory}</p>}

      <ul className={styles.list}>
        {sessions.map((x) => {
          const sc = SCENARIOS.find((v) => v.id === x.scenarioId) ?? SCENARIOS[0];
          const turns = x.messages.filter((m) => m.role === 'user').length;
          const open = openId === x.id;
          const tRtl = langInfo(x.target).rtl;
          return (
            <li key={x.id} className={clsx(ui.card, styles.item)}>
              <button type="button" className={styles.row} onClick={() => setOpenId(open ? null : x.id)} aria-expanded={open}>
                <Avatar tutor={x.tutor} size={54} />
                <span className={styles.meta}>
                  <strong>{sc.title[isHe ? 'he' : 'en']} · {tutorInfo(x.tutor).name}</strong>
                  <small>{dayLabel(x.updatedAt)} · {turns} {s.turns} · {x.level}</small>
                </span>
                {x.summary ? (
                  <span className={styles.score}>{x.summary.score}</span>
                ) : (
                  <span className={styles.tag}>{s.unfinished}</span>
                )}
              </button>
              {open && (
                <div className={styles.detail}>
                  {x.summary?.headline && <p className={styles.headline}>{x.summary.headline}</p>}
                  <div className={styles.transcript}>
                    {x.messages.map((m) => (
                      <p key={m.id} className={m.role === 'user' ? styles.me : styles.tutor} dir={m.role === 'user' ? 'auto' : tRtl ? 'rtl' : 'ltr'}>
                        {m.text}
                      </p>
                    ))}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => handleContinue(x)}>
                      <Icon name="phone" size={18} /> {s.continueCall}
                    </button>
                    <button type="button" className={clsx(ui.btn, ui.ghost)} onClick={() => dispatch(removeSession(x.id))}>
                      <Icon name="trash" size={18} /> {s.deleteSession}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default History;
