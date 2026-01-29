// ============================================================================
// NGM Hub - Firebase Messaging Service Worker
// ============================================================================
// This service worker handles push notifications in the background
// Must be at the root of the domain for proper scope

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration (must match the one in firebase-init.js)
const firebaseConfig = {
  apiKey: "AIzaSyDmeapFbTtmCLb2URK1ZO2DImOxLrhX0f4",
  authDomain: "ngm-connect-2db75.firebaseapp.com",
  projectId: "ngm-connect-2db75",
  storageBucket: "ngm-connect-2db75.firebasestorage.app",
  messagingSenderId: "679265932190",
  appId: "1:679265932190:web:9a6931cdefff7d01a3fc8f"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'NGM Hub';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: '/assets/img/greenblack_icon.png',
    badge: '/assets/img/greenblack_icon.png',
    tag: payload.data?.tag || 'ngm-notification',
    data: {
      url: payload.data?.url || '/messages.html',
      ...payload.data
    },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/messages.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the URL
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push event directly (fallback)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW] Push data:', data);
    } catch (e) {
      console.log('[SW] Push text:', event.data.text());
    }
  }
});

// Service worker install event
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});
