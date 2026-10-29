import React, { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { api, type ReferralActivateResult } from "../../lib/api";
import { normalizeOfferCode, offerForCode } from "../../lib/offers";
import { hasTrackedFirstPlan, trackInviteActivated } from "../../lib/loopEvents";
import { clearTypedReferralRefusal, heldLinkReferralCode, holdTypedReferralCode, peekTypedReferralRefusal, type TypedReferralRefusal } from "../../lib/attribution";
import { LS_REFERRAL_ACTIVATED } from "../../lib/referralActivation";

/**
 * B-GROWTH-43 — the typed-code path. A code a parent was given aloud or on
 * paper (a practitioner's, another parent's) is entered here, inside the Plan
 * card of Settings (no new object), and redeemed through the same
 * POST /api/referral/activate as the captured link, marked `via: "typed"`.
 * The server allows one redemption per family; a second code, an unknown code
 * and the parent's own code each get their own plain answer.
 *
 * The referral counts on the family's ACTIVATION, its first plan (lib/offers
 * referral_month), never on a code alone: a family with no plan yet has the
 * code HELD in the same first-touch record a ?ref= link fills
 * (lib/attribution holdTypedReferralCode), and it redeems at the first plan
 * through the link's own path (lib/referralActivation). Only a family that
 * already has a plan (this device has seen its first generated plan, the same
 * test the link path's trigger uses) redeems at once.
 *
 * Round 4: the parent's own code is refused while they type (GET
 * /api/referral/code); a link code still waiting for the first plan is never
 * displaced by a typed one; and a held typed code the server refuses at the
 * first plan is told here, once, with the device free to take a corrected
 * code (no new toast: the Plan card is the code's own receipt).
 *
 * Why its own file: the Plan card had no code input, and InviteCard is the
 * SENDING side (Weekly). The outcome mapping is pure and tested.
 */

export type OfferCodeOutcome = "granted" | "held" | "linkSaved" | "heldRefused" | "already" | "unknown" | "self" | "failed" | "signin";

/** The answer a parent reads for a server result, or for a request that threw
 *  (lib/api ApiError: 401 = not signed in; anything else = try again). */
export function offerCodeOutcome(result: ReferralActivateResult | unknown): OfferCodeOutcome {
  if (result && typeof result === "object" && "ok" in result) {
    const r = result as ReferralActivateResult;
    if (r.ok) return r.status === "already_activated" ? "already" : "granted";
    return r.status === "self_referral" ? "self" : "unknown";
  }
  return (result as { status?: unknown } | null)?.status === 401 ? "signin" : "failed";
}

const OUTCOME_KEY: Record<OfferCodeOutcome, string> = {
  granted: "set.referral.code.granted",
  held: "set.referral.code.held",
  linkSaved: "set.referral.code.linkSaved",
  heldRefused: "set.referral.code.heldRefused",
  already: "set.referral.code.already",
  unknown: "set.referral.code.unknown",
  self: "set.referral.code.self",
  failed: "set.referral.code.failed",
  signin: "set.referral.code.signin",
};

/**
 * What submitting a code does: a code that is not one is refused here; with
 * no plan yet it is held for the first plan; with a plan it is redeemed now.
 */
export function offerCodeRoute(code: string, hasPlan: boolean): { route: "refuse" | "hold" | "redeem"; normalized: string } {
  const normalized = normalizeOfferCode(code);
  if (!offerForCode(normalized)) return { route: "refuse", normalized };
  return { route: hasPlan ? "redeem" : "hold", normalized };
}

/** The line for a held typed code the server refused at the first plan. */
export const refusalOutcome = (r: TypedReferralRefusal | null): OfferCodeOutcome | null =>
  r === null ? null : r === "self" ? "self" : r === "already" ? "already" : "heldRefused";

/**
 * Everything a submitted code does, in order: not a code → refused; the
 * parent's own code → refused; no plan yet → held beside nothing (a link code
 * waiting for the first plan is kept, and the parent is told one is saved);
 * a plan → redeemed now, and on a grant this device is marked redeemed so a
 * link code captured earlier never posts again.
 */
export async function submitTypedCode(input: {
  code: string;
  hasPlan: boolean;
  ownCode: () => Promise<string | null | undefined>;
  activate: (code: string, via: "typed") => Promise<ReferralActivateResult>;
}): Promise<OfferCodeOutcome> {
  const { route, normalized } = offerCodeRoute(input.code, input.hasPlan);
  if (route === "refuse") return "unknown";
  let own: string | null | undefined = null;
  try {
    own = await input.ownCode();
  } catch {
    own = null; // the server refuses the parent's own code too
  }
  if (own && normalizeOfferCode(own) === normalized) return "self";
  if (route === "hold") {
    if (heldLinkReferralCode()) return "linkSaved";
    return holdTypedReferralCode(normalized) ? "held" : "failed";
  }
  try {
    const next = offerCodeOutcome(await input.activate(normalized, "typed"));
    if (next === "granted") {
      try { localStorage.setItem(LS_REFERRAL_ACTIVATED, new Date().toISOString()); } catch { /* the server still dedupes */ }
      trackInviteActivated("referred");
    }
    return next;
  } catch (error) {
    return offerCodeOutcome(error);
  }
}

export default function OfferCodeField({ onGranted }: { onGranted?: () => void }) {
  const { t } = useLanguage();
  const { user, firebaseEnabled } = useAuth();
  const signedIn = firebaseEnabled ? Boolean(user) : true;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // A held typed code refused at the first plan is told here once: read on
  // mount, forgotten after it has been shown.
  const [outcome, setOutcome] = useState<OfferCodeOutcome | null>(() => refusalOutcome(peekTypedReferralRefusal()));
  useEffect(() => { clearTypedReferralRefusal(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    if (!signedIn) { setOutcome("signin"); return; }
    setBusy(true);
    setOutcome(null);
    try {
      const next = await submitTypedCode({
        code,
        hasPlan: hasTrackedFirstPlan(),
        ownCode: async () => (await api.referralCode()).code,
        activate: (c, via) => api.referralActivate(c, via),
      });
      setOutcome(next);
      if (next === "granted") onGranted?.();
    } finally {
      setBusy(false);
    }
  };

  const good = outcome === "granted" || outcome === "held" || outcome === "linkSaved";
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }} data-testid="offer-code-field">
      <label htmlFor="offer-code-input" className="block text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>
        {t("set.referral.code.label")}
      </label>
      <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("set.referral.code.sub")}</p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input
          id="offer-code-input"
          value={code}
          onChange={(e) => { setCode(e.target.value); if (outcome && outcome !== "granted") setOutcome(null); }}
          aria-label={t("set.referral.code.input")}
          placeholder="ARBOR-XXXXXXXX"
          dir="ltr"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          disabled={busy || outcome === "granted"}
          className="flex-1 min-w-0 rounded-xl px-3 min-h-11 text-sm font-mono"
          style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          data-testid="offer-code-input"
        />
        <button
          type="submit"
          disabled={busy || outcome === "granted" || !code.trim()}
          className="text-xs font-bold rounded-xl px-3 min-h-11 disabled:opacity-50"
          style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
          data-testid="offer-code-apply"
        >
          {busy ? t("set.referral.code.applying") : t("set.referral.code.apply")}
        </button>
      </div>
      {outcome && (
        <p
          role={good ? "status" : "alert"}
          className="text-xs mt-2"
          style={{ color: good ? "var(--arbor-ink)" : "var(--arbor-peach-ink)" }}
          data-testid="offer-code-outcome"
          data-outcome={outcome}
        >
          {t(OUTCOME_KEY[outcome])}
        </p>
      )}
    </form>
  );
}
