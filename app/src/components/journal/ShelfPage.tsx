import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { Milestone } from "../../types";
import type { Practice } from "../../content/practices";
import { shelfDef, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import type { ObserveStatus, ObservedWhen } from "../../lib/milestones/observe";
import { practiceTitle } from "../../lib/practice/practiceTitle";
import { practiceText } from "../loop/PracticeCard";
import NoticeCard from "../loop/NoticeCard";
// B-DESIGN-04: the 44 px duotone glyph (its white chip on the header wash) + the shelf tone.
import { ShelfGlyph, shelfTone } from "../ui/ShelfGlyph";
import { SectionHead } from "../ui/SectionHead";
import { FreeText } from "../ui/FreeText";
import { shelfCountKey } from "./ShelfGrid";

/** One row of the shelf's thread, already labelled by the caller (the journal's own engine). */
export interface ShelfEntryRow {
  id: string;
  title: string;
  /** The parent's words when the row has them (shown in the editorial face). */
  words?: string;
  when: string;
}

export interface ShelfDayGroup {
  key: string;
  label: string;
  rows: ShelfEntryRow[];
}

export interface ShelfNoticeHandlers {
  onAnswer: (status: ObserveStatus) => void;
  onWhen?: (when: ObservedWhen) => void;
  onKeepQuote?: (text: string) => void;
  onKeepPhoto?: () => void;
  onUndo?: () => void;
}

export interface ShelfPageProps {
  shelf: ShelfId;
  childName: string;
  gender?: string | null;
  /** Entries on this shelf in the last 30 days (the tile's own count). */
  count: number;
  /** The shelf's next practice (the B-LOOP-09 chooser scoped to this shelf), or null. */
  practice: Practice | null;
  /** The practice is already today's (pinned or answered today). */
  practiceIsToday?: boolean;
  onTryToday: () => void;
  /** The shelf's next thing to notice (B-LOOP-04), or null. */
  notice: Milestone | null;
  noticeHandlers: ShelfNoticeHandlers;
  /** The shelf's entries, day-grouped by the journal engine, filtered by shelfOf only. */
  groups: ShelfDayGroup[];
  onOpenEntry: (id: string) => void;
  onBack: () => void;
  /** Opens the ONE capture sheet, pre-filed on this shelf. */
  onAdd: () => void;
  /** TimelineTab's ONE stamp literal — on this page it rides on the page's primary control. */
  primaryMoveProps?: Record<string, string>;
}

/** B-DESIGN-04: the hairline ring + the one 2 px lift (--arbor-shadow-card). */
const CARD: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--arbor-shadow-card)",
};

/**
 * B-LOOP-11 — a shelf page (`#/journal?shelf=<id>`, same route; Back returns
 * to the grid). Design of record: art/mockups/journal-shelves.html, phone 2,
 * re-dressed by B-DESIGN-04 (option-ab-blend.html frames 03 / 03b): the header
 * is a band on the shelf's FIXED wash with the 44 px duotone glyph on a white
 * chip, the H1 at --t-hero, and the shelf glyph at 96 px / 12 % of its jewel
 * bleeding off the inline-end corner — that screen's ONE accent (no words
 * accent here; logical inset + `direction: inherit`, so it lands on the end
 * side in Hebrew too).
 * Three modules: the header (back link, 44 px glyph, name, count) · Suggested
 * now (the shelf's practice on the coach-gradient band — the ONE gradient on
 * the page — the say-line on a navy rule and "Try it today"; then ONE Notice
 * card) · the shelf's entries, day-grouped, with the dashed add-moment row.
 *
 * FIREWALL: the only age statement is the Notice card's sourced line
 * (milestoneAgeLine); no count compares this shelf to another; an empty
 * shelf reads as normal, never as missing.
 */
