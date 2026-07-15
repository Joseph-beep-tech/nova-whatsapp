import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

// Public Firebase Web config — safe to embed client-side. Populate these once
// you've created the Firebase project (see the "Web app" step in the plan).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let app: FirebaseApp | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && VAPID_KEY);
}

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

/** Resolves to null when Firebase isn't configured yet, or the browser doesn't support the Messaging API (e.g. Safari without a service worker). */
export async function getMessagingInstance(): Promise<Messaging | null> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!(await isSupported())) return null;
  return getMessaging(firebaseApp);
}
