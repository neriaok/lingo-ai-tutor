import { useCallback, useEffect, useState, type FC } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStrings } from '../../hooks/useStrings';
import { fetchRemoteVersion, runUpdate, type UpdateProgress } from '../../services/updater';
import styles from './UpdatePrompt.module.css';

const CHECK_EVERY_MS = 10 * 60 * 1000;

/** "New version" bar with a real progress bar while the update downloads and installs. */
const UpdatePrompt: FC = () => {
  const s = useStrings();
  const [available, setAvailable] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  // Two independent signals: the service worker found a new build, or version.json changed.
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      window.setInterval(() => void reg.update(), CHECK_EVERY_MS);
    },
  });

  const check = useCallback(async () => {
    const remote = await fetchRemoteVersion();
    if (remote && remote.commit !== __APP_COMMIT__ && __APP_COMMIT__ !== 'dev') setAvailable(remote.commit);
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const handleUpdate = (): void => {
    setProgress({ step: 'download', percent: 0 });
    void runUpdate(setProgress);
  };

  const show = (needRefresh || available) && !dismissed;
  if (!show && !progress) return null;

  if (progress) {
    const label = progress.step === 'download' ? s.updDownloading : progress.step === 'install' ? s.updInstalling : s.updRestarting;
    return (
      <div className={styles.overlay} role="status" aria-live="polite">
        <div className={styles.card}>
          <strong>{s.updTitle}</strong>
          <div className={styles.track} aria-hidden="true">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <div className={styles.meta}>
            <span>{label}</span>
            <b dir="ltr">{progress.percent}%</b>
          </div>
          {available && <small dir="ltr">{__APP_COMMIT__} → {available}</small>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bar} role="status">
      <span>{s.updateReady}</span>
      <button type="button" className={styles.update} onClick={handleUpdate}>
        {s.updateNow}
      </button>
      <button type="button" className={styles.later} onClick={() => setDismissed(true)} aria-label={s.closeChat}>
        ✕
      </button>
    </div>
  );
};

export default UpdatePrompt;
