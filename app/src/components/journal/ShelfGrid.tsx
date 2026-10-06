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

export interface ShelfGridProps {
  childName: string;
  /** Entries per shelf over the last 30 days (lib/milestones/selectByShelf shelfCoverage). */
  counts: Partial<Record<ShelfId, number>>;
  onOpenShelf: (shelf: ShelfId) => void;
  onOpenPro: () => void;
  onOpenAll: () => void;
  /** TimelineTab's ONE stamp literal (open-shelf), spread on the grid of shelves. */
  primaryMoveProps?: Record<string, string>;
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
export default function ShelfGrid({ childName, counts, onOpenShelf, onOpenPro, onOpenAll, primaryMoveProps }: ShelfGridProps) {
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
        <div data-testid="shelf-grid" className="grid grid-cols-2 gap-2.5 lg:grid-cols-3" {...(primaryMoveProps ?? {})}>
          {ordered.map((def) => {
            const n = counts[def.id] ?? 0;
            const line = shelfCountKey(n);
            const family = def.id === "family";
            return (
              <button
                key={def.id}
                type="button"
                data-testid="shelf-tile"
                data-shelf={def.id}
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
    </div>
  );
}
