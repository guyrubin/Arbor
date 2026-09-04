/**
 * TomorrowReasonCard — TJB-28. The return hook a parent left themselves.
 *
 * Two halves, both in-app (lib/tomorrowReason):
 *   CLOSE — while the parent is in Arbor at the close of a day, ONE concrete
 *           thing that is genuinely waiting is written down for them.
 *   OPEN  — the next time they open the app on a later day, that one thing is
 *           what this card shows, with the button that goes straight to it.
 *
 * Nothing is sent anywhere and nothing fires while the phone is face-down:
 * Arbor has no delivery path, and this is the honest shape of a return hook
 * without one (see lib/pushPriming).
 *
 * Register: parent. Tokens only, logical CSS, 44px targets, EN + HE.
 * CLINICAL FIREWALL: every reason is the parent's own next move. Nothing here
 * counts a missed day, grades anything, or reports on the child.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import {
  closeDay,
  markReasonSeen,
  reasonForThisOpen,
  reasonPresentation,
  type DayCloseSignals,
  type StoredReason,
} from "../../lib/tomorrowReason";

export interface TomorrowReasonCardProps {
  /** What is genuinely true right now, for the close-of-day write. */
  signals: DayCloseSignals;
  /** The child's first name, for the copy. */
  childName?: string;
  /** Injected in tests; the live surface reads the clock. */
  nowMs?: number;
}

export default function TomorrowReasonCard({ signals, childName, nowMs }: TomorrowReasonCardProps) {
  const { t } = useLanguage();
  const { setActiveTab, childProfile } = useArbor();
  const now = useMemo(() => nowMs ?? Date.now(), [nowMs]);

  // What was left for today, resolved once per mount so the card cannot flicker
  // away mid-read when an unrelated state change re-renders the page.
  const [reason, setReason] = useState<StoredReason | null>(() => reasonForThisOpen(childProfile.id, now));

  // The CLOSE half. Runs after paint, writes at most once a day, and never
  // touches the reason currently on screen (which belongs to an earlier day).
  useEffect(() => {
    closeDay(childProfile.id, now, signals);
    // `signals` is read once at close; re-running on every signal tick would
    // let a reason chosen at 19:30 be rewritten at 19:31.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, childProfile.id]);

  const dismiss = useCallback(() => {
    markReasonSeen(childProfile.id, now);
    setReason(null);
  }, [now, childProfile.id]);

  const act = useCallback(
    (tab: Parameters<typeof setActiveTab>[0]) => {
      markReasonSeen(childProfile.id, now);
      setReason(null);
      setActiveTab(tab);
    },
    [now, childProfile.id, setActiveTab],
  );

  if (!reason) return null;

  const p = reasonPresentation(reason.kind);
  const name = (childName || "").trim();
  const vars = name ? { name } : undefined;

  return (
    <section
      data-testid="tomorrow-reason-card"
      data-reason-kind={reason.kind}
      aria-labelledby="tomorrow-reason-title"
      className="rounded-[24px] p-4 sm:p-5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--arbor-paper-deep)" }}
        >
          <Icon name={p.glyph} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("elev.rh.tomorrow.eyebrow")}
          </span>
          <h2
            id="tomorrow-reason-title"
            className="mt-1 break-words text-[17px] font-extrabold leading-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {t(p.titleKey, vars)}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>
            {t(p.bodyKey, vars)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="tomorrow-reason-cta"
          onClick={() => act(p.action)}
          className="inline-flex items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold transition active:scale-[0.97]"
          style={{ minHeight: 44, background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
        >
          {t(p.ctaKey)}
          <Icon name="chevron_right" size={16} className="rtl:rotate-180" />
        </button>
        <button
          type="button"
          data-testid="tomorrow-reason-dismiss"
          onClick={dismiss}
          aria-label={t("elev.rh.tomorrow.dismissAria")}
          className="inline-flex items-center rounded-2xl px-4 text-[13px] font-bold"
          style={{
            minHeight: 44,
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
            color: "var(--arbor-muted)",
          }}
        >
          {t("elev.rh.tomorrow.dismiss")}
        </button>
      </div>
    </section>
  );
}
