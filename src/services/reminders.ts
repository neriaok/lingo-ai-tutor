import { LocalNotifications } from '@capacitor/local-notifications';
import { isAndroidApp } from './nativeCall';

// Daily practice reminder.
// - Android app: a local, repeating notification (no server, works offline).
// - Web / iPhone home-screen app: Web Push from the lingo-push Cloudflare Worker (see /worker).

export const VAPID_PUBLIC_KEY = 'BDsqhgTMERc5lOP-hoX1Jkj2CKio3zHNyqxEe3mJIokC0blq24r53vG_AqC4reUvZUJu2YcOx2cKjkDBP9Q_PG8';
export const PUSH_URL: string = (import.meta.env.VITE_PUSH_URL as string | undefined) ?? '';

const LOCAL_ID = 1001;

export type ReminderResult = 'ok' | 'denied' | 'unsupported' | 'needs-install' | 'error';

interface ReminderOptions {
  hour: number;
  minute: number;
  lang: string;
  tutor: string;
  title: string;
  body: string;
}

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const toUint8 = (base64url: string): Uint8Array<ArrayBuffer> => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

export const enableReminder = async (o: ReminderOptions): Promise<ReminderResult> => {
  try {
    if (isAndroidApp()) {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return 'denied';
      await LocalNotifications.cancel({ notifications: [{ id: LOCAL_ID }] }).catch(() => undefined);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: LOCAL_ID,
            title: o.title,
            body: o.body,
            schedule: { on: { hour: o.hour, minute: o.minute }, allowWhileIdle: true },
          },
        ],
      });
      return 'ok';
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
    }
    if (isIos() && !isStandalone()) return 'needs-install';
    if (!PUSH_URL) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID_PUBLIC_KEY) }));
    const res = await fetch(`${PUSH_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        hour: o.hour,
        minute: o.minute,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: o.lang,
        tutor: o.tutor,
      }),
    });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
};

export const disableReminder = async (): Promise<void> => {
  try {
    if (isAndroidApp()) {
      await LocalNotifications.cancel({ notifications: [{ id: LOCAL_ID }] });
      return;
    }
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    if (PUSH_URL) {
      await fetch(`${PUSH_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
    }
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
};
