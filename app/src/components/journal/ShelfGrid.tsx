import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { SHELVES, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { ShelfGlyph } from "../loop/ShelfGlyph";

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

const TILE = "flex w-full min-h-[96px] flex-col items-start gap-2 p-3.5 text-start transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
const TILE_STYLE: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-xs)",
};

/**
 * B-LOOP-11 — the journal is nine shelves, not a list. Design of record:
 * execution/2026-10-06--milestone-loop/art/mockups/journal-shelves.html,
 * phone 1. The header (eyebrow, display H1, one honest lede, the flip to the
 * professional view as an underlined sapphire text control) and the grid:
 * equal tiles in registry order (two columns at 375, three at lg) with the
 * shelf glyph, the name and ONE count line; Family is a wide row below lg;
 * "Everything by date" is the dashed door to the full day-grouped thread.
 *
 * FIREWALL: every tile is drawn the same way whatever its count; the order
 * is the registry's `order`, never the count; a shelf with nothing shows the
 * one-thing-to-try line, never "0", "empty", a colour or a comparison.
 */
export default function ShelfGrid({ childName, counts, onOpenShelf, onOpenPro, onOpenAll, primaryMoveProps, latest = null, tileWords = {}, tileTry = {}, tileNotice = {}, captureDock }: ShelfGridProps) {
  const { t } = useLanguage();
  const ordered = [...SHELVES].sort((a, b) => a.order - b.order);
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-col gap-4">
      <header data-module="journal-shelves-header" className="min-w-0">
        <p className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.eyebrow")}</p>
        <h1 className="mt-1 t-2xl leading-tight tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("elev.shelfJournal.h1", { name: childName })}
        </h1>
        <p className="mt-1 t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.shelfJournal.lede")}</p>
        {latest && (
          <button
            type="button"
            data-testid="journal-latest-words"
            onClick={() => onOpenShelf(latest.shelf)}
            className="mt-2 flex min-h-11 w-full flex-col items-start gap-0.5 py-1 text-start focus:outline-none focus-visible:ring-2"
          >
            <span dir="auto" className="block border-s-2 ps-3 t-lg leading-snug line-clamp-2" style={{ borderColor: "var(--arbor-clay-dim)", fontFamily: "var(--font-editorial)", color: "var(--arbor-ink-soft)" }}>
              {"“"}{latest.text}{"”"}
            </span>
            <span className="block ps-3.5 t-sm" style={{ color: "var(--arbor-muted)" }}>
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
        <div data-testid="shelf-grid" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {ordered.map((def, i) => {
            const n = counts[def.id] ?? 0;
            const next = tileNext(n, tileWords[def.id], tileNotice[def.id], tileTry[def.id]);
            const line = n <= 0 && next ? { key: "elev.shelfJournal.nothingYetShort", vars: undefined } : shelfCountKey(n);
            const family = def.id === "family";
            return (
              <button
                key={def.id}
                type="button"
                data-testid="shelf-tile"
                data-shelf={def.id}
                {...(i === 0 ? primaryMoveProps ?? {} : {})}
                onClick={() => onOpenShelf(def.id)}
                className={`${TILE}${family ? " col-span-2 flex-row items-center lg:col-span-1 lg:flex-col lg:items-start" : ""}`}
                style={TILE_STYLE}
              >
                <ShelfGlyph shelf={def.id} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block t-base font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{shelfLabel(def.id, t)}</span>
                  <span data-testid="shelf-tile-count" className="mt-0.5 block t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>
                    {family ? `${t("elev.shelfJournal.family.sub", { name: childName })} · ` : ""}
                    {t(line.key, line.vars)}
                  </span>
                  {/* B-LOOP-NEW-1c (1) → c2 r2 (B-LOOP-NEW-2c): ONE second line per
                      tile — the family's words, else the next thing to notice,
                      else the practice. Each tile reads only its own shelf. */}
                  {next && (
                    <span data-testid="shelf-tile-next" data-next={next.kind} className="mt-1 block t-sm leading-snug line-clamp-2" style={{ color: "var(--arbor-ink-soft)" }}>
                      {next.kind === "words" ? (
                        <><span dir="auto" style={{ fontFamily: "var(--font-editorial)" }}>{"“"}{next.text}{"”"}</span>{" · "}<bdi>{next.date}</bdi></>
                      ) : next.kind === "notice" ? (
                        t("elev.shelfJournal.nextNotice", { title: next.title })
                      ) : (
                        t("elev.shelfJournal.tryLine", { title: next.title })
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="shelf-all-by-date"
            onClick={onOpenAll}
            className={`${TILE} col-span-2 flex-row items-center lg:col-span-3`}
            style={{ background: "transparent", border: "1px dashed var(--arbor-rule-strong)", borderRadius: "var(--r-lg)" }}
          >
            <span aria-hidden="true" className="inline-flex flex-none items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}>
              <Icon name="calendar_month" size={19} />
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
