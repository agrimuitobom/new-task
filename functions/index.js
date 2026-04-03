const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

initializeApp();

/**
 * Runs every morning at 8:00 AM JST.
 * Checks all users' cases for approaching deadlines (≤ 3 days)
 * and sends push notifications to their registered devices.
 */
exports.notifyDeadlines = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Tokyo", region: "asia-northeast1" },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();

    // Get all FCM tokens grouped by user
    const tokenSnap = await db.collection("fcmTokens").get();
    const tokensByUid = {};
    tokenSnap.forEach((doc) => {
      const { uid, token } = doc.data();
      if (!tokensByUid[uid]) tokensByUid[uid] = [];
      tokensByUid[uid].push({ token, docId: doc.id });
    });

    if (Object.keys(tokensByUid).length === 0) {
      logger.info("No FCM tokens registered");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const uid of Object.keys(tokensByUid)) {
      // Read user's cases
      const casesSnap = await db.collection("users").doc(uid).collection("cases").get();
      const urgent = [];

      casesSnap.forEach((doc) => {
        const c = doc.data();
        if (c.archived || c.status === "done" || !c.deadline) return;
        const deadline = new Date(c.deadline);
        const diff = Math.ceil((deadline - today) / 86400000);
        if (diff <= 3) {
          const label = diff < 0 ? `${Math.abs(diff)}日超過` : diff === 0 ? "本日締切" : `あと${diff}日`;
          urgent.push(`・${c.name}（${label}）`);
        }
      });

      if (urgent.length === 0) continue;

      const body = urgent.join("\n");
      const tokens = tokensByUid[uid];

      for (const { token, docId } of tokens) {
        try {
          await messaging.send({
            token,
            notification: {
              title: `案件管理 - ${urgent.length}件の期限通知`,
              body,
            },
            webpush: {
              fcmOptions: { link: "/new-task/" },
            },
          });
          logger.info(`Sent notification to ${uid} (${docId})`);
        } catch (err) {
          // If token is invalid, remove it
          if (
            err.code === "messaging/invalid-registration-token" ||
            err.code === "messaging/registration-token-not-registered"
          ) {
            await db.collection("fcmTokens").doc(docId).delete();
            logger.info(`Removed stale token ${docId}`);
          } else {
            logger.error(`Error sending to ${docId}:`, err);
          }
        }
      }
    }
  }
);
