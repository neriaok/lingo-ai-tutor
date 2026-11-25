import { useState, type FC } from 'react';
import clsx from 'clsx';
import { INTERESTS, LANGUAGES, LEVELS, TUTORS } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { updateProfile } from '../../features/profile/profileSlice';
import { setView } from '../../features/session/sessionSlice';
import { clearAll } from '../../services/storage';
import type { CorrectionStyle, LangCode, Profile, ThinkTime, TurnMode } from '../../types';
import ApiKeyForm from '../ApiKeyForm';
import ExplainToggle from '../ExplainToggle';
import TutorPortrait from '../TutorPortrait';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './Settings.module.css';

const Settings: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const profile = useAppSelector((st) => st.profile.data);
  const [draft, setDraft] = useState<Profile>(profile);
  const [confirmReset, setConfirmReset] = useState(false);
  const isHe = profile.native === 'he';

  const patch = (p: Partial<Profile>): void => setDraft((d) => ({ ...d, ...p }));

  const handleNative = (code: LangCode): void =>
    patch({ native: code, target: code === draft.target ? (code === 'en' ? 'he' : 'en') : draft.target });

  const toggleInterest = (id: string): void =>
    patch({ interests: draft.interests.includes(id) ? draft.interests.filter((i) => i !== id) : [...draft.interests, id] });

  const handleSave = (): void => {
    dispatch(updateProfile(draft));
    dispatch(setView('home'));
  };

  const handleReset = (): void => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearAll();
    window.location.reload();
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={ui.iconBtn} aria-label={s.back} onClick={() => dispatch(setView('home'))}>
          <span className={styles.backIcon}><Icon name="back" /></span>
        </button>
        <h1>{s.settings}</h1>
      </header>

      <div className={styles.field}>
        <span className={ui.label}>{s.apiKey}</span>
        <ApiKeyForm initialKey={draft.apiKey} onValid={(apiKey) => { patch({ apiKey }); dispatch(updateProfile({ apiKey })); }} />
      </div>

      <label className={styles.field}>
        <span className={ui.label}>{s.stepName}</span>
        <input className={styles.input} value={draft.name} maxLength={30} onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <div className={styles.field}>
        <span className={ui.label}>{s.nativeLang}</span>
        <div className={styles.row}>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" className={clsx(ui.chip, draft.native === l.code && ui.chipOn)} onClick={() => handleNative(l.code)}>
              {isHe ? l.he : l.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.targetLang}</span>
        <div className={styles.row}>
          {LANGUAGES.filter((l) => l.code !== draft.native).map((l) => (
            <button key={l.code} type="button" className={clsx(ui.chip, draft.target === l.code && ui.chipOn)} onClick={() => patch({ target: l.code })}>
              {isHe ? l.he : l.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.stepLevel}</span>
        <div className={styles.row}>
          {LEVELS.map((lv) => (
            <button key={lv.id} type="button" className={clsx(ui.chip, draft.level === lv.id && ui.chipOn)} onClick={() => patch({ level: lv.id })}>
              {lv.id} · {isHe ? lv.he : lv.en}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.stepInterests}</span>
        <div className={styles.row}>
          {INTERESTS.map((i) => (
            <button key={i.id} type="button" className={clsx(ui.chip, draft.interests.includes(i.id) && ui.chipOn)} onClick={() => toggleInterest(i.id)}>
              {isHe ? i.he : i.en}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.stepTutor}</span>
        <div className={styles.tutors}>
          {TUTORS.map((t) => (
            <button key={t.id} type="button" className={clsx(styles.tutor, draft.tutor === t.id && styles.tutorOn)} onClick={() => patch({ tutor: t.id })}>
              <TutorPortrait tutor={t.id} size={64} className={styles.pick} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.correction}</span>
        <div className={styles.row}>
          {([['instant', s.corrInstant], ['gentle', s.corrGentle], ['none', s.corrNone]] as [CorrectionStyle, string][]).map(([id, label]) => (
            <button key={id} type="button" className={clsx(ui.chip, draft.correction === id && ui.chipOn)} onClick={() => patch({ correction: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.explainLabel}</span>
        <ExplainToggle value={draft.explainMode} native={draft.native} target={draft.target} label={s.explainLabel} onChange={(explainMode) => patch({ explainMode })} />
      </div>

      <div className={styles.field}>
        <span className={ui.label}>{s.turnModeLabel}</span>
        <div className={styles.row}>
          {([['auto', s.turnAuto], ['tap', s.turnTap]] as [TurnMode, string][]).map(([id, label]) => (
            <button key={id} type="button" className={clsx(ui.chip, draft.turnMode === id && ui.chipOn)} onClick={() => patch({ turnMode: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {draft.turnMode === 'auto' && (
        <div className={styles.field}>
          <span className={ui.label}>{s.thinkTimeLabel}</span>
          <div className={styles.row}>
            {([['short', s.thinkShort], ['normal', s.thinkNormal], ['long', s.thinkLong]] as [ThinkTime, string][]).map(([id, label]) => (
              <button key={id} type="button" className={clsx(ui.chip, draft.thinkTime === id && ui.chipOn)} onClick={() => patch({ thinkTime: id })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className={styles.field}>
        <span className={ui.label}>{s.speechRate} · {draft.speechRate.toFixed(2)}×</span>
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.05}
          value={draft.speechRate}
          className={styles.range}
          onChange={(e) => patch({ speechRate: Number(e.target.value) })}
        />
      </label>

      <label className={styles.toggle}>
        <input type="checkbox" checked={draft.videoAvatar} onChange={(e) => patch({ videoAvatar: e.target.checked })} />
        <span>{s.videoAvatar}</span>
      </label>

      <label className={styles.toggle}>
        <input type="checkbox" checked={draft.autoSpeak} onChange={(e) => patch({ autoSpeak: e.target.checked })} />
        <span>{s.autoSpeak}</span>
      </label>

      <details className={styles.advanced}>
        <summary>{s.advanced}</summary>
        <label className={styles.field}>
          <span className={ui.label}>{s.liveModel}</span>
          <input className={styles.input} dir="ltr" value={draft.liveModel} onChange={(e) => patch({ liveModel: e.target.value.trim() })} />
        </label>
        <label className={styles.field}>
          <span className={ui.label}>{s.textModel}</span>
          <input className={styles.input} dir="ltr" value={draft.textModel} onChange={(e) => patch({ textModel: e.target.value.trim() })} />
        </label>
      </details>

      <div className={styles.actions}>
        <button type="button" className={clsx(ui.btn, ui.pink)} onClick={handleSave}>{s.save}</button>
        <button type="button" className={clsx(ui.btn, ui.ghost, confirmReset && styles.danger)} onClick={handleReset}>
          {confirmReset ? `${s.resetAll}?` : s.resetAll}
        </button>
      </div>

      <p className={styles.version} dir="ltr">Lingo · {__APP_VERSION__}</p>
    </div>
  );
};

export default Settings;
