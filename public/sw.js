// Service Worker for NewFriends.br PWA - Background SOS Support
const CACHE_NAME = 'newfriends-sos-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[Service Worker] Installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[Service Worker] Activated');
});

// Sync registration fallback for background support
self.addEventListener('sync', (event) => {
  if (event.tag === 'sos-sync') {
    console.log('[Service Worker] Background SOS Sync running');
  }
});

// Standard fetch event listener for cache/offline capability
self.addEventListener('fetch', (event) => {
  // Let standard fetch queries pass through
});
