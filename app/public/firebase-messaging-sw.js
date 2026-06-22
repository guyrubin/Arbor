/**
 * C2 — FCM background push handler (service worker context).
 *
 * PRIVACY CONTRACT:
 *   - Notification body is ALWAYS generic. _payload is intentionally unused
 *     for display. No child name, milestone, score, or behavioral data ever
 *     appears in a shown notification.
 *   - Deep link is always "/" — never a child-scoped URL.
 *   - No child data is written to the SW cache or the Notifications API.
 *
 * DEPLOY-INFRA — time-of-day trigger:
 *   The send-at-JITAI-hour loop is a Cloud Scheduler + Cloud Function, NOT a
 *   client timer. Steps once infra is ready:
 *   1. Deploy sendNudgePush (server/pushTokens.ts) as a Cloud Function.
 *   2. Create Cloud Scheduler job: schedule "0 * * * *", body {"window":"current"}.
 *   3. Grant Scheduler SA the Cloud Functions Invoker role.
 *   The /api/push/test-send route proves the full FCM path before that wiring.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey:            params.get("apiKey")            || "",
  authDomain:        params.get("authDomain")        || "",
  projectId:         params.get("projectId")         || "",
  storageBucket:     params.get("storageBucket")     || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId:             params.get("appId")             || "",
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((_payload) => {
    // _payload deliberately unused for display — generic message only.
    self.registration.showNotification("Arbor has a moment for you", {
      body: "Open Arbor to see what's ready for today.",
      icon: "/arbor-icon-192.png",
      badge: "/arbor-icon-96.png",
      data: { url: "/" },
      tag: "arbor-nudge",
    });
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow("/");
      }),
    );
  });
}
