import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { hardMomentCards, renderSayThis, type HardMomentCard } from "../../content/hardMomentCards";
import { locText } from "../../content/hardMomentSurface";
import { heldRowsSince, rowIsCard } from "../behaviors/hardMomentLastTime";
import { hardMomentWordsText } from "../behaviors/HardMomentWords";
import { shareWordsText } from "../../lib/share";

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface WorkedLine {
  card: HardMomentCard;
  /** The Say-this sentence (with the child's first name where the card names them). */
  sentence: string;
  /** ISO time the parent answered "held the plan". */
  at: string;
}

/** At most three lines in the card. */
export const WHAT_WORKED_MAX = 3;

/**
 * B-TODAY-29 — the sentences the parent marked "held the plan" this week
 * (B-ASKJB-33's first answer), one per card, newest first, at most three.
 * Pure. Zero rows → [] and the card does not render (never "0").
 */
export function whatWorkedThisWeek(
  loop: readonly ActionLoopEntry[],
  weekStartMs: number,
  opts: { locale: "en" | "he"; childName: string; nowMs?: number; cards?: readonly HardMomentCard[] },
): WorkedLine[] {
  const cards = opts.cards ?? hardMomentCards;
  const out: WorkedLine[] = [];
  const seen = new Set<string>();
  for (const row of heldRowsSince(loop, weekStartMs, opts.nowMs)) {
    const card = cards.find((c) => rowIsCard(row, c));
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    out.push({ card, sentence: locText(renderSayThis(card, opts.childName), opts.locale), at: row.outcomeAt! });
    if (out.length === WHAT_WORKED_MAX) break;
  }
  return out;
}

/** The shared text: the B-ASKJB-33 payload of each line, joined by blank lines. */
export function whatWorkedText(lines: readonly WorkedLine[], opts: { locale: "en" | "he"; parentName: string; t: T }): string {
  return lines.map((l) => hardMomentWordsText(l.card, { locale: opts.locale, parentName: opts.parentName, t: opts.t })).join("\n\n");
}

/**
 * "What worked with {name} this week" — the parent's own held sentences, each
 * with its day, and the same text-only "Send these words to…". Parent
 * register: the words in the editorial serif (the largest text), 12 px day
 * line, no count, no colour per line. Renders nothing when the week holds none.
 */
export default function WhatWorkedCard({ lines, childName, parentName, locale, t }: {
  lines: readonly WorkedLine[];
  childName: string;
  parentName: string;
  locale: "en" | "he";
  t: T;
}) {
  const [copied, setCopied] = useState(false);
  if (lines.length === 0) return null;
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", { weekday: "long" });
  return (
    <section
      data-testid="weekly-what-worked"
      lang={locale}
      dir={locale === "he" ? "rtl" : "ltr"}
      className="rounded-[20px] p-5 text-start sm:p-6"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <h2 dir="auto" className="text-[17px] font-semibold" style={{ color: "var(--arbor-ink)" }}>
        <bdi>{t("wk.worked.title", { name: childName })}</bdi>
      </h2>
      <ul className="mt-3 space-y-3">
        {lines.map((l) => (
          <li key={l.card.id} data-testid="weekly-what-worked-line">
            <p dir="auto" className="border-s-2 ps-3 text-[18px] leading-snug" style={{ borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
              <bdi>{l.sentence}</bdi>
            </p>
            <p className="mt-1 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>{day(l.at)}</p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="weekly-what-worked-send"
        onClick={() => { void shareWordsText(whatWorkedText(lines, { locale, parentName, t })).then((r) => setCopied(r === "copied")); }}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
        style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
      >
        <Icon name="ios_share" size={16} /> {t("hm.send.cta")}
      </button>
      {copied && <p role="status" className="mt-1 text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("hm.send.copied")}</p>}
    </section>
  );
}
