import type { FC } from 'react';
import clsx from 'clsx';
import { SCENARIOS, langInfo, levelIndex, tutorInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { dayKey } from '../../features/progress/progressSlice';
import { setView, startSession } from '../../features/session/sessionSlice';
import Avatar from '../Avatar';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Home.module.css';

const Home: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const profile = useAppSelector((st) => st.profile.data);
  const { xp, streak, cards, minutesByDay } = useAppSelector((st) => st.progress);
  const isHe = profile.native === 'he';
  const tutor = tutorInfo(profile.tutor);
  const target = langInfo(profile.target);
  const myCards = cards.filter((c) => c.lang === profile.target);
  const due = myCards.filter((c) => c.due <= Date.now()).length;
  const today = minutesByDay[dayKey()] ?? 0;
  const pct = Math.min(100, Math.round((today / profile.dailyMinutes) * 100));

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={ui.label}>
            {isHe ? target.he : target.name} · {profile.level}
          </p>
          <h1 className={styles.hello}>
            {s.hello}{profile.name ? `, ${profile.name}` : ''}
          </h1>
        </div>
        <button type="button" className={ui.iconBtn} aria-label={s.settings} onClick={() => dispatch(setView('settings'))}>
          <Icon name="gear" />
        </button>
      </header>

      <section className={styles.hero}>
        <div className={styles.portrait}>
          <Avatar tutor={profile.tutor} size={170} mood="encouraging" />
        </div>
        <div className={styles.heroText}>
          <div className={styles.stats}>
            <span><Icon name="flame" size={18} /> <b>{streak}</b> {s.streak}</span>
            <span><Icon name="star" size={18} /> <b>{xp}</b> {s.xp}</span>
            <span><Icon name="cards" size={18} /> <b>{myCards.length}</b> {s.words}</span>
          </div>
          <div className={styles.goal}>
            <div className={styles.goalTop}>
              <span>{s.todayGoal}</span>
              <b>{Math.round(today)}/{profile.dailyMinutes} {s.minutes}</b>
            </div>
            <div className={styles.bar}><span style={{ width: `${pct}%` }} /></div>
          </div>
          <button type="button" className={clsx(ui.btn, ui.pink)} onClick={() => dispatch(startSession('free'))}>
            <Icon name="phone" size={20} /> {s.callTutor}{tutor.name}
          </button>
        </div>
      </section>

      <button type="button" className={clsx(ui.card, styles.review)} onClick={() => dispatch(setView('vocab'))}>
        <span className={styles.reviewIcon}><Icon name="cards" /></span>
        <span className={styles.reviewText}>
          <strong>{s.review}</strong>
          <small>{due} {s.dueNow} · {myCards.length} {s.totalWords}</small>
        </span>
        {due > 0 && <span className={styles.badge}>{due}</span>}
      </button>

      <h2 className={styles.sectionTitle}>{s.pickScenario}</h2>
      <div className={styles.grid}>
        {SCENARIOS.slice(1).filter((sc) => sc.id !== 'words' || myCards.length >= 3).map((sc) => {
          const locked = !!sc.minLevel && levelIndex(profile.level) < levelIndex(sc.minLevel);
          return (
            <button
              key={sc.id}
              type="button"
              className={clsx(styles.scenario, sc.id === 'placement' && styles.placement)}
              onClick={() => dispatch(startSession(sc.id))}
            >
              <span className={styles.scIcon}><Icon name={sc.icon} /></span>
              <strong>{sc.title[isHe ? 'he' : 'en']}</strong>
              {locked && <small>{sc.minLevel}+</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
