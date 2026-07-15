import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './prisma';

let app: App | null = null;

function getApp(): App | null {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const credential = cert(JSON.parse(raw));
    app = getApps().length ? getApps()[0] : initializeApp({ credential });
    return app;
  } catch (err) {
    console.error('⚠️  FIREBASE_SERVICE_ACCOUNT is set but invalid — push notifications disabled:', err);
    return null;
  }
}

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Sends a push to a single rider's device. No-ops (logs) if Firebase isn't configured or the rider has no token. */
export async function sendToRider(riderId: string, message: PushMessage) {
  const firebaseApp = getApp();
  if (!firebaseApp) return;
  try {
    const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { fcmToken: true } });
    if (!rider?.fcmToken) return;
    await getMessaging(firebaseApp).send({
      token: rider.fcmToken,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
  } catch (err) {
    console.error(`⚠️  Push to rider ${riderId} failed:`, err);
  }
}

/** Sends a push to every subscribed admin/restaurant-staff device. No-ops if Firebase isn't configured or nobody's subscribed. */
export async function sendToAdmins(message: PushMessage) {
  const firebaseApp = getApp();
  if (!firebaseApp) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ select: { token: true } });
    if (!subs.length) return;
    await getMessaging(firebaseApp).sendEachForMulticast({
      tokens: subs.map((s) => s.token),
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
  } catch (err) {
    console.error('⚠️  Push to admins failed:', err);
  }
}
