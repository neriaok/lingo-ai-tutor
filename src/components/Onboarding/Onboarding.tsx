import { useState, type FC } from 'react';
import clsx from 'clsx';
import { GOALS, INTERESTS, LANGUAGES, LEVELS, TUTORS } from '../../data/catalog';
import { getStrings } from '../../data/strings';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { completeOnboarding } from '../../features/profile/profileSlice';
import { startSession } from '../../features/session/sessionSlice';
import type { CorrectionStyle, LangCode, Profile } from '../../types';
import ApiKeyForm from '../ApiKeyForm';
import Avatar from '../Avatar';
import ui from '../ui.module.css';
import styles from './Onboarding.module.css';

const STEPS = 8;
const DAILY = [5, 10, 15, 20, 30];

const Onboarding: FC = () => {
  const dispatch = useAppDispatch();
  const initial = useAppSelector((s) => s.profile.data);
  const [draft, setDraft] = useState<Profile>(initial);
  const [step, setStep] = useState(0);
  const [placement, setPlacement] = useState(false);
  const s = getStrings(draft.native);
  const isHe = draft.native === 'he';

  const patch = (p: Partial<Profile>): void => setDraft((d) => ({ ...d, ...p }));

  const handleNative = (code: LangCode): void => {
    patch({ native: code, target: code === draft.target ? (code === 'en' ? 'he' : 'en') : draft.target });
  };

  const toggleInterest = (id: string): void =>
    patch({ interests: draft.interests.includes(id) ? draft.interests.filter((i) => i !== id) : [...draft.interests, id] });

  const canNext =
    (step !== 1 || draft.native !== draft.target) && (step !== 3 || draft.interests.length >= 3);

  const handleFinish = (): void => {
    dispatch(completeOnboarding(draft));
    dispatch(startSession(placement ? 'placement' : 'free'));
  };

  return (
    <div className={styles.wrap} dir={isHe || draft.native === 'ar' ? 'rtl' : 'ltr'}>
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>

      {step === 0 && (
        <section className={styles.hero}>
          <div className={styles.stamp}>
            <Avatar tutor="maya" size={210} />
          </div>
          <h1 className={styles.brand}>{s.appName}</h1>
          <p className={styles.lead}>{s.tagline}</p>
          <div className={styles.row}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={clsx(ui.chip, draft.native === l.code && ui.chipOn)}
                onClick={() => handleNative(l.code)}
              >
                {isHe ? l.he : l.name}
              </button>
            ))}
          </div>
          <p className={ui.label}>{s.nativeLang}</p>
        </section>
      )}

      {step === 1 && (
        <section className={styles.step}>
          <h2>{s.stepLangs}</h2>
          <p className={ui.label}>{s.nativeLang}</p>
          <div className={styles.row}>
            {LANGUAGES.map((l) => (
              <button key={l.code} type="button" className={clsx(ui.chip, draft.native === l.code && ui.chipOn)} onClick={() => handleNative(l.code)}>
                <b className={styles.flag}>{l.flag}</b> {isHe ? l.he : l.name}
              </button>
            ))}
          </div>
          <p className={ui.label}>{s.targetLang}</p>
          <div className={styles.grid2}>
            {LANGUAGES.filter((l) => l.code !== draft.native).map((l) => (
              <button
                key={l.code}
                type="button"
                className={clsx(styles.bigOption, draft.target === l.code && styles.bigOn)}
                onClick={() => patch({ target: l.code })}
              >
                <b className={styles.flagBig}>{l.flag}</b>
                <span>{isHe ? l.he : l.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={styles.step}>
          <h2>{s.stepLevel}</h2>
          <div className={styles.levels}>
            {LEVELS.map((lv) => (
              <button
                key={lv.id}
                type="button"
                className={clsx(styles.level, !placement && draft.level === lv.id && styles.bigOn)}
                onClick={() => { patch({ level: lv.id }); setPlacement(false); }}
              >
                <b>{lv.id}</b>
                <span>
                  <strong>{isHe ? lv.he : lv.en}</strong>
                  <small>{isHe ? lv.heDesc : lv.enDesc}</small>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={clsx(styles.placement, placement && styles.bigOn)} onClick={() => setPlacement(true)}>
            {s.notSure}
          </button>
        </section>
      )}

      {step === 3 && (
        <section className={styles.step}>
          <h2>{s.stepInterests}</h2>
          <p className={ui.label}>{s.interestsHint} · {draft.interests.length}</p>
          <div className={styles.row}>
            {INTERESTS.map((i) => (
              <button key={i.id} type="button" className={clsx(ui.chip, draft.interests.includes(i.id) && ui.chipOn)} onClick={() => toggleInterest(i.id)}>
                {isHe ? i.he : i.en}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className={styles.step}>
          <h2>{s.stepGoal}</h2>
          <div className={styles.row}>
            {GOALS.map((g) => (
              <button key={g.id} type="button" className={clsx(ui.chip, draft.goal === g.id && ui.chipOn)} onClick={() => patch({ goal: g.id })}>
                {isHe ? g.he : g.en}
              </button>
            ))}
          </div>
          <p className={ui.label}>{s.correction}</p>
          <div className={styles.stack}>
            {([['instant', s.corrInstant], ['gentle', s.corrGentle], ['none', s.corrNone]] as [CorrectionStyle, string][]).map(([id, label]) => (
              <button key={id} type="button" className={clsx(styles.bigOption, styles.wide, draft.correction === id && styles.bigOn)} onClick={() => patch({ correction: id })}>
                {label}
              </button>
            ))}
          </div>
          <p className={ui.label}>{s.daily}</p>
          <div className={styles.row}>
            {DAILY.map((m) => (
              <button key={m} type="button" className={clsx(ui.chip, draft.dailyMinutes === m && ui.chipOn)} onClick={() => patch({ dailyMinutes: m })}>
                {m} {s.minutes}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 5 && (
        <section className={styles.step}>
          <h2>{s.stepTutor}</h2>
          <div className={styles.tutors}>
            {TUTORS.map((t) => (
              <button key={t.id} type="button" className={clsx(styles.tutor, draft.tutor === t.id && styles.bigOn)} onClick={() => patch({ tutor: t.id })}>
                <Avatar tutor={t.id} size={110} mood={draft.tutor === t.id ? 'encouraging' : 'happy'} />
                <strong>{t.name}</strong>
                <small>{isHe ? t.he : t.en}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 6 && (
        <section className={styles.step}>
          <div className={styles.stampSmall}>
            <Avatar tutor={draft.tutor} size={150} mood="encouraging" />
          </div>
          <h2>{s.stepName}</h2>
          <input
            className={styles.input}
            value={draft.name}
            maxLength={30}
            placeholder={s.namePlaceholder}
            onChange={(e) => patch({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setStep(7)}
          />
        </section>
      )}

      {step === 7 && (
        <section className={styles.step}>
          <h2>{s.stepKey}</h2>
          <ApiKeyForm initialKey={draft.apiKey} onValid={(apiKey) => patch({ apiKey })} />
        </section>
      )}

      <footer className={styles.footer}>
        {step > 0 && (
          <button type="button" className={clsx(ui.btn, ui.ghost)} onClick={() => setStep(step - 1)}>
            {s.back}
          </button>
        )}
        {step < STEPS - 1 ? (
          <button type="button" className={clsx(ui.btn, styles.grow)} disabled={!canNext} onClick={() => setStep(step + 1)}>
            {step === 0 ? s.start : s.next}
          </button>
        ) : (
          <button type="button" className={clsx(ui.btn, ui.pink, styles.grow)} onClick={handleFinish}>
            {s.finish}
          </button>
        )}
      </footer>
    </div>
  );
};

export default Onboarding;
