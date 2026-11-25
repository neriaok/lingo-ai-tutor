/* Daily reminder notifications (imported into the generated service worker). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const tutor = data.tutor || 'maya';
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lingo', {
      body: data.body || '',
      icon: `./avatars/${tutor}-poster.jpg`,
      badge: './favicon.png',
      tag: 'lingo-daily',
      renotify: true,
      data: { url: self.registration.scope },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(url) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
