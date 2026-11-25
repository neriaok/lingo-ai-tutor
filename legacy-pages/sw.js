// The app moved to https://lingo.neriaokabik.workers.dev/ — this worker replaces the old one and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate('https://lingo.neriaokabik.workers.dev/');
  })());
});
