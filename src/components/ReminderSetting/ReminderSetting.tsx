import { useState, type FC } from 'react';
import { tutorInfo } from '../../data/catalog';
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch';
import { useStrings } from '../../hooks/useStrings';
import { updateProfile } from '../../features/profile/profileSlice';
import { disableReminder, enableReminder, type ReminderResult } from '../../services/reminders';
import styles from './ReminderSetting.module.css';

/** Daily practice reminder: on/off plus time. Applies immediately (not on "Save"). */
const ReminderSetting: FC = () => {
  const dispatch = useAppDispatch();
  const s = useStrings();
  const { reminderOn, reminderTime, native, tutor } = useAppSelector((st) => st.profile.data);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReminderResult | null>(null);

  const apply = async (on: boolean, time: string): Promise<void> => {
    setBusy(true);
    if (!on) {
      await disableReminder();
      dispatch(updateProfile({ reminderOn: false, reminderTime: time }));
      setResult(null);
      setBusy(false);
      return;
    }
    const [hour, minute] = time.split(':').map(Number);
    const name = tutorInfo(tutor).name;
    const r = await enableReminder({
      hour,
      minute,
      lang: native === 'he' ? 'he' : 'en',
      tutor,
      title: `${name}${s.reminderTitle}`,
      body: s.reminderBody,
    });
    dispatch(updateProfile({ reminderOn: r === 'ok', reminderTime: time }));
    setResult(r);
    setBusy(false);
  };

  const message: Record<ReminderResult, string> = {
    ok: s.reminderOk,
    denied: s.reminderDenied,
    'needs-install': s.reminderInstall,
    unsupported: s.reminderUnsupported,
    error: s.reminderError,
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.row}>
        <input
          type="checkbox"
          checked={reminderOn}
          disabled={busy}
          onChange={(e) => void apply(e.target.checked, reminderTime)}
        />
        <span>{s.reminderLabel}</span>
      </label>
      {reminderOn && (
        <label className={styles.time}>
          <span>{s.reminderTimeLabel}</span>
          <input
            type="time"
            value={reminderTime}
            disabled={busy}
            onChange={(e) => e.target.value && void apply(true, e.target.value)}
          />
        </label>
      )}
      {result && <p className={result === 'ok' ? styles.ok : styles.warn}>{message[result]}</p>}
    </div>
  );
};

export default ReminderSetting;
