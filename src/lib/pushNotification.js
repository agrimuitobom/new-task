import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { messagingPromise, db } from "../firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

/**
 * Register the FCM service worker, request permission, get token, save to Firestore.
 * Returns the FCM token string or null on failure.
 */
export async function subscribePush(userId) {
  const messaging = await messagingPromise;
  if (!messaging) { console.warn("FCM not supported"); return null; }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // Register the dedicated FCM service worker
  const swReg = await navigator.serviceWorker.register("/new-task/firebase-messaging-sw.js", { scope: "/new-task/" });

  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  if (!token) return null;

  // Save token to Firestore so Cloud Function can send to this device
  await setDoc(doc(db, "fcmTokens", `${userId}_${token.slice(-8)}`), {
    uid: userId,
    token,
    updatedAt: serverTimestamp(),
    platform: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
  });

  return token;
}

/**
 * Listen for foreground messages and show as Notification.
 */
export async function listenForeground() {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {};
    if (title) new Notification(title, { body, icon: "./icon-192.png" });
  });
}
