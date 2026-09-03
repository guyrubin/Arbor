/**
 * MOB-19 / ENG-23 — push permission priming.
 *
 * The OS permission prompt is a one-shot; asking cold burns it. The parent
 * first sees the enforced contract ("at most 2 a day, never in quiet hours,
 * never about {name} by name") and taps Enable — THAT sets the primed flag,
 * and only a primed device may reach registerPush() (which calls
 * Notification.requestPermission). enablePushIfPrimed is the single seam
 * SmartRemindersPanel uses; pushPriming.test.ts pins that an unprimed call
 * never reaches the OS prompt.
 *
 * Availability is honest: the native transport (@capacitor/push-notifications
 * + APNs/FCM keys) is NOT built — a native shell, or a web build without a
 * VAPID key, reports "unavailable" and the panel says so in plain words.
 */

export const PUSH_PRIMED_KEY = "arbor.push.primed";

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPushPrimed(): boolean {
  try {
    return storage()?.getItem(PUSH_PRIMED_KEY) === "1";
  } catch {
    return false;
  }
}

/** The parent tapped Enable on the priming card. */
export function markPushPrimed(): void {
  try {
    storage()?.setItem(PUSH_PRIMED_KEY, "1");
  } catch {
    /* storage unavailable — the in-session state still gates the call */
  }
}

/** Test-only. */
export function clearPushPrimed(): void {
  try {
    storage()?.removeItem(PUSH_PRIMED_KEY);
  } catch {
    /* ignore */
  }
}

export type PushAvailability = "available" | "unavailable";

/** Where push can actually be delivered in THIS build. */
export function pushAvailability(deps: { isNative: boolean; pushCapable: () => boolean }): PushAvailability {
  // Native transport not built (no keys, no plugin) — say so instead of a dead toggle.
  if (deps.isNative) return "unavailable";
  return deps.pushCapable() ? "available" : "unavailable";
}

export type EnableResult = "not-primed" | "unavailable" | "granted" | "denied";

/**
 * The ONLY path to registerPush. Refuses (without touching the OS prompt)
 * unless the priming card was accepted on this device.
 */
export async function enablePushIfPrimed(deps: {
  primed?: boolean;
  availability: PushAvailability;
  registerPush: () => Promise<"granted" | "denied" | "unavailable" | "no-vapid">;
}): Promise<EnableResult> {
  const primed = deps.primed ?? readPushPrimed();
  if (!primed) return "not-primed";
  if (deps.availability !== "available") return "unavailable";
  const result = await deps.registerPush();
  if (result === "granted") return "granted";
  if (result === "denied") return "denied";
  return "unavailable";
}
