/**
 * Referral primitives for the growth loop (mk-p0-2 / mk-p0-3).
 *
 * Pure + deterministic — no Date.now / Math.random, no I/O. This module owns
 * referral-code generation, join/share-link building, and the reward-eligibility
 * rules. The actual entitlement grant (writing a free Plus month) and the
 * `/join?ref=` resolver route are wired elsewhere; they call these pure helpers
 * so the rules stay testable in one place.
 *
 * Reward fires on the referred user's ACTIVATION (child profile + first coach
 * interaction), never on registration — that's the abuse-resistant trigger the
 * GTM plan specifies.
 */

// Clean, unambiguous alphabet — no 0/O/1/I/L to avoid mis-typed/mis-read codes.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 7;

/** Deterministic 32-bit FNV-1a string hash. Stable across runs and devices. */
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Stable, shareable referral code for a user. Same uid → same code, always. */
export function referralCodeFromUid(uid: string): string {
  if (!uid) return "";
  let lo = hash32(uid);
  let hi = hash32(uid + ":arbor-ref");
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    if (i < 4) {
      out += CODE_ALPHABET[lo % CODE_ALPHABET.length];
      lo = Math.floor(lo / CODE_ALPHABET.length);
    } else {
      out += CODE_ALPHABET[hi % CODE_ALPHABET.length];
      hi = Math.floor(hi / CODE_ALPHABET.length);
    }
  }
  return out;
}

/** Build the join deep-link a share artifact carries: `${base}/join?ref=CODE`. */
export function buildJoinUrl(baseUrl: string, code: string): string {
  const base = (baseUrl || "").replace(/\/+$/, "");
  return code ? `${base}/join?ref=${encodeURIComponent(code)}` : `${base}/`;
}

/** A referrer cannot reward themselves. */
export function isSelfReferral(inviterCode: string | undefined, recipientUid: string | undefined): boolean {
  if (!inviterCode || !recipientUid) return false;
  return inviterCode === referralCodeFromUid(recipientUid);
}

export type ActivationState = {
  hasProfile: boolean;
  hadFirstCoachInteraction: boolean;
};

/** Activation = the family created a child profile AND had their first coach interaction. */
export function isActivated(a: ActivationState | null | undefined): boolean {
  return !!a && a.hasProfile && a.hadFirstCoachInteraction;
}

export type RewardContext = {
  inviterCode?: string;
  recipientUid?: string;
  activation: ActivationState;
  alreadyRewarded: boolean;
};

/**
 * The single source of truth for "should both sides get a free Plus month?":
 * there is an inviter, the recipient is real, it's not a self-referral, it
 * hasn't already been rewarded, and the recipient has ACTIVATED.
 */
export function canGrantReferralReward(ctx: RewardContext): boolean {
  if (!ctx.inviterCode || !ctx.recipientUid) return false;
  if (ctx.alreadyRewarded) return false;
  if (isSelfReferral(ctx.inviterCode, ctx.recipientUid)) return false;
  return isActivated(ctx.activation);
}
