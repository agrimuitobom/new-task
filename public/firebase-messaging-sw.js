/* eslint-env serviceworker */
/* global firebase */

// Firebase compat SDKs for Service Worker context
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCd_6a72oVMqSKWretMc040VrjJINqFzr4",
  authDomain: "new-task-d5127.firebaseapp.com",
  projectId: "new-task-d5127",
  storageBucket: "new-task-d5127.firebasestorage.app",
  messagingSenderId: "848366931136",
  appId: "1:848366931136:web:cdd2d8904f1f49bfe9f125",
});

const messaging = firebase.messaging();

// Background push handler — when the app is closed or in background
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "案件管理", {
    body: body || "",
    icon: icon || "./icon-192.png",
    badge: "./icon-192.png",
    data: payload.data || {},
  });
});

// Open the app when notification is clicked
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/new-task") && "focus" in client) return client.focus();
      }
      return clients.openWindow("/new-task/");
    })
  );
});
