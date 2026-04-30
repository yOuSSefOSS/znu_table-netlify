importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyARuej7Qhj538EwO5W6PvN7Sit5XNp4BXc",
    authDomain: "aviation-timetable-v4.firebaseapp.com",
    projectId: "aviation-timetable-v4",
    storageBucket: "aviation-timetable-v4.firebasestorage.app",
    messagingSenderId: "934776767589",
    appId: "1:934776767589:web:d849f9bb8dd2ac654e328c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || "تنبيه جديد - الجدول الذكي";
  const notificationOptions = {
    body: payload.notification?.body || "لديك إشعار جديد",
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// PWA OFFLINE CACHING LOGIC (From original sw.js)
// ==========================================
const CACHE_NAME = 'timetable-v4';
const ASSETS_TO_CACHE = [
    './index.html',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened PWA cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.origin === location.origin || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then((response) => {
                        if (!response && event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return response;
                    });
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        return response; 
                    }
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
                        console.log('Failed to fetch offline resource:', event.request.url);
                    });
                })
        );
    }
});
