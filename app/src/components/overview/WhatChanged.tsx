import React, { useEffect } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { computeStreak } from "../../lib/streak";
import { firstCopyKeys } from "../../lib/firsts";
import type { useWeeklyRecap } from "../../hooks/useWeeklyRecap";
import { collectMomentTimestamps } from "./sinceVisitEvents";
import { coldStartLineKey, type WhatChangedLine } from "./whatChangedEvents";

/**
 * B-TODAY-21 — the ONE "What changed since you left" card on Today.
 *
 * Replaces SinceLastVisit (rows + "Arbor remembers" footer), ProgressNarrative
 * ("What changed for {name}" — a second week definition) and the dev-map
 * count card ("{reached} of {total}"). It renders the composer's ≤4 EVENT
 * lines (whatChangedEvents.ts), the recap-ready line, the cold-start line and the
 * days-together counter (totalDays only — never the resettable walk).
 *
 * Hidden on day-0 and whenever there is nothing to say (OverviewTab gates the
 * mount on the composer's lines / the recap line). Every line is a ≥44 px
 * tap that keeps its deep link (requestJournalFocus for moments and steps).
 *
 * CLINICAL FIREWALL: event language only. In Hebrew every count is bidi-
 * isolated (FSI…PDI) and a Latin step/title inside a Hebrew line is isolated
 * too. Pinned by whatChanged.firewall.test.ts and whatChanged.test.ts.
 */

const LINE_ICON: Record<WhatChangedLine["kind"], string> = {
  first: "auto_awesome",
  milestone: "workspace_premium",
  step: "task_alt",
  facts: "bookmark",
  moments: "edit_note",
  noticed: "visibility",
};

export default function WhatChanged({
  lines,
  hiddenCount,
  recap,
  rhythmDaysNeeded,
  onLineTap,
  onMore,
}: {
  lines: WhatChangedLine[];
  hiddenCount: number;
  /** Today's ONE useWeeklyRecap() result (B-TODAY-08), passed down. */
  recap: ReturnType<typeof useWeeklyRecap>;
  /** predictRhythm's daysNeeded — the cold-start line (ENG-18). */
  rhythmDaysNeeded?: number;
  onLineTap: (line: WhatChangedLine) => void;
  onMore: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const { behaviorLogs, playLogs, childProfile, setActiveTab } = useArbor();
  const he = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  /** A count in a Hebrew line is bidi-isolated (FSI…PDI); EN keeps the digit.
   *  Latin titles/steps inside a Hebrew line are isolated by t() itself
   *  (lib/i18n translate → isolate), so they are passed through untouched. */
  const num = (n: number): string => (he ? `⁨${n}⁩` : String(n));

  const recapLine = !!recap.currentReport && recap.recapUnopened;
  const totalDays = computeStreak(collectMomentTimestamps(behaviorLogs, playLogs)).totalDays;
  const coldKey = coldStartLineKey(rhythmDaysNeeded);

  const label = (line: WhatChangedLine): { title: string; sub?: string } => {
    switch (line.kind) {
      case "first":
        return { title: t(firstCopyKeys(line.first).title), sub: line.title ? t("elev.brief.changed.milestone", { title: line.title }) : undefined };
      case "milestone":
        return { title: t("elev.brief.changed.milestone", { title: line.title }) };
      case "step":
        return {
          title: t(line.outcome === "somewhat" ? "elev.brief.changed.step.somewhat" : "elev.brief.changed.step.helped", { step: line.step }),
        };
      case "facts":
        return { title: line.count === 1 ? t("elev.brief.changed.facts.one", { name: firstName }) : t("elev.brief.changed.facts.many", { n: num(line.count), name: firstName }) };
      case "moments":
        return {
          title: line.count === 1 ? t("elev.brief.changed.moments.one") : t("elev.brief.changed.moments.many", { n: num(line.count) }),
          sub: line.quote ? `“${line.quote}”` : undefined,
        };
      case "noticed":
        return { title: t("elev.sincevisit.row.noticed") };
    }
  };

  useEffect(() => {
    // KPI 0.8 names are pinned (lib/loopEvents): the ONE card keeps the
    // since-strip's event names so the series does not break.
    if (lines.length > 0 || recapLine) track("sincevisit_shown", { rows: lines.length, recap: recapLine ? 1 : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0 && !recapLine) return null;

  return (
    <section
      className="rounded-[22px] p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      aria-labelledby="what-changed-title"
      data-testid="what-changed"
    >
      <h2 id="what-changed-title" className="text-[17px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
        {t("elev.brief.changed.title")}
      </h2>

      {recapLine && (
        <button
          type="button"
          onClick={() => {
            track("recap_ready_tap", { week: recap.currentId });
            setActiveTab("weekly");
          }}
          aria-label={t("elev.recap.ready.aria")}
          className="mt-3 flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-start transition active:scale-[0.99]"
          style={{ background: "var(--arbor-paper-deep)" }}
          data-testid="what-changed-recap"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)" }}>
            <Icon name="auto_stories" size={17} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.recap.ready", { name: firstName })}
          </span>
          <Icon name="chevron_right" size={17} className="flex-none rtl:-scale-x-100" style={{ color: "var(--arbor-faint)" }} />
        </button>
      )}

      {lines.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {lines.map((line, i) => {
            const { title, sub } = label(line);
            return (
              <li key={`${line.kind}.${i}`}>
                <button
                  type="button"
                  data-testid="what-changed-line"
                  data-line-kind={line.kind}
                  onClick={() => {
                    track("sincevisit_row_tap", { kind: line.kind });
                    onLineTap(line);
                  }}
                  className="flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-start transition active:scale-[0.99]"
                  style={{ background: "var(--arbor-paper-deep)" }}
                >
                  <span
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
                    // One neutral treatment for every line — an outcome or a
                    // watch signal is never colour-coded (law 1).
                    style={{ background: "var(--arbor-paper-elevated)", color: line.kind === "noticed" ? "var(--arbor-muted)" : "var(--arbor-green-ink)" }}
                  >
                    <Icon name={LINE_ICON[line.kind]} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-[13.5px] font-bold" style={{ color: "var(--arbor-ink)" }}>{title}</span>
                    {sub && <span dir="auto" className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--arbor-muted)" }}>{sub}</span>}
                  </span>
                  <Icon name="chevron_right" size={17} className="flex-none rtl:-scale-x-100" style={{ color: "var(--arbor-faint)" }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 px-1 text-[12.5px] font-extrabold"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {t("elev.sincevisit.more", { n: num(hiddenCount) })}
          <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
        </button>
      )}

      {(coldKey || totalDays > 0) && (
        <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: "var(--arbor-rule)" }}>
          {coldKey && (
            <p data-testid="today-coldstart-line" className="text-[11.5px]" style={{ color: "var(--arbor-muted)" }}>
              {t(coldKey, { n: num(rhythmDaysNeeded ?? 0), name: firstName })}
            </p>
          )}
          {totalDays > 0 && (
            <p className="text-[11.5px] font-bold" style={{ color: "var(--arbor-muted)" }} data-testid="what-changed-days-together">
              {t("elev.recap.days", { n: num(totalDays) })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
