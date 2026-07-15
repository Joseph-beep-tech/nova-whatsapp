// Static file served as-is (not processed by Vite), so it can't read
// import.meta.env directly. push.service.ts passes the public Firebase
// config as query params when it registers this worker.
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('projectId') ? `${params.get('projectId')}.firebaseapp.com` : undefined,
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

// Fires when the tab/browser is backgrounded or closed — foreground messages
// are handled separately in push.service.ts's onMessage listener instead.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'NovaGo', {
    body: body || '',
    icon: '/favicon.ico',
    data: payload.data,
  });
});
