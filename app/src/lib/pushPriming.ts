/* pushPriming — ENG-23. What the Growth reminders card is allowed to say.
 *
 * THE DEFECT: DevelopmentTab shipped a bare permission switch at the very
 * bottom of Growth, below the screening sheet, with no priming at all — and
 * `PushOptInToggle` returned null whenever `pushCapable()` was false. Since
 * VITE_FIREBASE_VAPID_KEY is not in any build today, `pushCapable()` is always
 * false, so the toggle rendered NOTHING, forever, and a parent had no way to
 * know whether Arbor was about to interrupt their evening or not.
 *
 * THE HONEST FIX: the card always renders and always states the truth of the
 * build it is running in. With no delivery path it says Arbor does not send
 * phone alerts and that things wait in-app instead — it does NOT show a switch
 * that promises a notification which can never arrive. The opt-in copy and the
 * switch appear only where the capability is genuinely present.
 *
 * This module is the decision, kept pure so it is testable without a DOM:
 * inputs in, one state out, and the copy contract (which keys, and whether a
 * switch may be shown) derived from that state alone.
 *
 * AADC: nothing here frames a reminder as a streak, a duty, or a loss.
 */

/** Browser permission as this device reports it (never inferred). */
export type PushPermission = "unsupported" | "default" | "granted" | "denied";

export interface PushPrimingInputs {
  /** lib/push `pushCapable()` — false without a VAPID key, i.e. no sender. */
  capable: boolean;
  /** `Notification.permission`, or "unsupported" where the API is absent. */
  permission: PushPermission;
  /** This device is registered with the sender right now. */
  registered: boolean;
}

/**
 * - `inApp`   — Arbor cannot deliver anything. Say so; show no switch.
 * - `offer`   — delivery is real and the parent has not chosen yet.
 * - `on`      — delivery is real and this device is opted in.
 * - `blocked` — delivery is real but the browser refuses it before Arbor sees it.
 */
export type PushPrimingState = "inApp" | "offer" | "on" | "blocked";

export interface PushPrimingCopy {
  state: PushPrimingState;
  titleKey: string;
  bodyKey: string;
  /** The priming points — only the offer state earns them. */
  pointKeys: readonly string[];
  /** A footnote that makes the in-app promise explicit; "" when not applicable. */
  noteKey: string;
  /**
   * May the card render a permission switch? FALSE unless Arbor can actually
   * deliver — this is the flag that stops the over-promise.
   */
  showToggle: boolean;
}

/** The one decision. Capability first: without a sender nothing else matters. */
export function pushPrimingState(inputs: PushPrimingInputs): PushPrimingState {
  if (!inputs.capable) return "inApp";
  if (inputs.permission === "unsupported") return "inApp";
  if (inputs.permission === "denied") return "blocked";
  if (inputs.permission === "granted" && inputs.registered) return "on";
  return "offer";
}

const COPY: Record<PushPrimingState, Omit<PushPrimingCopy, "state">> = {
  inApp: {
    titleKey: "elev.rh.push.title",
    bodyKey: "elev.rh.push.inapp.body",
    pointKeys: [],
    noteKey: "elev.rh.push.inapp.note",
    showToggle: false,
  },
  offer: {
    titleKey: "elev.rh.push.title",
    bodyKey: "elev.rh.push.offer.body",
    pointKeys: [
      "elev.rh.push.offer.point.one",
      "elev.rh.push.offer.point.two",
      "elev.rh.push.offer.point.three",
    ],
    noteKey: "",
    showToggle: true,
  },
  on: {
    titleKey: "elev.rh.push.title",
    bodyKey: "elev.rh.push.on.body",
    pointKeys: [],
    noteKey: "",
    showToggle: true,
  },
  blocked: {
    titleKey: "elev.rh.push.title",
    bodyKey: "elev.rh.push.blocked.body",
    pointKeys: [],
    noteKey: "elev.rh.push.inapp.note",
    showToggle: false,
  },
};

export function pushPrimingCopy(inputs: PushPrimingInputs): PushPrimingCopy {
  const state = pushPrimingState(inputs);
  return { state, ...COPY[state] };
}

/** Read this device's permission without assuming a DOM. */
export function readPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const p = window.Notification.permission;
  return p === "granted" || p === "denied" ? p : "default";
}
