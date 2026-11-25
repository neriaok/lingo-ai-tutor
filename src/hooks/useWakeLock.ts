import { useEffect } from 'react';

/** Keeps the screen on while `active` and the app is visible (re-acquired when you come back). */
export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release().catch(() => undefined);
      } catch {
        /* denied or unsupported */
      }
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
};
