import React, { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { en as svEn, he as svHe } from "../../lib/i18nElevation/sincevisit";
import type { SinceVisitRow } from "./sinceVisitEvents";

/**
 * SinceLastVisit — W1 1.1 (Maytal Row-1 #1, Oura "Top Stories" pattern).
 *
 * Renders ONLY for returning parents (OverviewTab gates on useLastVisit's
 * previousVisitAt + 30-min debounce): a warm returning greeting and a "new
 * since your last visit" card of ≤3 tappable EVENT rows, each deep-linking to
 * its source surface (Journal / Development / coach), plus a "+N more in
 * Journal" overflow link.
 *
 * Rule A (Today budget): continuity lines collapse INTO this strip — the
 * "Arbor remembers" count line renders here as the footer, and the ArborNoticed
 * card folds in as a row when Today would otherwise exceed 5 modules.
 *
 * CLINICAL FIREWALL: event language only — counts and plain activity facts,
 * never comparative/trend wording (a delta between visits is a trend by
 * inspection). Pinned by sinceLastVisit.test.ts.
 *
 * i18n: keys live in lib/i18nElevation/sincevisit.ts. The module is not yet
 * registered in i18nElevation/index.ts (integration-lane file), so `sv()`
 * resolves through t() FIRST and falls back to the module records — identical
 * behavior before and after registration.
 */

const ROW_ICON: Record<SinceVisitRow["kind"], string> = {
  milestone: "workspace_premium",
  noticed: "visibility",
  moments: "edit_note",
  plays: "sports_esports",
  conversations: "forum",
};

/**
 * t()-first resolver with module fallback (see header note): once the module
 * is registered in i18nElevation/index.ts, t() wins and this becomes a
 * pass-through. Same `{var}` interpolation contract as lib/i18n.translate.
 * Exported so OverviewTab can render the resume framing line.
 */
export function svString(
  t: (key: string, vars?: Record<string, string | number>) => string,
  uiLang: string,
  key: string,
  vars?: Record<string, string | number>
): string {
  const viaT = t(key, vars);
  if (viaT !== key) return viaT;
  const dict = uiLang === "he" ? svHe : svEn;
  let s = dict[key] ?? svEn[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
  return s;
}

export default function SinceLastVisit({
  rows,
  hiddenCount,
  capturedToday,
  weekCount,
  storyCount,
  onRowTap,
  onMore,
}: {
  rows: SinceVisitRow[];
  hiddenCount: number;
  /** "Arbor remembers" footer counts (today.intent.memoryLine — counts only). */
  capturedToday: number;
  weekCount: number;
  storyCount: number;
  onRowTap: (row: SinceVisitRow) => void;
  onMore: () => void;
}) {
  const { t, uiLang } = useLanguage();

  const sv = (key: string, vars?: Record<string, string | number>): string => svString(t, uiLang, key, vars);

  const rowLabel = (row: SinceVisitRow): string => {
    switch (row.kind) {
      case "milestone":
        return sv("elev.sincevisit.row.milestone", { title: row.title });
      case "noticed":
        return sv("elev.sincevisit.row.noticed");
      case "moments":
        return row.count === 1 ? sv("elev.sincevisit.row.moment.one") : sv("elev.sincevisit.row.moment.many", { n: row.count });
      case "plays":
        return row.count === 1 ? sv("elev.sincevisit.row.play.one") : sv("elev.sincevisit.row.play.many", { n: row.count });
      case "conversations":
        return row.count === 1 ? sv("elev.sincevisit.row.convo.one") : sv("elev.sincevisit.row.convo.many", { n: row.count });
    }
  };

  // Instrument once per mount (KPI 0.8: % opens showing a since-visit delta).
  const trackedRows = useRef(false);
  useEffect(() => {
    if (trackedRows.current || rows.length === 0) return;
    trackedRows.current = true;
    track("sincevisit_shown", { rows: rows.length });
  }, [rows.length]);

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-[22px] p-5"
      style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-sm)" }}
      aria-label={sv("elev.sincevisit.aria")}
      data-testid="since-last-visit"
    >
      <p className="text-[12.5px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        {sv("elev.sincevisit.greeting")}
      </p>
      <h2 className="mt-1 text-[17px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
        {sv("elev.sincevisit.title")}
      </h2>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row, i) => (
          <li key={`${row.kind}.${i}`}>
            <button
              type="button"
              onClick={() => {
                track("sincevisit_row_tap", { kind: row.kind });
                onRowTap(row);
              }}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-start transition active:scale-[0.99]"
              style={{ background: "var(--arbor-paper-deep)" }}
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full"
                style={{
                  background: row.kind === "noticed" ? "var(--arbor-peach-soft)" : "var(--arbor-green-soft)",
                  color: row.kind === "noticed" ? "var(--arbor-peach-ink)" : "var(--arbor-green-ink)",
                }}
              >
                <Icon name={ROW_ICON[row.kind]} size={17} fill={row.kind === "milestone" ? 1 : 0} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: "var(--arbor-ink)" }}>
                {rowLabel(row)}
              </span>
              <Icon name="chevron_right" size={17} className="flex-none rtl:-scale-x-100" style={{ color: "var(--arbor-faint)" }} />
            </button>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[12.5px] font-extrabold"
          style={{ color: "var(--arbor-clay)" }}
        >
          {sv("elev.sincevisit.more", { n: hiddenCount })}
          <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
        </button>
      )}

      {/* "Arbor remembers" continuity footer — mounts the authored
          today.intent.remembers/.memoryLine strings (counts only, Rule A: a
          LINE in the strip, never a sibling card). */}
      <p className="mt-3 border-t pt-3 text-[11.5px]" style={{ borderColor: "var(--arbor-rule)", color: "var(--arbor-faint)" }}>
        <span className="font-extrabold" style={{ color: "var(--arbor-muted)" }}>{t("today.intent.remembers")}</span>{" "}
        {t("today.intent.memoryLine", { captured: capturedToday, week: weekCount, story: storyCount })}
      </p>
    </section>
  );
}
