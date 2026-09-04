import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ContentWhyLine } from "../ui/ContentActionBar";
import {
  buildGrowthMonthReview,
  growthMonthLabel,
  monthReviewSeenKey,
  previousMonthKey,
} from "../../lib/growthMonth";
import { comparisonAgeMonths, selectWeeklyFocus } from "../../lib/milestoneData";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { writeWatchFocus } from "../../lib/screeningWatch";
import { track } from "../../lib/analytics";

/* ════════════════════════════════════════════════════════════════════════════
   MonthInReview — GP-32.

   Offered ONCE, on the first open of a new month, on the Growth hub. Three
   count lines and one thing to watch for next; accepting the last card sets
   the same weekly focus the hub's observe row (GP-06) then renders.

   CLINICAL FIREWALL — this card is the one most likely to drift into being a
   progress report on the child, so the rules are explicit:
     · every number is a COUNT of what the PARENT did (noticed / kept), never
       a share, ratio, "x of y", score or level;
     · no comparison to last month, to other children, or to any norm — a
       delta is a trend, and a trend about a child is a verdict;
     · no domain ranking and no "area needing attention" pointer;
     · one calm tone throughout: no colour on this card means good or bad
       about the child. The tint is the hub's own mint register.
   lib/growthMonth carries the same rules at the derivation layer.

   Dismissal is per child AND per month (localStorage), so a new month offers
   the card exactly once and a closed card stays closed.
   ════════════════════════════════════════════════════════════════════════════ */
export default function MonthInReview() {
  const { milestones, behaviorLogs, playLogs, childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];
  const monthKey = useMemo(() => previousMonthKey(new Date()), []);
  const storageKey = monthReviewSeenKey(childProfile.id, monthKey);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const review = useMemo(
    () =>
      buildGrowthMonthReview({
        monthKey,
        milestones,
        momentTimestamps: [
          ...behaviorLogs.map((l) => l.timestamp),
          ...playLogs.map((l) => l.timestamp),
        ],
      }),
    [monthKey, milestones, behaviorLogs, playLogs],
  );

  const nextToWatch = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    const comparisonMonths = comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks);
    return selectWeeklyFocus(milestones, comparisonMonths)?.milestone ?? null;
  }, [childProfile, milestones]);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* storage blocked — the card simply reappears next open */
    }
    setDismissed(true);
  }, [storageKey]);

  const acceptWatch = useCallback(() => {
    if (!nextToWatch) return;
    writeWatchFocus(childProfile.id, {
      milestoneId: nextToWatch.id,
      screenItemId: "",
      chosenAt: new Date().toISOString(),
    });
    try {
      track("month_review_watch_accepted", {});
    } catch {
      /* analytics is never load-bearing */
    }
    close();
  }, [nextToWatch, childProfile.id, close]);

  // Nothing to review (a family in their first month) → no card at all.
  if (dismissed || !monthKey || !review.hasEntries) return null;

  const monthLabel = growthMonthLabel(monthKey, uiLang);
  const lines = [
    {
      id: "noticed",
      icon: "check_circle",
      text:
        review.noticedCount === 1
          ? t("elev.waveR.month.noticed.one")
          : t("elev.waveR.month.noticed.many", { n: review.noticedCount }),
    },
    {
      id: "areas",
      icon: "category",
      text:
        review.areasTouchedCount === 1
          ? t("elev.waveR.month.areas.one")
          : t("elev.waveR.month.areas.many", { n: review.areasTouchedCount }),
    },
    {
      id: "moments",
      icon: "edit_note",
      text:
        review.momentsKeptCount === 1
          ? t("elev.waveR.month.moments.one")
          : t("elev.waveR.month.moments.many", { n: review.momentsKeptCount }),
    },
  ];

  return (
    <section
      data-testid="growth-month-in-review"
      aria-labelledby="growth-month-title"
      className="overflow-hidden rounded-[24px] p-4 sm:p-6"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            <Icon name="calendar_month" size={16} />
            {t("elev.waveR.month.eyebrow")}
          </span>
          <h2
            id="growth-month-title"
            className="mt-2 break-words text-xl font-semibold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {firstName
              ? t("elev.waveR.month.title", { month: monthLabel, name: firstName })
              : t("elev.waveR.month.titleGeneric", { month: monthLabel })}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          data-testid="growth-month-close"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="close" size={16} /> {t("elev.waveR.month.close")}
        </button>
      </div>

      {/* The three cards. COUNTS ONLY — see the firewall note at the top. */}
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {lines.map((line) => (
          <li
            key={line.id}
            data-testid={`growth-month-${line.id}`}
            className="flex items-start gap-3 rounded-2xl p-3.5"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name={line.icon} size={18} />
            </span>
            <span
              className="min-w-0 flex-1 break-words text-[13px] font-bold leading-snug"
              style={{ color: "var(--arbor-ink)" }}
            >
              {line.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Card 4 — exactly ONE thing to watch for, handed to the same weekly
          focus the hub's observe row renders. Never a "gap" or a "concern". */}
      <div
        className="mt-3 rounded-2xl p-4"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.waveR.month.watch.title")}
        </p>
        {nextToWatch ? (
          <>
            <p className="mt-1.5 break-words text-sm font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>
              {nextToWatch.title}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptWatch}
                data-testid="growth-month-watch-accept"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
                style={{ background: "var(--arbor-clay)" }}
              >
                <Icon name="visibility" size={18} /> {t("elev.waveR.month.watch.accept")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("milestones")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition"
                style={{
                  background: "var(--arbor-paper-elevated)",
                  color: "var(--arbor-ink)",
                  border: "1px solid var(--arbor-rule)",
                }}
              >
                <Icon name="edit_note" size={18} /> {t("hub.milestones")}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.month.watch.none")}
          </p>
        )}
      </div>

      {/* GP-22 — the card says where its numbers came from, and the chip opens
          the Trust Center. */}
      <div className="mt-3">
        <ContentWhyLine why={t("elev.waveR.why.focus")} trustLink surface="growth-month-review" />
      </div>
    </section>
  );
}
