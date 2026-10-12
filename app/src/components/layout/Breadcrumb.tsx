import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import { useCompactSurface } from "../ui/Sheet";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab } from "../../lib/companionPlaces";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";
import type { SheetClose } from "../../hooks/useSheetHistory";
import { announceSheetCrumb } from "../../hooks/useSheetCrumbShown";

/**
 * v3 IA-06r — where an open L2 sheet sits: home › route › sheet.
 *
 * While the sheet is open the crumb IS the chrome's answer to "where am I":
 * at lg and up it is drawn over the top bar's title zone (the title becomes
 * the crumb), below lg it is a strip right under the phone header. It renders
 * as the sheet's dialog companion (ui/DialogCompanion), inside the dialog
 * layer: so it sits ABOVE the backdrop (Modal's 60 % black and blur would
 * bury anything in the app root), the inert shield over the app root never
 * reaches it, and its ancestors are real buttons. A crumb in the top bar
 * itself could be neither read, reached nor clicked (IA-06 rounds 1 and 2).
 *
 * At most three levels. The ancestors close the sheet through its one close
 * path (retiring its history entry) and then go to their route. The sheet
 * itself is the current page. The first level and the last stay whole: the
 * middle gives up its width first (its label ellipsizes, down to a floor that
 * keeps its chevron and a 44 px target), and a long sheet label wraps onto a
 * second line rather than losing its end.
 */
export interface CrumbLevel { label: string; tab?: ActiveTab }

