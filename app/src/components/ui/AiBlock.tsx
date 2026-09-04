import React, { useState } from "react";
import Icon from "./Icon";
import { SpeakButton } from "./SpeakButton";
import type { UiLang } from "../../lib/i18n";

/**
 * AI-17 — the shared structured-output primitive.
 *
 * Arbor's north star is structured AI output plus one-tap save, and the same
 * answer used to look and behave differently depending on which screen the
 * parent happened to be on: the coach answer, the vision result and the
 * hard-moment guide each hand-rolled their own framed section, their own
 * checklist, their own clipboard handler and their own action row.
 *
 * These four blocks are that anatomy, lifted out of the RICHEST of the three
 * (CoachAnswerCards) rather than redesigned. Every tone below reproduces a
 * shape that already ships, class for class:
 *
 *   card   — the coach answer's white section (the reference)
 *   inset  — the vision result's paper-deep section
 *   guide  — the hard-moment guide's wider section with a heading title
 *
 * The tones differ because the surfaces differ TODAY, not because a new
 * design was invented here. Converging them is a design decision and a
 * separate item; centralising them is what makes that decision possible in
 * one place instead of three. Byte-equivalence is pinned by
 * coach/coachAnswerCardsMarkup.test.ts, behaviors/hardMomentGuideMarkup.test.ts
 * and ui/aiBlock.test.ts.
 *
 * CLINICAL FIREWALL: every string is injected by the caller and rendered
 * verbatim. Nothing here derives a score, a percentage, a ring, a delta or a
 * graded verdict about a child, and no tone is selected from child data.
 */

/** Which shipped section shape to render. See the module note above. */
export type AiBlockTone = "card" | "inset" | "guide";

export function AiBlock({
  icon,
  title,
  tint,
  tone = "card",
  action,
  children,
}: {
  /** Leading glyph. Omitted by the guide tone, which titles with a heading. */
  icon?: React.ReactNode;
  title: string;
  /** Section accent, always an --arbor-* token supplied by the caller. */
  tint: string;
  tone?: AiBlockTone;
  /** Trailing control on the title row (card tone only). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (tone === "inset") {
    return (
      <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider mb-1.5" style={{ color: tint }}>{icon} {title}</span>
        {children}
      </div>
    );
  }
  if (tone === "guide") {
    return (
      <div className="min-w-0 rounded-xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <h4 className="text-xs font-bold" style={{ color: tint }}>{title}</h4>
        {children}
      </div>
    );
  }
  return (
    <div className="rounded-xl p-3.5 bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: tint }}>
          {icon} {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * SayThis — the exact words a parent can say aloud, with the two affordances
 * that make them usable in the moment: read-aloud and copy.
 *
 * The transient copied state stays with the CALLER, because a surface that
 * has several copy targets clears them as one; owning it here would let two
 * confirmations sit on screen at once.
 */
export function SayThis({
  text,
  title,
  lang = "en",
  copyLabel,
  copiedLabel,
  copied,
  onCopy,
}: {
  text: string;
  title: string;
  lang?: UiLang;
  copyLabel: string;
  copiedLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <AiBlock
      icon={<Icon name="format_quote" size={12} />} title={title} tint="var(--arbor-sky-ink)"
      action={
        <div className="flex items-center gap-2">
          <SpeakButton text={text} lang={lang} className="text-[10px]" />
          <button onClick={onCopy} className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
            {copied ? <><Icon name="check" size={12} /> {copiedLabel}</> : <><Icon name="content_copy" size={12} /> {copyLabel}</>}
          </button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed italic" style={{ color: "var(--arbor-ink)" }}>&ldquo;{text}&rdquo;</p>
    </AiBlock>
  );
}

/**
 * Checklist — the steps a parent can tick off. The done state is local and
 * deliberately unpersisted: it is a working surface for the next hour, not a
 * record of the child, so nothing here is stored, counted or sent anywhere.
 */
export function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <ul className="space-y-1">
      {items.map((step, i) => (
        <li key={i}>
          <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="flex items-start gap-2 text-start w-full group">
            {/* CR-01: the checked and unchecked boxes are separate
                elements rather than one box with a conditional fill.
                Same pixels either way — but the contrast ratchet can only
                prove a tick's legibility when the fill it sits on is
                statically known, and a ternary hid that. The glyph moves
                from a white text class to --arbor-on-accent, the token
                that exists for ink on a saturated accent fill, so the
                pairing is expressed in tokens the checker can resolve. */}
            {done[i] ? (
              <span
                className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition"
                style={{ background: "var(--arbor-clay)", border: "1px solid var(--arbor-clay)" }}
              >
                <Icon name="check" size={12} style={{ color: "var(--arbor-on-accent)" }} />
              </span>
            ) : (
              <span
                className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition"
                style={{ border: "1px solid var(--arbor-rule-strong)" }}
              />
            )}
            <span className="text-[12.5px] leading-snug" style={done[i] ? { color: "var(--arbor-muted)", textDecoration: "line-through" } : { color: "var(--arbor-ink)" }}>{step}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One action in a KeepBar. `content` is the whole button body so a caller can
 * swap in a transient confirmation without the primitive owning that state.
 */
export type KeepAction = {
  id: string;
  onClick: () => void;
  /** Accent (default) leads the row; outline is every following action. */
  tone?: "accent" | "outline";
  content: React.ReactNode;
};

/**
 * KeepBar — the row that carries a structured answer OUT of the screen it was
 * read on: into a plan, a log, a hand-off note, the clipboard.
 *
 * This is the answer-local row, deliberately distinct from ContentActionBar,
 * which owns the canonical verb order plus the why-line and Trust Center
 * chip for keepable CONTENT objects. Surfaces that need provenance and the
 * canonical `save` verb should still mount ContentActionBar.
 */
export function KeepBar({ actions }: { actions: KeepAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {actions.map((a) =>
        a.tone === "outline" ? (
          <button key={a.id} onClick={a.onClick} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
            {a.content}
          </button>
        ) : (
          <button key={a.id} onClick={a.onClick} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            {a.content}
          </button>
        ),
      )}
    </div>
  );
}
