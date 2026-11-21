// Loaded into the site's service worker (see importScripts in vite.config.js).
// שני סוגי התראות באותו SW:
//   payload.app === 'sterni' → האפליקציה הראשית (מטלות/פרויקטים שהוקצו לך — server/services/assignmentNotifier.js)
//   אחרת                    → Company OS (server/companyos/push.js)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  if (payload.app === 'sterni') {
    event.waitUntil(
      self.registration.showNotification(payload.title || 'עדכון חדש', {
        body: payload.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        dir: 'rtl',
        lang: 'he',
        tag: payload.tag || undefined,
        renotify: !!payload.tag,        // תזכורת על אותה מטלה מצלצלת שוב
        requireInteraction: true,       // נשאר על המסך עד שנוגעים בו
        vibrate: [200, 100, 200, 100, 400],
        data: { url: payload.url || '/tasks', app: 'sterni' },
      })
    );
    return;
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
  const data = event.notification.data || {};

  if (data.app === 'sterni') {
    const target = data.url || '/tasks';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        const open = windows.find((client) => !new URL(client.url).pathname.startsWith('/company'));
        if (open) {
          open.navigate(target);
          return open.focus();
        }
        return self.clients.openWindow(target);
      })
    );
    return;
  }

  const target = data.url || '/company/';
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