export const CRUMB_MAX_LEVELS = 3;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Level 1 is the route's home (its place or door, IA-04). Level 2 is the
 * route's own name as its pill row prints it (IA-02), dropped when it is the
 * home again (Now's first pill IS Now). Level 3 is the sheet.
 */
export function crumbLevelsFor(tab: ActiveTab, sheetLabel: string, lang: string, t: Translate): CrumbLevel[] {
  const home = homeForTab(tab);
  const named = home.kind === "place" ? home.place : home.door;
  const homeLabel = lang === "he" ? named.he : named.en;
  const levels: CrumbLevel[] = [{ label: homeLabel, tab: named.tab }];
  const pill = pillRowFor(sectionForTab(tab), tab).find(item => item.tab === tab);
  const key = pill?.labelKey ?? "nav.tab." + tab;
  const routeLabel = pill?.labelKey || tab !== named.tab ? t(key) : homeLabel;
  if (routeLabel && routeLabel !== key && routeLabel !== homeLabel) levels.push({ label: routeLabel, tab });
  levels.push({ label: sheetLabel });
  return levels;
}

/** Where the crumb is drawn: over the top bar title (lg+) or under the phone header. */
export type CrumbPlace = "bar" | "strip";

/** The custom property a crumb sets on its dialog layer: how far down the dialog box must start. */
export const CRUMB_INSET_VAR = "--arbor-crumb-inset";
/** px between the crumb and the header above it, and between the crumb and the dialog box. */
const GAP = 8;
/** The crumb's own one-line height: the 44 px target floor. */
const ROW = 44;

/**
 * One row per level. The home never shrinks; the middle shrinks first and far
 * (its label ellipsizes) down to a floor that holds its chevron and a 44 px
 * target; the sheet's level may shrink only by wrapping, never by cutting its
 * text. No level clips its box (overflow would cut the 2 px focus ring).
 */
function levelClass(index: number, last: number): string {
  if (index === last) return "flex min-w-0 items-center gap-1";
  if (index === 0) return "flex shrink-0 items-center gap-1";
  return "flex min-w-16 shrink-[999] items-center gap-1";
}

export function Breadcrumb({ levels, place, onSelect, navRef, style }: {
  levels: CrumbLevel[];
  place: CrumbPlace;
  /** Where an ancestor goes: it closes the sheet, then goes there. */
  onSelect: (tab: ActiveTab) => void;
  navRef?: React.Ref<HTMLElement>;
  style?: React.CSSProperties;
}) {
  const { t } = useLanguage();
  const shown = levels.slice(-CRUMB_MAX_LEVELS);
  if (!shown.length) return null;
  const last = shown.length - 1;
  const text = place === "bar" ? "text-[15px]" : "text-[13px]";
  return (
    <nav
      ref={navRef}
      aria-label={t("nav.crumb.aria")}
      data-testid={place === "bar" ? "topbar-crumb" : "mobile-crumb"}
      data-crumb-place={place}
      className="pointer-events-auto absolute flex min-h-11 min-w-0 items-center rounded-xl px-1.5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--arbor-ink) 16%, transparent)",
        color: "var(--arbor-ink)",
        ...style,
      }}
    >
      <ol className="flex min-w-0 items-center gap-1">
        {shown.map((level, index) => (
          <li key={`${index}-${level.label}`} data-crumb-level={index + 1} className={levelClass(index, last)}>
            {index > 0 && <Icon name="chevron_right" size={16} className="rtl:-scale-x-100 shrink-0" style={{ color: "var(--arbor-muted)" }} />}
            {index < last && level.tab ? (
              <button
                type="button"
                onClick={() => onSelect(level.tab!)}
                className={`min-h-11 min-w-11 px-1 flex items-center text-start rounded-lg ${text} font-semibold hover:underline underline-offset-2`}
                style={{ color: "var(--arbor-muted)" }}
              >
                <span className={index === 0 ? "whitespace-nowrap" : "min-w-0 truncate"} dir="auto">{level.label}</span>
              </button>
            ) : (
              <span
                aria-current={index === last ? "page" : undefined}
                className={`min-w-0 break-words px-1 py-1.5 ${text} font-semibold`}
                style={{ color: index === last ? "var(--arbor-ink)" : "var(--arbor-muted)" }}
                dir="auto"
              >
                {level.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const useCrumbLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * Put the crumb where its place is: over the top bar title zone
 * (`[data-crumb-anchor="bar"]`, Topbar) — centred in the 64 px band, starting
 * where the title starts, no wider than the title zone — or right under the
 * phone header (`[data-crumb-anchor="strip"]`, ChildContextHeader), held below
 * the safe area when the page under the sheet was scrolled past the header.
 * Then tell the dialog layer how far down its box must start
 * (CRUMB_INSET_VAR), so the box never covers the crumb. Positions are logical
 * (inline-start), so Hebrew mirrors them. Re-measured whenever the crumb's own
 * size or the window changes; the page under an open dialog cannot scroll
 * (lib/dialogStack locks it). Returns the undo.
 */
export function placeCrumb(nav: HTMLElement, place: CrumbPlace): () => void {
  const doc = nav.ownerDocument;
  const win = doc.defaultView;
  const layer = nav.closest<HTMLElement>("[data-arbor-dialog-layer]");
  const measure = () => {
    const frame = (layer ?? doc.documentElement).getBoundingClientRect();
    const anchor = doc.querySelector<HTMLElement>(`[data-crumb-anchor="${place}"]`)?.getBoundingClientRect();
    if (anchor && anchor.width > 0 && anchor.height > 0) {
      if (place === "bar") {
        const rtl = win?.getComputedStyle(nav).direction === "rtl";
        nav.style.setProperty("--crumb-top", `${Math.max(0, Math.round(anchor.top - frame.top + (anchor.height - ROW) / 2))}px`);
        nav.style.setProperty("--crumb-start", `${Math.round(rtl ? frame.right - anchor.right : anchor.left - frame.left)}px`);
        nav.style.setProperty("--crumb-max", `${Math.floor(anchor.width)}px`);
      } else {
        nav.style.setProperty("--crumb-top", `max(${Math.round(anchor.bottom - frame.top + GAP)}px, calc(env(safe-area-inset-top) + ${GAP}px))`);
      }
    }
    layer?.style.setProperty(CRUMB_INSET_VAR, `${Math.ceil(nav.getBoundingClientRect().bottom - frame.top + GAP)}px`);
  };
  measure();
  const Observer = win?.ResizeObserver;
  const observer = Observer ? new Observer(measure) : null;
  observer?.observe(nav);
  win?.addEventListener("resize", measure);
  return () => {
    observer?.disconnect();
    win?.removeEventListener("resize", measure);
    layer?.style.removeProperty(CRUMB_INSET_VAR);
  };
}

/** Place the crumb before the first paint, and again when its place changes. */
function useCrumbPlacement(navRef: React.RefObject<HTMLElement | null>, place: CrumbPlace): void {
  useCrumbLayoutEffect(() => (navRef.current ? placeCrumb(navRef.current, place) : undefined), [navRef, place]);
}

/**
 * The crumb an L2 sheet passes to its dialog as `companion`:
 *
 *   const close = useSheetHistory(open, onClose);
 *   <Sheet open onClose={() => close()} title={title}
 *     companion={<SheetBreadcrumb label={title} close={close} />}>
 *
 * Its levels follow the route under the sheet; each ancestor closes the sheet
 * through `close` and goes to its route once the sheet's history entry is
 * gone. Before measurement (and on the server) it sits at its CSS fallback
 * place, which is already over the title zone or under the header.
 */
export function SheetBreadcrumb({ label, close }: { label: string; close: SheetClose }) {
  const { activeTab, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const place: CrumbPlace = useCompactSurface() ? "strip" : "bar";
  const navRef = useRef<HTMLElement | null>(null);
  useCrumbPlacement(navRef, place);
  // The top bar's title steps aside while this crumb stands in for it.
  useCrumbLayoutEffect(() => {
    announceSheetCrumb(1);
    return () => announceSheetCrumb(-1);
  }, []);
  return (
    <Breadcrumb
      place={place}
      navRef={navRef}
      levels={crumbLevelsFor(activeTab, label, uiLang, t)}
      onSelect={tab => close(() => setActiveTab(tab))}
      style={place === "bar"
        ? { top: "var(--crumb-top, 10px)", insetInlineStart: "var(--crumb-start, 1.25rem)", maxInlineSize: "var(--crumb-max, calc(100% - 2.5rem))" }
        : { top: "var(--crumb-top, calc(env(safe-area-inset-top) + 4rem))", insetInline: "16px" }}
    />
  );
}
