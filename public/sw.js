self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith('workbox-precache-')) await caches.delete(key); await self.clients.claim(); })()));
// No authenticated pages, Gmail data, or tokens are cached.
