import React, { useEffect, useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useEntitlement, refreshEntitlement, isVerifiedEntitlement } from "../../hooks/useEntitlement";
import { PlanBadge } from "../ui/PlanBadge";
// Same direct module read PaywallModal uses: the approved free-vs-Plus split
// copy, EN + HE, already shipping inside the paywall.
import * as planclarity from "../../lib/i18nElevation/planclarity";
import {
  decideValuePreview,
  localDayKey,
  readValuePreviewDismissal,
  writeValuePreviewDismissal,
  VALUE_PREVIEW_SURFACE,
} from "./valuePreviewModel";

/**
 * ENG-21 — the in-context value preview.
 *
 * A parent on the free plan currently learns that Plus exists at the one moment
 * they are blocked: the coach meter 402s mid-question and a modal appears. This
 * card is the same information, said earlier and said quietly — on an empty Ask
 * Arbor thread, when the day's allowance is nearly spent, with nothing in
 * flight to interrupt.
 *
 * Every user-visible string here ALREADY SHIPS, unchanged:
 *   · "Your plan: Arbor Free"                 set.plan.your + set.plan.free
 *   · "Coach messages today: {used} of {limit}."  set.plan.coachToday (the same
 *     line the Settings plan row renders, from the same two fields)
 *   · "Always free" / free bullet             elev.plan.freeTitle, free.2
 *   · "Arbor Plus adds" / Plus bullet         elev.plan.plusTitle, plus.1
 *   · "Upgrade to Plus" / "Maybe later"       set.plan.upgradePlus, pw.maybeLater
 * No new claim, no new price, no trial, no urgency, no discount — and nothing
 * about the child. The account's own coach allowance is the ONLY number on it.
 *
 * The free side is stated FIRST and in the same weight as the paid side: what
 * the parent already has is not a teaser for what they do not.
 *
 * "Upgrade to Plus" opens the EXISTING paywall with NO feature key, so the
 * modal renders its generic body. Passing "coach_unlimited" would render
 * "You've reached today's free coaching" — which, before the wall, is false.
 *
 * Placement, timing and frequency all live in ./valuePreviewModel.
 */
export default function ValuePreview({
  threadEmpty,
  surfaceIdle,
  online,
}: {
  threadEmpty: boolean;
  surfaceIdle: boolean;
  online: boolean;
}) {
  const { openPaywall } = useArbor();
  const { t, uiLang } = useLanguage();
  const { entitlement, loading } = useEntitlement();
  const headingId = useId();
  const pc = (k: string) => (uiLang === "he" ? planclarity.he : planclarity.en)[`elev.plan.${k}`] ?? "";

  const [dismissedOn, setDismissedOn] = useState<string | null>(() => readValuePreviewDismissal());
  // The allowance snapshot is fetched once per app session and then cached, so
  // by the time a parent starts a NEW conversation it can under-report what
  // they have spent today. A number this card shows must be true, and the
  // moment it decides must be the real moment — so it re-asks the server once,
  // and renders nothing at all until that answer is in. The ask is skipped
  // entirely for anyone who is not a verified free parent, so a subscriber
  // never generates a request on this parent's behalf.
  const [asked, setAsked] = useState<"idle" | "asking" | "done">("idle");
  useEffect(() => {
    if (loading || asked !== "idle") return;
    if (entitlement.plan !== "free" || !isVerifiedEntitlement(entitlement)) {
      setAsked("done");
      return;
    }
    setAsked("asking");
    void refreshEntitlement().finally(() => setAsked("done"));
  }, [loading, asked, entitlement]);

  const decision = decideValuePreview({
    entitlement,
    entitlementLoading: loading || asked !== "done",
    threadEmpty,
    surfaceIdle,
    online,
    dismissedOn,
    today: localDayKey(),
  });
  if (!decision.show) return null;

  const dismiss = () => {
    const day = localDayKey();
    writeValuePreviewDismissal(day);
    setDismissedOn(day);
  };

  const line = "text-[11px] leading-relaxed";
  return (
    <section
      dir="auto"
      data-testid="coach-value-preview"
      data-surface={VALUE_PREVIEW_SURFACE}
      aria-labelledby={headingId}
      className="rounded-xl p-3.5 space-y-2.5"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
    >
      <div className="space-y-0.5">
        <p id={headingId} className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>
          {t("set.plan.your", { plan: t("set.plan.free") })}
        </p>
        {/* The account's own allowance — the same line, from the same two
            fields, that Settings › Plan already shows. Never anything else. */}
        <p className={line} style={{ color: "var(--arbor-muted)" }}>
          {t("set.plan.coachToday", { used: decision.used, limit: decision.limit })}
        </p>
      </div>

      {/* Free first, and only the coach lines: this card sits on the Ask
          surface, so the two facts that belong here are what today's plan gives
          on THIS surface and what the paid plan changes about it. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold" style={{ color: "var(--arbor-ink)" }}>{pc("freeTitle")}</p>
          <p className={line} style={{ color: "var(--arbor-muted)" }}>{pc("free.2")}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
            <PlanBadge plan="plus" />{pc("plusTitle")}
          </p>
          <p className={line} style={{ color: "var(--arbor-muted)" }}>{pc("plus.1")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Deliberately NOT the filled primary CTA the paywall uses — this is a
            door, not a push. */}
        <button
          type="button"
          data-testid="coach-value-preview-plans"
          onClick={() => openPaywall(undefined, "plus")}
          className="inline-flex items-center min-h-[44px] px-3 rounded-xl text-[11px] font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
        >
          {t("set.plan.upgradePlus")}
        </button>
        <button
          type="button"
          data-testid="coach-value-preview-dismiss"
          onClick={dismiss}
          className="inline-flex items-center min-h-[44px] text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-lg"
          style={{ color: "var(--arbor-muted)" }}
        >
          {t("pw.maybeLater")}
        </button>
      </div>
    </section>
  );
}
