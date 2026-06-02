import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";

/**
 * Minimal first-party analytics. Writes events to the signed-in user's own
 * Firestore collection so we can learn which capabilities get used — no
 * third-party scripts, no cross-site tracking. Best-effort and fire-and-forget.
 */
let uidProvider: () => string | undefined = () => undefined;

export function setAnalyticsUser(fn: () => string | undefined) {
  uidProvider = fn;
}

export function track(event: string, props: Record<string, unknown> = {}) {
  const uid = uidProvider();
  if (firebaseEnabled && db && uid && uid !== "local-sandbox") {
    try {
      void addDoc(collection(db, `users/${uid}/events`), { event, props, at: serverTimestamp() });
    } catch {
      /* ignore */
    }
  } else if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[track]", event, props);
  }
}
