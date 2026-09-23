// THOCB Admin PWA service worker - deliberately minimal. No caching strategy: admin data (guest
// info, payment status, private notes) must always be loaded fresh, never served stale from a
// cache, so this never intercepts real navigation/data requests. It exists mainly to make
// admin.html installable (Chrome requires an active service worker with a fetch handler for "Add
// to Home Screen" eligibility, even a no-op one) and to receive/display push notifications.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Required for installability, intentionally does nothing - every request just falls through to
// the network exactly as if there were no service worker at all.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* malformed payload - show a generic fallback below */ }
  const title = data.title || 'The Heart Of CB';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    // Android's status-bar badge ignores color entirely and derives its own shape from the alpha
    // channel - pointing it at the full-color icon (opaque, no transparency) produced a plain
    // white square. badge-monochrome.png is a dedicated white-silhouette-on-transparent cutout of
    // just the pin, built for exactly this. `icon` above still shows full color in the expanded
    // notification tray - only the tiny status-bar badge needs the monochrome version.
    badge: '/badge-monochrome.png',
    data: { url: data.url || '/admin.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focuses an already-open admin tab instead of always opening a new one - Jesse's likely to
// already have admin.html open when a notification comes in.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url || '/admin.html';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes('admin.html') && 'focus' in client) return client.focus();
    }
    return clients.openWindow(url);
  })());
});
