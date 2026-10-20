import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useEntitlement } from "../../hooks/useEntitlement";
import { track } from "../../lib/analytics";
import { fmtDay } from "../../lib/formatDate";
import {
  trialNotice,
  trialNoticeCopy,
  trialNoticeDismissToken,
  trialNoticeFeature,
  TRIAL_NOTICE_DISMISS_KEY,
} from "./trialNotice";

/**
 * TrialNoticeBanner: BD-53 follow-up, the parent's warning before the 14-day
 * trial ends. Mounted once in Shell beside SyncStatusBanner, inside the
 * .arbor-parent <main>, never in kid mode.
 *
 * Shows from 3 calendar days before `trialEndsAt` ("ends in 3 days, on
 * {date}" → tomorrow → today) and once the trial has ended. Every rule about
 * WHEN lives in trialNotice.ts; this file only renders it. One calm strip in
 * the SyncStatusBanner look: no red, no countdown, dismissible (until tomorrow
 * while ending, for good once ended). The button opens the existing paywall
 * with its own trigger, so the funnel tells it from a 402.
 */

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(TRIAL_NOTICE_DISMISS_KEY);
  } catch {
    return null;
  }
};

export default function TrialNoticeBanner() {
  const { entitlement } = useEntitlement();
  const { openPaywall } = useArbor();
  const { t, uiLang } = useLanguage();
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  const now = Date.now();
  const notice = trialNotice(entitlement, now);
  const token = notice ? trialNoticeDismissToken(notice, now) : null;
  const visible = notice !== null && token !== dismissed;

  // One shown event per appearance (per day while ending, once when ended).
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (visible && notice && token && shownFor.current !== token) {
      shownFor.current = token;
      track("trial_notice_shown", { kind: notice.kind, days_left: notice.kind === "ending" ? notice.daysLeft : 0 });
    }
    if (!visible) shownFor.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, token]);

  if (!visible || !notice || !token) return null;

  const copy = trialNoticeCopy(notice, (iso) => fmtDay(iso, uiLang));

  const dismiss = () => {
    try {
      localStorage.setItem(TRIAL_NOTICE_DISMISS_KEY, token);
    } catch {
      /* private mode: the dismissal just won't survive a reload */
    }
    track("trial_notice_dismissed", { kind: notice.kind });
    setDismissed(token);
  };

  const seePlans = () => {
    track("trial_notice_cta", { kind: notice.kind });
    openPaywall(trialNoticeFeature(notice), "plus");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="trial-notice"
      data-kind={notice.kind}
      className="mb-6 flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-1.5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        color: "var(--arbor-ink)",
      }}
    >
      <Icon name="event_upcoming" size={18} style={{ color: "var(--arbor-muted)" }} />
      <span className="min-w-0 flex-1 text-xs font-medium" dir="auto">
        {t(copy.key, copy.vars)}
      </span>
      <button
        type="button"
        onClick={seePlans}
        data-testid="trial-notice-cta"
        className="flex-shrink-0 rounded-xl px-3 py-2 min-h-[44px] text-[11px] font-bold transition"
        style={{
          background: "var(--arbor-paper)",
          color: "var(--arbor-ink)",
          border: "1px solid var(--arbor-rule)",
        }}
      >
        {t("trial.notice.cta")}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("trial.notice.dismiss")}
        title={t("trial.notice.dismiss")}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
