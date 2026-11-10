// Loaded into the site's service worker (see importScripts in vite.config.js).
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Company OS', {
      body: payload.body || '',
      icon: '/company-icon-192.png',
      badge: '/company-icon-192.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: payload.url || '/company/inbox' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/company/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith('/company'));
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
