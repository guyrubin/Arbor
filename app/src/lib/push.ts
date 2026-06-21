/**
 * C2 — Client-side FCM push capability helpers.
 *
 * OFF BY DEFAULT: pushCapable() returns false unless VITE_FIREBASE_VAPID_KEY
 * is present in the Vite build. Without it the entire feature is dead code.
 *
 * CONSENT-GATED: registerPush() MUST only be called from an explicit parent
 * opt-in action. It never auto-prompts. AADC: no guilt/streak push copy.
 *
 * LAZY IMPORT: firebase/messaging is imported only inside registerPush() —
 * never in the main bundle for users who don't enable push.
 */

export const pushCapable = (): boolean =>
  Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);

export async function registerPush(
  apiBase: string,
): Promise<"granted" | "denied" | "unavailable" | "no-vapid"> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return "no-vapid";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unavailable";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const { app } = await import("./firebase.js");
    if (!app) return "unavailable";

    // Pass Firebase config as query params so the SW can init without hard-coding creds.
    const cfg = (app.options ?? {}) as unknown as Record<string, string>;
    const swQuery = new URLSearchParams({
      apiKey:            cfg.apiKey            || "",
      authDomain:        cfg.authDomain        || "",
      projectId:         cfg.projectId         || "",
      storageBucket:     cfg.storageBucket     || "",
      messagingSenderId: cfg.messagingSenderId || "",
      appId:             cfg.appId             || "",
    });
    const swReg = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${swQuery.toString()}`,
      { scope: "/" },
    );

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return "unavailable";

    await fetch(`${apiBase}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return "granted";
  } catch {
    return "unavailable";
  }
}

export async function unregisterPush(apiBase: string): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    const { app } = await import("./firebase.js");
    if (app) await deleteToken(getMessaging(app));
  } catch { /* best-effort */ }
  try {
    await fetch(`${apiBase}/push/register`, { method: "DELETE" });
  } catch { /* best-effort */ }
}
