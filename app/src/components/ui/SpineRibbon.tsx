import React from "react";
import { Icon } from "./Icon";
import { PASTEL, type PastelKey } from "../../lib/tokens";

/* SpineRibbon — E3 "the spine, made visible": the prototype's tinted cross-link
   note as one reusable strip. Tinted tone wash → small glyph → ONE sentence
   naming what this surface's action feeds → optional deep-link chevron (caller
   passes setActiveTab). ONE DIRECTION ONLY (L4): a surface states what it
   feeds, never a back-link pair — the single `onFollow` is the whole
   affordance. CLINICAL FIREWALL: the sentence is a plain activity fact —
   callers never pass %, verdicts, or deltas; strings arrive pre-translated via
   t(). RTL: logical flow + rtl-flipped chevron. Static strip — no entrance
   motion to gate. */
export interface SpineRibbonProps {
  /** The one translated "this feeds X" sentence (t("elev.spine.*")). */
  text: string;
  /** Parent-kit tone of the hosting surface. */
  tone?: PastelKey;
  /** Material Symbols glyph hinting the fed surface. */
  icon?: string;
  /** Deep link to the fed surface (e.g. () => setActiveTab("timeline")). */
  onFollow?: () => void;
  testId?: string;
  className?: string;
}

export function SpineRibbon({ text, tone = "mint", icon = "hub", onFollow, testId, className = "" }: SpineRibbonProps) {
  const p = PASTEL[tone];
  const base = "w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 min-h-[44px]";
  const style: React.CSSProperties = { background: p.soft, border: "1px solid var(--arbor-rule)" };
  const inner = (
    <>
      <span
        className="inline-flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 30, height: 30, background: "var(--arbor-paper-elevated)", color: p.ink }}
      >
        <Icon name={icon} size={17} fill={1} />
      </span>
      <span className="flex-1 text-[12.5px] font-bold leading-snug text-start" dir="auto" style={{ color: p.ink }}>
        {text}
      </span>
      {onFollow && <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:rotate-180" style={{ color: p.ink }} />}
    </>
  );
  if (!onFollow) return <div data-testid={testId} className={`${base} ${className}`.trim()} style={style}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onFollow}
      data-testid={testId}
      className={`${base} transition active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none ${className}`.trim()}
      style={style}
    >
      {inner}
    </button>
  );
}
export default SpineRibbon;
