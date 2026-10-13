import { useId } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { EXTRACT_CONTEXTS } from "../../content/behaviorTaxonomy";
import { DOMAIN_IDS, domainName, isDomainId, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { BODY_ONLY_SHELF, shelvesOfDomain, type ShelfId } from "../../lib/shelves/registry";
import type { BehaviorContext } from "../../types";
import { Icon } from "../ui/Icon";

/**
 * F-CHILD-2 — the Keep-a-moment sheet's optional "Where" and "Area" chips.
 * Both are the parent's own choice and both may stay empty: nothing here is
 * inferred. A chip toggles off when tapped again (44 px floor, aria-pressed).
 */

/** One glyph per recorded place (the Moments places view uses the same set). */
export const PLACE_ICONS: Readonly<Record<BehaviorContext, string>> = {
  Home: "home",
  School: "school",
  Transit: "directions_car",
  Public: "park",
};

/** Literal keys, so the rendered-key guard resolves every one. */
export const PLACE_LABEL_KEYS: Readonly<Record<BehaviorContext, string>> = {
  Home: "companion.moments.place.Home",
  School: "companion.moments.place.School",
  Transit: "companion.moments.place.Transit",
  Public: "companion.moments.place.Public",
};

/**
 * The area a filtered Moments view (or an expanded row) is showing, read from
 * the current hash's `?area=`; null when there is none or it is unknown.
 */
export function areaFromHash(): DomainId | null {
  try {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash;
    const at = hash.indexOf("?");
    if (at < 0) return null;
    const value = new URLSearchParams(hash.slice(at + 1)).get("area");
    return isDomainId(value) ? value : null;
  } catch {
    return null;
  }
}

/** The shelf a moment files under when the parent picks an area. */
export function shelfForArea(domain: DomainId): ShelfId | undefined {
  return domain === "body" ? BODY_ONLY_SHELF : shelvesOfDomain(domain)[0];
}

const chipStyle = (on: boolean) => ({
  border: `1px solid ${on ? "var(--arbor-clay)" : "var(--arbor-rule)"}`,
  background: on ? "var(--arbor-clay-soft)" : "var(--arbor-paper-elevated)",
  color: on ? "var(--arbor-clay-deep)" : "var(--arbor-ink)",
});

export default function CaptureWhereArea({ place, onPlace, area, onArea, showArea }: {
  place: BehaviorContext | "";
  onPlace: (context: BehaviorContext | "") => void;
  area: DomainId | null;
  onArea: (domain: DomainId | null) => void;
  showArea: boolean;
}) {
  const { t } = useLanguage();
  const whereId = useId();
  const areaId = useId();
  return (
    <div className="mb-3 space-y-3" data-capture-where-area>
      <div role="group" aria-labelledby={whereId}>
        <p id={whereId} className="mb-1.5 t-sm font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{t("companion.capture.where")}</p>
        <div className="flex flex-wrap gap-2">
          {EXTRACT_CONTEXTS.map(context => {
            const on = place === context;
            return (
              <button key={context} type="button" data-capture-place={context} aria-pressed={on}
                onClick={() => onPlace(on ? "" : context)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 t-sm font-semibold focus:outline-none focus-visible:ring-2"
                style={chipStyle(on)}>
                <Icon name={PLACE_ICONS[context]} size={18} />{t(PLACE_LABEL_KEYS[context])}
              </button>
            );
          })}
        </div>
      </div>
      {showArea && (
        <div role="group" aria-labelledby={areaId}>
          <p id={areaId} className="mb-1.5 t-sm font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{t("companion.capture.area")}</p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_IDS.map(domain => {
              const on = area === domain;
              return (
                <button key={domain} type="button" data-capture-area={domain} aria-pressed={on}
                  onClick={() => onArea(on ? null : domain)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 t-sm font-semibold focus:outline-none focus-visible:ring-2"
                  style={chipStyle(on)}>
                  <Icon name={DOMAIN_ICONS[domain]} size={18} />{domainName(domain, t)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
