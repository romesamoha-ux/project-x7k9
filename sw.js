// Меняем версию кэша при каждом обновлении приложения!
const CACHE_NAME = 'book-app-cache-v1.8'; 

// Список файлов, которые нужны для работы приложения (включая иконки)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

// 1. Установка: кэшируем файлы
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('✅ Кэширование файлов приложения');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Активируем новый SW сразу
    );
});

// 2. Активация: удаляем старый кэш (чтобы не забивать память)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Берем контроль над страницей сразу
    );
});

// 3. Перехват запросов (Fetch): Сначала ищем в кэше, потом идем в сеть
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // Отдаем из кэша (Офлайн-режим!)
                }
                
                // Если нет в кэше, качаем из сети
                return fetch(event.request).catch(() => {
                    // СТРАХОВКА: Если сети нет и это попытка открыть страницу, 
                    // отдаем сохраненный index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});