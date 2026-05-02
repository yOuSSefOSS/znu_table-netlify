const CACHE_NAME = 'timetable-v4.2';
const ASSETS_TO_CACHE = [
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    // Force the waiting service worker to become the active service worker.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Delete any old caches to ensure we have the newest files
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Tell the active service worker to take control of the page immediately.
    self.clients.claim();
});

// Stale-while-revalidate strategy for the main application files
// Network-first for external CDNs (fonts/icons) falling back to cache if offline
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass Service Worker for Firebase/Google APIs to avoid CORS/Upload issues
    if (url.hostname.includes('firebase') || url.hostname.includes('googleapis.com')) {
        return; 
    }

    // For our core files, try the network first to get updates, fallback to cache if offline
    if (url.origin === location.origin || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone the response and dynamically add it to the cache
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed (offline), try the cache
                    return caches.match(event.request).then((response) => {
                        // If it's the root path, serve index.html as fallback
                        if (!response && event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return response;
                    });
                })
        );
    } else {
        // For external resources (fonts, tailwind, CDN), Cache First strategy
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        return response; // Return from cache
                    }
                    // If not in cache, fetch from network and then cache it
                    return fetch(event.request).then((networkResponse) => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                        return networkResponse;
                    }).catch(() => {
                        // Offline and resource not in cache
                        console.log('Failed to fetch offline resource:', event.request.url);
                    });
                })
        );
    }
});
