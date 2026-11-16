import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { ASPECT_ICONS, isTold, type AspectId, type AspectState } from "../../lib/aboutAspects";
import { Icon } from "../ui/Icon";
import { aboutCopy } from "./aboutViewCopy";

/**
 * v10.3 (the My child frame) — the index: one row of eight equal segments, one
 * per area of what Arbor knows. It is the overview and the way in: the
 * selected segment drives the area panel below.
 *
 * Each segment carries the area's glyph and name, how many things the parent
 * told or approved there (a count of their record, never a share, and no
 * number at all for zero), and its state in words: told, remembered, nothing
 * told yet, and "waiting for you" when a proposal waits there. A quiet segment
 * is an area with nothing told: never a deficit, no colour for how the child
 * is doing. Each segment is a real button (aria-pressed).
 */
export default function AboutAreaIndex({ aspects, selected, waiting, onSelect, phone }: {
  aspects: readonly AspectState[];
  selected: AspectId;
  /** Areas where a proposal waits for the parent. */
  waiting: ReadonlySet<AspectId>;
  onSelect: (id: AspectId) => void;
  phone?: boolean;
}) {
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  return (
    <div className={`mci${phone ? " m ds-snap-scroll" : ""}`} style={{ "--n": aspects.length } as React.CSSProperties} role="group" aria-label={copy.pickArea} data-testid="about-area-index">
      {aspects.map((state) => {
        const told = isTold(state);
        const remembered = state.known?.source === "memory";
        const on = state.id === selected;
        return (
          <button
            key={state.id}
            type="button"
            className={`mcs touch-target${on ? " on" : ""}${told ? "" : " quiet"}`}
            aria-pressed={on}
            data-testid={`about-area-${state.id}`}
            onClick={() => onSelect(state.id)}
          >
            <span className="mct">
              <i className="tg" aria-hidden="true"><Icon name={ASPECT_ICONS[state.id]} size={16} /></i>
              {state.toldCount > 0 && <b aria-label={copy.tileCount(state.toldCount)}>{state.toldCount}</b>}
            </span>
            <span className="mcn">{t(`companion.about.aspect.${state.id}`)}</span>
            <span className="mcm">
              {told ? (remembered ? copy.statusRemembered : copy.statusTold) : copy.statusNothing}
              {waiting.has(state.id) && <span className="mcw">{copy.statusWaiting}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
