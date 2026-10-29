import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { api, type ReferralActivateResult } from "../../lib/api";
import { normalizeOfferCode } from "../../lib/offers";
import { trackInviteActivated } from "../../lib/loopEvents";

/**
 * B-GROWTH-43 — the typed-code path. A code a parent was given aloud or on
 * paper (a practitioner's, another parent's) is entered here, inside the Plan
 * card of Settings (no new object), and redeemed through the same
 * POST /api/referral/activate as the captured link, marked `via: "typed"`.
 * The server allows one redemption per family; a second code, an unknown code
 * and the parent's own code each get their own plain answer.
 *
 * Why its own file: the Plan card had no code input, and InviteCard is the
 * SENDING side (Weekly). The outcome mapping is pure and tested.
 */

export type OfferCodeOutcome = "granted" | "already" | "unknown" | "self" | "failed" | "signin";

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
  already: "set.referral.code.already",
  unknown: "set.referral.code.unknown",
  self: "set.referral.code.self",
  failed: "set.referral.code.failed",
  signin: "set.referral.code.signin",
};

export default function OfferCodeField({ onGranted }: { onGranted?: () => void }) {
  const { t } = useLanguage();
  const { user, firebaseEnabled } = useAuth();
  const signedIn = firebaseEnabled ? Boolean(user) : true;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<OfferCodeOutcome | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    if (!signedIn) { setOutcome("signin"); return; }
    setBusy(true);
    setOutcome(null);
    try {
      const result = await api.referralActivate(normalizeOfferCode(code), "typed");
      const next = offerCodeOutcome(result);
      setOutcome(next);
      if (next === "granted") {
        trackInviteActivated("referred");
        onGranted?.();
      }
    } catch (error) {
      setOutcome(offerCodeOutcome(error));
    } finally {
      setBusy(false);
    }
  };

  const good = outcome === "granted";
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
          disabled={busy || good}
          className="flex-1 min-w-0 rounded-xl px-3 min-h-11 text-sm font-mono"
          style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          data-testid="offer-code-input"
        />
        <button
          type="submit"
          disabled={busy || good || !code.trim()}
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
