import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { SHELVES, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { ShelfGlyph, shelfTone } from "../ui/ShelfGlyph";

/** The tile's count line: "{n} noticed", or the one-thing-to-try line for 0 — never "0", never "empty". */
export function shelfCountKey(n: number): { key: string; vars?: Record<string, number> } {
  if (n <= 0) return { key: "elev.shelfJournal.nothingYet" };
  if (n === 1) return { key: "elev.loop.shelf.noticed.one" };
  return { key: "elev.loop.shelf.noticed", vars: { n } };
}

/** P5-LOOP c2 r2 (journal product P1 G1-1, B-LOOP-NEW-2c): a tile's ONE
 *  second line, in order — (a) the family's own latest words on that shelf
 *  (the Words tile includes the child's kept quotes; the header's entry is
 *  already excluded by the caller), (b) the shelf's next thing to notice,
 *  (c) its practice. An empty shelf keeps its practice line only. Each tile
 *  reads only its own shelf: never a comparison. */
export type TileNext =
  | { kind: "words"; text: string; date: string }
  | { kind: "notice"; title: string }
  | { kind: "try"; title: string }
  | null;

export function tileNext(
  n: number,
  words?: { text: string; date: string },
  notice?: string,
  tryTitle?: string,
): TileNext {
  if (n <= 0) return tryTitle ? { kind: "try", title: tryTitle } : null;
  if (words) return { kind: "words", text: words.text, date: words.date };
  if (notice) return { kind: "notice", title: notice };
  if (tryTitle) return { kind: "try", title: tryTitle };
  return null;
}

export interface ShelfGridProps {
  childName: string;
  /** Entries per shelf over the last 30 days (lib/milestones/selectByShelf shelfCoverage). */
  counts: Partial<Record<ShelfId, number>>;
  onOpenShelf: (shelf: ShelfId) => void;
  onOpenPro: () => void;
  onOpenAll: () => void;
  /** TimelineTab's ONE stamp literal (open-shelf). B-OCCL-04: spread on the
   *  FIRST tile in registry order (the control that opens a shelf), never on
   *  the grid — the grid is ~875 px at 375 and ran under the capture dock. */
  primaryMoveProps?: Record<string, string>;
  /** B-LOOP-NEW-1d (1): the parent's latest own entry, verbatim, with its
   *  shelf and a relative day; absent on first open (never a placeholder). */
  latest?: { text: string; shelf: ShelfId; day: string } | null;
  /** B-LOOP-NEW-1c (1): per tile, the parent's latest words on that shelf
   *  (verbatim, dated) — or, on an empty shelf, its practice's title. */
  tileWords?: Partial<Record<ShelfId, { text: string; date: string }>>;
  tileTry?: Partial<Record<ShelfId, string>>;
  /** c2 r2 (B-LOOP-NEW-2c): per shelf, the title of its next thing to notice
   *  (lib/journal/shelfView shelfNotice) — a filled tile's line when it has
   *  no words of its own. */
  tileNotice?: Partial<Record<ShelfId, string>>;
  /** B-LOOP-NEW-1c (2) / critic c2 r1 (journal product P1): the capture dock,
   *  unfiled — the grid's third module (budget 3). */
  captureDock?: React.ReactNode;
}

/** B-DESIGN-04 (blend frame 02): the detail line leads with its verb in ink
 *  ("Try:", "Next to notice:") — the whole localized line (with its bidi
 *  isolates) renders unchanged; only its verb prefix is set apart. */
function VerbLine({ line, verb }: { line: string; verb: string }) {
  if (!verb || !line.startsWith(verb)) return <>{line}</>;
  return (
    <>
      <span data-testid="shelf-tile-verb" className="font-semibold" style={{ color: "var(--arbor-ink)" }}>{verb}</span>
      {line.slice(verb.length)}
    </>
  );
}

/** B-DESIGN-04: the tile box — 44 px targets everywhere, ≥ 88 px tall, padding
 *  12. P7-DESIGN fix r1 (journal P1-1): below sm every tile is ONE height,
 *  116 px — its content is bounded (name <= 2 lines, count 1 line, detail 1
 *  line; ShelfGrid.test line model on the demo seed, EN + HE), so min-h IS the
 *  height and the rows are equal; from sm the old 96 floor. The detail line
 *  sits at the tile's foot (mt-auto), aligned across a row. */
const TILE = "flex w-full min-h-[116px] sm:min-h-[96px] flex-col items-start gap-2 p-3 text-start transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

/** B-DESIGN-04 (P7-DESIGN [B] element 2, framer ruling 7 Oct): a tile sits on
 *  its SHELF's fixed-strength wash (the -wash token; hands = the paper well)
 *  with a ring in the shelf's -ink. The tone is read from the shelf id ALONE —
 *  never from the count, the words or an answer — so a wash names the shelf
 *  and never grades the child (chromaticVerdict.firewall pins it). */
export function shelfTileStyle(shelf: ShelfId): React.CSSProperties {
  const tone = shelfTone(shelf);
  return {
    background: tone.wash,
    borderRadius: "var(--r-lg)",
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone.ink} 9%, transparent), 0 1px 2px color-mix(in srgb, var(--arbor-ink) 4%, transparent)`,
  };
}

/**
 * B-LOOP-11 → B-DESIGN-04 — the journal is nine shelves, not a list. Design of
 * record: execution/2026-10-07--design-direction/option-ab-blend.html (frames
 * 02 and 05). The header (eyebrow, display H1, one honest lede, the family's
 * newest line as the screen's ONE warm accent — editorial --t-say on the 2 px
 * ink rule — and the flip to the professional view as an underlined sapphire
 * text control) and the grid: equal tiles in registry order (two columns at
 * 375, three at lg), each on its shelf's fixed wash with the 44 px duotone
 * glyph on a white chip, the shelf name in the display face, ONE count line
 * and ONE verb-led detail line on the shelf's hairline; Family is a wide row
 * below lg; "Everything by date" is the dashed door to the full day-grouped
 * thread.
 *
 * FIREWALL: every tile is drawn the same way whatever its count; the wash is
 * the shelf's identity, never a state; the order is the registry's `order`,
 * never the count; a shelf with nothing shows the one-thing-to-try line,
 * never "0", "empty", a colour or a comparison.
 */
export default function ShelfGrid({ childName, counts, onOpenShelf, onOpenPro, onOpenAll, primaryMoveProps, latest = null, tileWords = {}, tileTry = {}, tileNotice = {}, captureDock }: ShelfGridProps) {
  const { t, uiLang } = useLanguage();
  const ordered = [...SHELVES].sort((a, b) => a.order - b.order);
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-col gap-4">
      <header data-module="journal-shelves-header" className="min-w-0">
        <p className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.eyebrow")}</p>
        {/* P7-DESIGN fix r1 (framer ruling R3, journal design P1-2): the grid H1
            on the hero step (34 px; 44 px at 1280), clearly above the 24 px words. */}
        <h1 className="mt-1 arbor-type-hero" style={{ color: "var(--arbor-ink)" }}>
          {t("elev.shelfJournal.h1", { name: childName })}
        </h1>
        <p className="mt-1 t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.lede")}</p>
        {latest && (
          <button
            type="button"
            data-testid="journal-latest-words"
            onClick={() => onOpenShelf(latest.shelf)}
            className="mt-3 flex min-h-11 w-full flex-col items-start gap-1 py-1 text-start focus:outline-none focus-visible:ring-2"
          >
            {/* The screen's ONE warm accent (B-DESIGN-04): the family's words,
                editorial, on the 2 px ink rule; shelf + day on their own line. */}
            {/* P7-DESIGN fix r1: no `block` beside a clamp — the built CSS orders
                .block after .line-clamp-*, which cancelled the clamp. */}
            <span dir="auto" data-testid="journal-latest-quote" className="w-full arbor-accent-rule arbor-type-say line-clamp-2" style={{ color: "var(--arbor-ink)" }}>
              {t("elev.loop.ms.quoted", { text: latest.text })}
            </span>
            <span className="block ps-4 t-sm" style={{ color: "var(--arbor-muted)" }}>
              <bdi>{shelfLabel(latest.shelf, t)}</bdi> · <bdi>{latest.day}</bdi>
            </span>
          </button>
        )}
        <button
          type="button"
          data-testid="journal-flip-pro"
          onClick={onOpenPro}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 t-sm font-bold underline underline-offset-4 focus:outline-none focus-visible:ring-2"
          style={{ color: "var(--arbor-clay)" }}
        >
          <Icon name="swap_horiz" size={16} aria-hidden />
          {t("elev.shelfJournal.flip")}
        </button>
      </header>

      <section data-module="journal-shelves" aria-label={t("elev.shelfJournal.gridAria", { name: childName })} className="min-w-0">
        <div data-testid="shelf-grid" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {ordered.map((def, i) => {
            const n = counts[def.id] ?? 0;
            const next = tileNext(n, tileWords[def.id], tileNotice[def.id], tileTry[def.id]);
            const line = n <= 0 && next ? { key: "elev.shelfJournal.nothingYetShort", vars: undefined } : shelfCountKey(n);
            const family = def.id === "family";
            const tone = shelfTone(def.id);
            return (
              <button
                key={def.id}
                type="button"
                data-testid="shelf-tile"
                data-shelf={def.id}
                {...(i === 0 ? primaryMoveProps ?? {} : {})}
                onClick={() => onOpenShelf(def.id)}
                className={`${TILE}${family ? " col-span-2 lg:col-span-1" : ""}`}
                style={shelfTileStyle(def.id)}
              >
                <span className="flex w-full min-w-0 items-center gap-2.5">
                  <ShelfGlyph shelf={def.id} onWash />
                  <span className="min-w-0 flex-1">
                    <span data-testid="shelf-tile-name" className="t-tile-name font-semibold leading-tight line-clamp-2" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{shelfLabel(def.id, t)}</span>
                    <span data-testid="shelf-tile-count" className={`arbor-num mt-0.5 t-sm leading-snug ${family ? "line-clamp-2" : "block truncate"}`} style={{ color: "var(--arbor-muted)" }}>
                      {family ? `${t("elev.shelfJournal.family.sub", { name: childName })} · ` : ""}
                      {t(line.key, line.vars)}
                    </span>
                  </span>
                </span>
                {/* B-LOOP-NEW-1c (1) → c2 r2 (B-LOOP-NEW-2c): ONE second line per
                    tile — the family's words (editorial), else the next thing to
                    notice, else the practice, verb first in ink. Each tile reads
                    only its own shelf. One line at 375 (journal design P2-2). */}
                {/* P7-DESIGN fix r1 (journal P1-1): ONE line at 375 — the clamp
                    without `block` (which cancelled it in the built CSS); the words
                    line is a truncating quote + a date that cannot wrap, so the
                    "·" never strands. font-normal so the verb's 600 leads (P2-19). */}
                {next && (
                  <span
                    data-testid="shelf-tile-next"
                    data-next={next.kind}
                    title={next.kind === "words" ? next.text : undefined}
                    className={`mt-auto w-full min-w-0 pt-2 t-sm font-normal leading-snug ${next.kind === "words" ? "flex items-baseline gap-1" : "line-clamp-1 sm:line-clamp-2"}`}
                    style={{ color: "var(--arbor-ink-soft)", borderTop: `1px solid color-mix(in srgb, ${tone.ink} 10%, transparent)` }}
                  >
                    {next.kind === "words" ? (
                      <><span dir="auto" data-testid="shelf-tile-quote" className="min-w-0 truncate" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)", fontSize: uiLang === "he" ? undefined : "var(--t-base)" }}>{t("elev.loop.ms.quoted", { text: next.text })}</span><span data-testid="shelf-tile-date" className="flex-none whitespace-nowrap">{"· "}<bdi>{next.date}</bdi></span></>
                    ) : (
                      <VerbLine line={t(next.kind === "notice" ? "elev.shelfJournal.nextNotice" : "elev.shelfJournal.tryLine", { title: next.title })} verb={t(next.kind === "notice" ? "elev.shelfJournal.nextNoticeVerb" : "elev.shelfJournal.tryVerb")} />
                    )}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            data-testid="shelf-all-by-date"
            onClick={onOpenAll}
            className="col-span-2 flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-start transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 lg:col-span-3"
            style={{ background: "transparent", border: "1px dashed var(--arbor-rule-strong)", borderRadius: "var(--r-lg)" }}
          >
            <span aria-hidden="true" className="inline-grid flex-none place-items-center" style={{ width: 36, height: 36, borderRadius: "var(--r)", background: "var(--arbor-paper-deep)" }}>
              <Icon name="calendar_month" size={19} fill={1} weight={400} style={{ gridArea: "1 / 1", color: "color-mix(in srgb, var(--arbor-clay) 30%, transparent)" }} />
              <Icon name="calendar_month" size={19} fill={0} weight={500} style={{ gridArea: "1 / 1", color: "var(--arbor-ink)" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block t-base font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("elev.shelfJournal.all")}</span>
              <span className="mt-0.5 block t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.all.sub")}</span>
            </span>
            <Icon name="chevron_right" size={18} aria-hidden className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
          </button>
        </div>
      </section>
      {captureDock && (
        <section data-module="journal-capture" aria-label={t("elev.shelfJournal.captureAria", { name: childName })} className="min-w-0">
          {captureDock}
        </section>
      )}
    </div>
  );
}
