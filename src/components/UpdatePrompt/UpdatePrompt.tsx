import type { FC } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStrings } from '../../hooks/useStrings';
import styles from './UpdatePrompt.module.css';

const CHECK_EVERY_MS = 15 * 60 * 1000;

/** Shows a one-tap "update now" bar as soon as a new version is deployed. */
const UpdatePrompt: FC = () => {
  const s = useStrings();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      // Look for new versions periodically and whenever the app comes back to the foreground.
      window.setInterval(() => void reg.update(), CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div className={styles.bar} role="status">
      <span>{s.updateReady}</span>
      <button type="button" className={styles.update} onClick={() => void updateServiceWorker(true)}>
        {s.updateNow}
      </button>
      <button type="button" className={styles.later} onClick={() => setNeedRefresh(false)} aria-label={s.closeChat}>
        ✕
      </button>
    </div>
  );
};

export default UpdatePrompt;
