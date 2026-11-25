/**
 * Lingo daily reminders.
 *
 * POST /subscribe    { subscription, hour, minute, timeZone, lang, tutor }
 * POST /unsubscribe  { endpoint }
 * GET  /health
 * Cron (every 15 min): sends each subscriber one reminder per day in their chosen local slot.
 *
 * Everything a subscriber needs lives in the KV key's metadata, so the cron run can work
 * from list() alone (no per-key reads) and stays far inside the free-plan limits.
 */
import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';

interface Env {
  SUBS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

interface Subscriber {
  sub: PushSubscription;
  h: number;
  m: number;
  tz: string;
  lang: string;
  tutor: string;
  /** Local date (YYYY-MM-DD) of the last reminder, so nobody gets two in a day. */
  last?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const keyFor = async (endpoint: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
};

const TUTOR_NAMES: Record<string, string> = { maya: 'Maya', leo: 'Leo', noa: 'Noa', sam: 'Sam' };

const MESSAGES: Record<string, { title: (t: string) => string; bodies: string[] }> = {
  he: {
    title: (t) => `${t} מחכה לך 👋`,
    bodies: [
      'כמה דקות של שיחה היום ושומרים על הרצף 🔥',
      'בוא נתרגל קצת אנגלית — אפילו 5 דקות עושות הבדל',
      'יש לי שאלה חדשה בשבילך. נדבר? 🎙️',
      'המילים ששמרת מחכות לחזרה 📚',
    ],
  },
  en: {
    title: (t) => `${t} is waiting for you 👋`,
    bodies: [
      'A few minutes of talking today keeps your streak alive 🔥',
      "Let's practise a little — even 5 minutes makes a difference",
      "I've got a new question for you. Shall we talk? 🎙️",
      'Your saved words are ready for review 📚',
    ],
  },
};

const localParts = (tz: string, now: Date): { date: string; h: number; m: number } => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour), m: Number(p.minute) };
};

const isValidTz = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const send = async (env: Env, s: Subscriber): Promise<number> => {
  const msg = MESSAGES[s.lang] ?? MESSAGES.en;
  const tutor = TUTOR_NAMES[s.tutor] ?? 'Lingo';
  const body = msg.bodies[Math.floor(Math.random() * msg.bodies.length)];
  const vapid: VapidKeys = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const payload = await buildPushPayload(
    { data: JSON.stringify({ title: msg.title(tutor), body, tutor: s.tutor }), options: { ttl: 6 * 3600, urgency: 'normal' } },
    s.sub,
    vapid,
  );
  const res = await fetch(s.sub.endpoint, payload);
  return res.status;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return json({ ok: true });

    if (req.method === 'POST' && url.pathname === '/subscribe') {
      const b = (await req.json().catch(() => null)) as Partial<{ subscription: PushSubscription; hour: number; minute: number; timeZone: string; lang: string; tutor: string }> | null;
      const sub = b?.subscription;
      if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return json({ ok: false, error: 'bad subscription' }, 400);
      const h = Math.min(23, Math.max(0, Math.floor(Number(b?.hour))));
      const m = Math.min(59, Math.max(0, Math.floor(Number(b?.minute))));
      const tz = b?.timeZone && isValidTz(b.timeZone) ? b.timeZone : 'UTC';
      const record: Subscriber = {
        sub: { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        h,
        m,
        tz,
        lang: b?.lang === 'he' ? 'he' : 'en',
        tutor: typeof b?.tutor === 'string' ? b.tutor.slice(0, 12) : 'maya',
      };
      await env.SUBS.put(await keyFor(sub.endpoint), '1', { metadata: record });
      return json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/unsubscribe') {
      const b = (await req.json().catch(() => null)) as { endpoint?: string } | null;
      if (b?.endpoint) await env.SUBS.delete(await keyFor(b.endpoint));
      return json({ ok: true });
    }

    return json({ ok: false, error: 'not found' }, 404);
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = new Date();
    let cursor: string | undefined;
    do {
      const page = await env.SUBS.list<Subscriber>({ cursor });
      cursor = page.list_complete ? undefined : page.cursor;
      for (const k of page.keys) {
        const s = k.metadata;
        if (!s) continue;
        const local = localParts(s.tz, now);
        const due = local.h * 60 + local.m - (s.h * 60 + s.m);
        // Fire once in the first 15-minute run at or after the chosen time.
        if (due < 0 || due >= 15 || s.last === local.date) continue;
        try {
          const status = await send(env, s);
          if (status === 404 || status === 410) {
            await env.SUBS.delete(k.name); // subscription expired or revoked
          } else if (status < 300) {
            await env.SUBS.put(k.name, '1', { metadata: { ...s, last: local.date } });
          }
        } catch {
          /* try again next run */
        }
      }
    } while (cursor);
  },
} satisfies ExportedHandler<Env>;
