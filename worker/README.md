# lingo-push

Cloudflare Worker that sends Lingo's daily practice reminders as Web Push notifications
(used by the web / iPhone home-screen app; the Android app schedules local notifications instead).

- `POST /subscribe` — `{ subscription, hour, minute, timeZone, lang, tutor }`
- `POST /unsubscribe` — `{ endpoint }`
- Cron every 15 minutes sends each subscriber one reminder per day at their local time.

Subscribers are stored in the `SUBS` KV namespace; everything needed lives in key metadata,
so a cron run only uses `list()` — well within the Workers Free plan.

Deployed automatically by Cloudflare Workers Builds on pushes to `main` that touch `worker/`.
Manual deploy:

```bash
npm install
npx wrangler secret put VAPID_PRIVATE_KEY   # private half of the VAPID key pair
npm run deploy
```

The public VAPID key is in `wrangler.toml` and in `src/services/reminders.ts` of the app.
