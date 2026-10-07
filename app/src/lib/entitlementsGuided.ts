/**
 * B-PROG-10 — the GUIDED TIER entitlement (E3, Guy 6 Oct): `guidedTier` on the
 * family. A named light coach, four short sessions per program, booked from
 * the app through an external scheduling link. No payment work here (the
 * payment model item, later); no marketplace; no claim to treat.
 *
 * ON when either:
 *  - the server's entitlement answer carries `guidedTier: true` (the RevenueCat
 *    entitlement id below, once the payment model agrees it), or
 *  - the PILOT flag is set for the family on the device:
 *    localStorage["arbor.flags.guidedTier"] = "1" (the house device-flag
 *    pattern, cf. kidmode `arbor.flags.sneakFreeze`).
 * OFF otherwise — and OFF means NO coach surface at all (CoachSessions renders
 * nothing; the Care sentence about the tier is not shown).
 *
 * GUY ROW P6-G3 (not decided by a builder): the coach (a named person Guy
 * appoints, qualifications in plain words) and the booking tool/account.
 * Until then `GUIDED_TIER_COACH` carries DOCUMENTED PLACEHOLDERS
 * (`placeholder: true`); the flag stays off for every family, so no parent
 * sees them.
 */
import type { LocalizedText } from "../content/governance";

/** The RevenueCat entitlement id for the tier — PLACEHOLDER until the payment model names it. */
export const GUIDED_TIER_ENTITLEMENT_ID = "guided_tier";

/** The pilot's device flag (value "1" = on). */
export const GUIDED_TIER_FLAG_KEY = "arbor.flags.guidedTier";

export interface GuidedTierCoach {
  /** The coach's name as the family reads it. */
  name: LocalizedText;
  /** The external scheduling link "Book" opens in the browser (no in-app calendar). */
  bookingUrl: string;
  /** True while the name and the link are the documented placeholders (GUY row P6-G3). */
  placeholder: boolean;
}

/** PLACEHOLDERS (GUY row P6-G3): replace both, then set `placeholder: false`. */
export const GUIDED_TIER_COACH: GuidedTierCoach = {
  name: { en: "Arbor pilot coach", he: "מלווה הפיילוט של Arbor" },
  bookingUrl: "https://cal.com/arbor-pilot-coach",
  placeholder: true,
};

type StorageLike = Pick<Storage, "getItem"> | null | undefined;

const deviceStorage = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Is the guided tier on for this family? Server entitlement first, then the pilot flag. Fails closed. */
export function guidedTierOn(args: { entitlement?: { guidedTier?: unknown } | null; storage?: StorageLike } = {}): boolean {
  if (args.entitlement && args.entitlement.guidedTier === true) return true;
  const storage = args.storage === undefined ? deviceStorage() : args.storage;
  try {
    return storage?.getItem(GUIDED_TIER_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
