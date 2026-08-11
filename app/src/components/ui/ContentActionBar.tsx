import React from "react";
import Icon from "./Icon";
import { cardCls } from "../../lib/tokens";
import { track } from "../../lib/analytics";
import { useLanguage } from "../../context/LanguageContext";
import { TrustLink } from "../trust/TrustLink";
import {
  orderContentActions,
  verbLabel,
  type ContentActionVerb,
} from "../../lib/i18nElevation/actionbar";

/* ════════════════════════════════════════════════════════════════════════════
   ContentActionBar — masterplan 4.2 + 3.1: THE shared content action cluster.

   One fixed verb set in one fixed order — done · save · rate · share ·
   more(swap) — on every content object (the Kinedu consistency rule). Each
   verb is optional: a surface passes handlers only for the verbs it supports
   and unsupported verbs simply don't render, but the ORDER is invariant —
   enforced by mapping over orderContentActions(), never by caller prop order.

   Two variants, same verbs/order/handlers:
     - "bar":    the segmented full-width card (LearnReader shape) — icon over
                 label, ≥60px targets.
     - "inline": the compact icon row (card-corner bookmark shape) — 44px
                 round icon buttons, aria-label carries the verb.

   Surface-specific affordances that are NOT canonical verbs (listen, ask the
   coach, …) ride in `extras` and render AFTER the canonical verbs, in caller
   order — the canon never re-orders around them.

   Why-line slot (masterplan rule 3.1): every recommendation card carries a
   required why-line; `why` renders it above the actions (bar) / before the
   icons (inline), and `trustLink` mounts the TrustLink chip ("How Arbor
   decides →") directly after the why text — same row, `surface` passed
   through. ContentWhyLine is exported standalone for section-level why-lines
   (e.g. a rail header) so the slot stays ONE component everywhere.

   Analytics: every press fires track("contentaction", { verb, surface }) —
   extras report their id as the verb. Surface handlers keep their own
   existing events (learn_listen, learn_share, …) — this event is additive.

   a11y/RTL: aria-pressed on toggles (any action that declares `active`),
   logical borderInlineStart dividers, motion-reduce guards, kit tokens only
   (no raw hex — the PLAT-6 ratchet applies).
   ════════════════════════════════════════════════════════════════════════════ */

export type { ContentActionVerb };

export type ContentAction = {
  verb: ContentActionVerb;
  onClick: () => void;
  /** Toggle state: renders aria-pressed + the active (clay) tint. */
  active?: boolean;
  disabled?: boolean;
  /** Copy override; defaults to the shared elev.actionbar.* label. */
  label?: string;
  /** Material Symbols ligature override; defaults per verb. */
  icon?: string;
  /** Icon fill axis (0 outlined / 1 filled). */
  fill?: 0 | 1;
};

/** Surface-specific non-canonical action — renders after the canonical verbs. */
export type ContentActionExtra = {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
  fill?: 0 | 1;
};

const DEFAULT_ICONS: Record<ContentActionVerb, string> = {
  done: "check_circle",
  save: "bookmark",
  rate: "thumb_up",
  share: "ios_share",
  more: "swap_horiz",
};

/** Resolve uiLang without requiring a LanguageProvider (kit useUiLang recipe). */
function useHeMode(): boolean {
  let lang: string | undefined;
  try {
    lang = useLanguage().uiLang;
  } catch {
    /* outside a LanguageProvider — default to en */
  }
  return lang === "he";
}

/** The required why-line slot (masterplan 3.1) + its TrustLink mount point.
 *  Exported standalone so section-level why-lines (rail headers) use the SAME
 *  slot component the bar uses internally. */
export function ContentWhyLine({
  why,
  trustLink = false,
  surface,
  className = "",
}: {
  why: string;
  trustLink?: boolean;
  surface?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-x-2 gap-y-1 flex-wrap text-[11.5px] ${className}`.trim()}
      style={{ color: "var(--arbor-muted)" }}
    >
      <span dir="auto">{why}</span>
      {trustLink && <TrustLink surface={surface} />}
    </span>
  );
}

type Item = {
  key: string;
  verb: string; // canonical verb or extra id — the analytics tag
  label: string;
  icon: string;
  fill: 0 | 1;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
};

export function ContentActionBar({
  actions,
  extras = [],
  surface,
  why,
  trustLink = false,
  variant = "bar",
  className = "",
}: {
  actions: readonly ContentAction[];
  extras?: readonly ContentActionExtra[];
  /** Analytics tag naming the mounting surface (e.g. "learn-reader"). */
  surface: string;
  /** Why-line (rule 3.1) — renders above/beside the actions. */
  why?: string;
  /** Mount the TrustLink chip after the why text. */
  trustLink?: boolean;
  variant?: "bar" | "inline";
  className?: string;
}) {
  const heMode = useHeMode();

  // Canonical verbs first, in canonical order (never caller order); then the
  // surface's extras, in caller order.
  const items: Item[] = [
    ...orderContentActions(actions).map((a) => ({
      key: a.verb,
      verb: a.verb as string,
      label: a.label ?? verbLabel(a.verb, heMode, a.active),
      icon: a.icon ?? DEFAULT_ICONS[a.verb],
      fill: a.fill ?? 0,
      onClick: a.onClick,
      active: a.active,
      disabled: a.disabled,
    })),
    ...extras.map((e) => ({
      key: `extra-${e.id}`,
      verb: e.id,
      label: e.label,
      icon: e.icon,
      fill: e.fill ?? 0,
      onClick: e.onClick,
      active: e.active,
      disabled: undefined,
    })),
  ];

  const press = (item: Item) => () => {
    try {
      track("contentaction", { verb: item.verb, surface });
    } catch {
      /* noop */
    }
    item.onClick();
  };

  if (items.length === 0 && !why) return null;

  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
        {why && <ContentWhyLine why={why} trustLink={trustLink} surface={surface} className="me-1" />}
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={press(item)}
            disabled={item.disabled}
            aria-label={item.label}
            aria-pressed={item.active === undefined ? undefined : item.active}
            className="inline-flex items-center justify-center rounded-full w-11 h-11 transition active:scale-[0.92] motion-reduce:transition-none motion-reduce:transform-none focus:outline-none focus-visible:ring-2 disabled:opacity-70"
            style={{
              background: "var(--arbor-paper-elevated)",
              color: item.active ? "var(--arbor-clay)" : "var(--arbor-muted)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <Icon name={item.icon} size={20} fill={item.fill} />
          </button>
        ))}
      </span>
    );
  }

  return (
    <div className={`${cardCls} overflow-hidden ${className}`.trim()}>
      {why && (
        <div className="px-4 pt-3">
          <ContentWhyLine why={why} trustLink={trustLink} surface={surface} />
        </div>
      )}
      {items.length > 0 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={press(item)}
              disabled={item.disabled}
              aria-pressed={item.active === undefined ? undefined : item.active}
              className="flex flex-col items-center justify-center gap-1 py-3 min-h-[60px] transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-70"
              style={{
                color: item.active ? "var(--arbor-clay)" : "var(--arbor-ink-soft)",
                // Logical divider — mirrors correctly in RTL.
                borderInlineStart: i > 0 ? "1px solid var(--arbor-rule)" : undefined,
              }}
            >
              <Icon name={item.icon} size={20} fill={item.fill} />
              <span className="text-[11.5px] font-bold" dir="auto">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContentActionBar;