export default function ShelfPage({
  shelf,
  childName,
  gender,
  count,
  practice,
  practiceIsToday = false,
  onTryToday,
  notice,
  noticeHandlers,
  groups,
  onOpenEntry,
  onBack,
  onAdd,
  primaryMoveProps,
}: ShelfPageProps) {
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const name = shelfLabel(shelf, t);
  const countLine = count > 0 ? t(shelfCountKey(count).key, shelfCountKey(count).vars) : t("elev.shelfJournal.page.none");
  const doText = practice ? practiceText(practice, "do", lang, gender) : "";
  const sayText = practice ? practiceText(practice, "say", lang, gender) : "";
  const materials = practice ? practiceText(practice, "materials", lang, gender) : "";
  const tone = shelfTone(shelf);
  const glyph = shelfDef(shelf).glyph;
  // The page's ONE stamp: "Try it today" when the shelf has a practice, else the add-moment row.
  const stampOnTry = !!practice && !practiceIsToday;
  // P5-LOOP c2 r1 (journal P1 G0): the empty line promises ONLY what renders —
  // "one small thing to try" with a practice, "one thing to notice" with a
  // Notice card, both only when both are on the page.
  const emptyBodyKey = practice && notice ? "elev.shelfJournal.page.empty.body"
    : practice ? "elev.shelfJournal.page.empty.bodyTry"
    : notice ? "elev.shelfJournal.page.empty.bodyNotice"
    : null;
  // B-LOOP-NEW-1d (2): the latest entry in the parent's own words leads "On
  // this shelf" (verbatim, its day as the caption); it is not repeated below.
  const leadGroup = groups.find((g) => g.rows.some((r) => r.words));
  const lead = leadGroup ? { group: leadGroup, row: leadGroup.rows.find((r) => r.words)! } : null;
  const listGroups = lead
    ? groups.map((g) => ({ ...g, rows: g.rows.filter((r) => r.id !== lead.row.id) })).filter((g) => g.rows.length > 0)
    : groups;
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-4">
      <header data-module="shelf-header" className="min-w-0">
        <button
          type="button"
          data-testid="shelf-back"
          onClick={onBack}
          className="-ms-1 inline-flex min-h-11 items-center gap-1 px-1 t-sm font-bold focus:outline-none focus-visible:ring-2"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="arrow_back" size={18} aria-hidden className="rtl:-scale-x-100" />
          {t("elev.shelfJournal.back")}
        </button>
        <div
          data-testid="shelf-page-hero"
          className="relative mt-1 flex items-center gap-3.5 overflow-hidden p-4"
          style={{ background: tone.wash, borderRadius: "var(--r-xl)", boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone.ink} 9%, transparent)` }}
        >
          <span className="relative flex-none"><ShelfGlyph shelf={shelf} onWash /></span>
          <div className="relative min-w-0">
            <h1 className="arbor-type-hero" style={{ color: "var(--arbor-ink)" }}>{name}</h1>
            <p data-testid="shelf-page-count" className="arbor-num mt-1 t-sm font-medium" style={{ color: "var(--arbor-ink-soft)" }}>{countLine}</p>
          </div>
          {glyph && (
            <span
              aria-hidden="true"
              data-testid="shelf-page-bleed"
              className="msr pointer-events-none absolute"
              style={{ insetInlineEnd: -16, top: "50%", transform: "translateY(-46%)", direction: "inherit", fontSize: 96, fontVariationSettings: "'opsz' 48, 'wght' 400, 'GRAD' 0, 'FILL' 1", color: `color-mix(in srgb, ${tone.jewel} 12%, transparent)` }}
            >
              {glyph}
            </span>
          )}
        </div>
        {count === 0 && (
          <p data-testid="shelf-page-empty" className="mt-3 t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            <em style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink-soft)" }}>{t("elev.shelfJournal.page.empty.lead")}</em>
            {emptyBodyKey && <>{" "}{t(emptyBodyKey)}</>}
          </p>
        )}
      </header>

      <section data-module="shelf-suggested" className="flex min-w-0 flex-col gap-3">
        {practice ? (
          <article data-testid="shelf-practice" data-practice-id={practice.id} className="overflow-hidden" style={CARD}>
            {/* The page's ONE gradient: the coach wash IS the caption row's own
                block (P5-LOOP c2 r1 design P1: the old fixed h-14 wash cut
                through the H2's descenders); the H2 sits on white below it. */}
            <p data-testid="shelf-practice-caption" className="flex items-center gap-2 px-4 py-2.5 t-sm font-bold" style={{ background: "var(--arbor-coach-grad)", color: "var(--arbor-muted)" }}>
              <Icon name="lightbulb" size={18} aria-hidden style={{ color: "var(--arbor-ink-soft)" }} />
              <span className="min-w-0 flex-1">{t("elev.shelfJournal.suggested")}</span>
              <span data-testid="shelf-practice-minutes" className="inline-flex flex-none items-center gap-1 t-sm font-semibold" style={{ color: "var(--arbor-ink-soft)" }}>
                <Icon name="schedule" size={16} aria-hidden />
                <span className="arbor-num">{t("elev.loop.practice.minutes", { n: practice.minutes })}</span>
              </span>
            </p>
            <div className="px-4 pb-4 pt-3">
              <h2 className="arbor-type-title" style={{ color: "var(--arbor-ink)" }}>
                <FreeText text={practiceTitle(doText, lang)} />
              </h2>
              {sayText && (
                <p data-testid="shelf-practice-say" className="mt-2 arbor-accent-rule arbor-type-say" style={{ color: "var(--arbor-ink)" }}>
                  {"“"}<bdi dir="auto">{sayText}</bdi>{"”"}
                </p>
              )}
              {materials && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{materials}</p>}
              {practiceIsToday ? (
                <p data-testid="shelf-try-today-done" role="status" className="mt-3 inline-flex min-h-11 items-center gap-1.5 t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
                  <Icon name="check" size={16} aria-hidden />
                  {t("elev.shelfJournal.tryToday.done")}
                </p>
              ) : (
                <button
                  type="button"
                  data-testid="shelf-try-today"
                  onClick={onTryToday}
                  {...(stampOnTry ? primaryMoveProps ?? {} : {})}
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 t-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
                >
                  <Icon name="today" size={18} aria-hidden />
                  {t("elev.shelfJournal.tryToday")}
                </button>
              )}
            </div>
          </article>
        ) : (
          <p data-testid="shelf-no-practice" className="t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.noPractice")}</p>
        )}
        {notice && (
          <div data-testid="shelf-notice" className="arbor-depth-card p-4 pb-1" style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)" }}>
            <SectionHead icon="visibility" title={t("elev.shelfJournal.notice")} />
            <NoticeCard
              key={notice.id}
              milestone={notice}
              shelf={shelf}
              gender={gender}
              childName={childName}
              variant="row"
              hideShelf
              answers="segmented"
              {...noticeHandlers}
            />
          </div>
        )}
      </section>

      <section data-module="shelf-entries" aria-labelledby="shelf-entries-title" className="min-w-0">
        {/* journal design P2-3: "On this shelf" in the BODY face (the h1–h3
            rule sets the display face with !important, so the words sit in a
            sans span); glyph + hairline as every section head. */}
        <div data-testid="shelf-entries-head" className="flex items-center gap-2.5">
          <Icon name="view_agenda" size={20} aria-hidden style={{ color: "var(--arbor-clay)" }} />
          <h2 id="shelf-entries-title" className="m-0 min-w-0 t-sm font-bold"><span style={{ fontFamily: "var(--font-sans)", color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.entries")}</span></h2>
          <span aria-hidden="true" className="h-px min-w-6 flex-1" style={{ background: "var(--arbor-rule)" }} />
        </div>
        {lead && (
          <button
            type="button"
            data-testid="shelf-lead-quote"
            onClick={() => onOpenEntry(lead.row.id)}
            className="mt-2 flex min-h-11 w-full flex-col items-start gap-0.5 py-1 text-start"
          >
            <span dir="auto" className="block border-s-2 ps-3 t-lg leading-snug line-clamp-3" style={{ borderColor: "var(--arbor-clay-dim)", fontFamily: "var(--font-editorial)", color: "var(--arbor-ink-soft)" }}>
              {"“"}<bdi dir="auto">{lead.row.words}</bdi>{"”"}
            </span>
            <span className="block ps-3.5 t-sm" style={{ color: "var(--arbor-muted)" }}><bdi>{lead.group.label}</bdi></span>
          </button>
        )}
        <button
          type="button"
          data-testid="shelf-add-moment"
          onClick={onAdd}
          {...(!stampOnTry ? primaryMoveProps ?? {} : {})}
          className="mt-2 flex w-full min-h-11 items-center gap-3 px-3.5 py-3 text-start focus:outline-none focus-visible:ring-2"
          style={{ border: "1px dashed var(--arbor-rule-strong)", borderRadius: "var(--r)" }}
        >
          <span aria-hidden="true" className="inline-flex flex-none items-center justify-center rounded-xl" style={{ width: 32, height: 32, background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}>
            <Icon name="add" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block t-base font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.shelfJournal.add", { shelf: name })}</span>
            <span className="block t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.add.sub", { shelf: name })}</span>
          </span>
        </button>
        {listGroups.map((g) => (
          <div key={g.key} className="mt-3">
            <h3 className="t-sm font-semibold"><span style={{ fontFamily: "var(--font-sans)", color: "var(--arbor-muted)" }}>{g.label}</span></h3>
            {g.rows.map((r) => (
              <button
                key={r.id}
                type="button"
                data-testid="shelf-entry"
                data-signal-id={r.id}
                onClick={() => onOpenEntry(r.id)}
                className="mt-2 flex w-full min-h-11 gap-3 px-3.5 py-3 text-start"
                style={{ ...CARD, borderRadius: "var(--r)" }}
              >
                <span className="min-w-0 flex-1">
                  {r.words ? (
                    <span className="block leading-snug line-clamp-3" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>
                      {"“"}<bdi dir="auto">{r.words}</bdi>{"”"}
                    </span>
                  ) : (
                    <span className="block t-base font-semibold leading-snug" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{r.title}</bdi></span>
                  )}
                  <span className="mt-0.5 block t-sm" style={{ color: "var(--arbor-muted)" }}>
                    {r.words ? <><bdi dir="auto">{r.title}</bdi>{r.when ? " · " : ""}</> : null}
                    {r.when && <bdi>{r.when}</bdi>}
                  </span>
                </span>
                <Icon name="chevron_right" size={18} aria-hidden className="self-center rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
              </button>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
