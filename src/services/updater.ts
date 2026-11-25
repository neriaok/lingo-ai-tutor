// Update flow with real progress: downloads every file of the new version (counting bytes),
// hands over to the new service worker, then reloads. Falls back to a clean reload if the
// service worker doesn't cooperate (some Android WebViews), so tapping "Update" always works.

export interface UpdateProgress {
  step: 'download' | 'install' | 'restart';
  percent: number;
}

export interface RemoteVersion {
  commit: string;
  builtAt: string;
}

const base = (): string => new URL('./', window.location.href).href;

export const fetchRemoteVersion = async (): Promise<RemoteVersion | null> => {
  try {
    const res = await fetch(`${base()}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as RemoteVersion;
  } catch {
    return null;
  }
};

/** Files of the new build, read from the new service worker's precache list. */
const listFiles = async (): Promise<string[]> => {
  try {
    const sw = await (await fetch(`${base()}sw.js?t=${Date.now()}`, { cache: 'no-store' })).text();
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
    return [...new Set(urls)];
  } catch {
    return ['index.html'];
  }
};

const download = async (url: string, onBytes: (n: number) => void): Promise<number> => {
  const res = await fetch(new URL(url, base()).href, { cache: 'reload' });
  const size = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const b = await res.arrayBuffer();
    onBytes(b.byteLength);
    return b.byteLength;
  }
  const reader = res.body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    onBytes(value.byteLength);
  }
  return size || total;
};

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const hardReload = async (): Promise<void> => {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
  window.location.replace(`${base()}?v=${Date.now()}`);
};

export const runUpdate = async (onProgress: (p: UpdateProgress) => void): Promise<void> => {
  // 1. Download (0–80%): fetch every file of the new version, tracking bytes.
  onProgress({ step: 'download', percent: 0 });
  const files = await listFiles();
  let done = 0;
  let loaded = 0;
  const estimated = files.length * 60_000; // rough until content-length is known
  for (const f of files) {
    try {
      await download(f, (n) => {
        loaded += n;
        const byFiles = (done / files.length) * 80;
        const byBytes = Math.min(80, (loaded / estimated) * 80);
        onProgress({ step: 'download', percent: Math.round(Math.max(byFiles, Math.min(byBytes, byFiles + 80 / files.length))) });
      });
    } catch {
      /* a single file failing doesn't stop the update */
    }
    done += 1;
    onProgress({ step: 'download', percent: Math.round((done / files.length) * 80) });
  }

  // 2. Install (80–95%): let the new service worker take over.
  onProgress({ step: 'install', percent: 85 });
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (reg) {
    await reg.update().catch(() => undefined);
    // Wait for the new worker to finish installing (its files are already in the HTTP cache).
    for (let i = 0; i < 40 && !reg.waiting; i += 1) {
      await wait(150);
      onProgress({ step: 'install', percent: Math.min(92, 85 + Math.floor(i / 5)) });
    }
    const switched = reg.waiting
      ? await new Promise<boolean>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
          setTimeout(() => resolve(false), 4000);
          reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        })
      : false;
    if (!switched) {
      // The old worker would keep serving the old files — clear it so the new version loads.
      onProgress({ step: 'restart', percent: 100 });
      await hardReload();
      return;
    }
  }

  // 3. Restart (100%).
  onProgress({ step: 'restart', percent: 100 });
  await wait(300);
  window.location.replace(`${base()}?v=${Date.now()}`);
};
