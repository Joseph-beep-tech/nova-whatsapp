import { getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig, getMessagingInstance, isFirebaseConfigured, VAPID_KEY } from '../config/firebase';
import api from './api';

export { isFirebaseConfigured };

interface PushPayload {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

/** Explicit opt-in only — call from a user-initiated "Enable notifications" click, never automatically. */
export async function enablePushNotifications(): Promise<boolean> {
  const messaging = await getMessagingInstance();
  if (!messaging || !VAPID_KEY) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  // The service worker is a static file (not bundled by Vite), so the public
  // Firebase config is threaded through as query params for it to read.
  const swParams = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    projectId: firebaseConfig.projectId ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams}`);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;

  await api.post('/push/subscribe', { token, platform: 'web' });
  return true;
}

/** Fires while the tab is focused. Backgrounded/closed-tab notifications are handled by firebase-messaging-sw.js instead. */
export function listenForForegroundMessages(onReceive: (payload: PushPayload) => void) {
  getMessagingInstance().then((messaging) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      onReceive({
        title: payload.notification?.title,
        body: payload.notification?.body,
        data: payload.data as Record<string, string> | undefined,
      });
    });
  });
}
