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

/**
 * Props merged onto EVERY event — set once at startup to the first-touch
 * attribution (market, source, referral_code, utm_*) from lib/attribution. This
 * is what makes the growth loop measurable: activation/retention events become
 * sliceable by acquisition channel without touching each call site.
 */
let globalPropsProvider: () => Record<string, unknown> = () => ({});

export function setGlobalProps(fn: () => Record<string, unknown>) {
  globalPropsProvider = fn;
}

export function track(event: string, props: Record<string, unknown> = {}) {
  let merged: Record<string, unknown> = props;
  try {
    merged = { ...globalPropsProvider(), ...props }; // explicit props win over globals
  } catch {
    /* fall back to bare props */
  }
  const uid = uidProvider();
  if (firebaseEnabled && db && uid && uid !== "local-sandbox") {
    try {
      void addDoc(collection(db, `users/${uid}/events`), { event, props: merged, at: serverTimestamp() });
    } catch {
      /* ignore */
    }
  } else if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[track]", event, merged);
  }
}
