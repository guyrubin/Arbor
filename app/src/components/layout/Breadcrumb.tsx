import React, { useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import { useCompactSurface } from "../ui/Sheet";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { backTargetFor, chromeLitHome, homeForTab } from "../../lib/companionPlaces";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";
import type { SheetClose } from "../../hooks/useSheetHistory";
import { announceSheetCrumb, useSheetCrumbShown } from "../../hooks/useSheetCrumbShown";

/**
 * v3 IA-06r — where the parent is, below a home: home › route › sheet.
 *
 * Two things carry a crumb, and while one is on screen it IS the chrome's
 * answer to "where am I": at lg and up the top bar's title becomes the crumb,
 * below lg it is a strip right under the phone header.
 *
 * - An open L2 sheet (SheetBreadcrumb): home › route › the sheet. It renders
 *   as the sheet's dialog companion (ui/DialogCompanion), inside the dialog
 *   layer: so it sits ABOVE the backdrop (Modal's 60 % black and blur would
 *   bury anything in the app root), the inert shield over the app root never
 *   reaches it, and its ancestors are real buttons. A crumb in the top bar
 *   itself could be neither read, reached nor clicked (IA-06 rounds 1 and 2).
 *   It is drawn over the title zone (lg+) or under the phone header.
 * - A deep leaf (an L2 route of the v3 route map, DEEP_LEAF_NAME_KEY): home ›
 *   the page. Nothing covers the chrome then, so it is drawn IN the top bar's
 *   title zone (Topbar) and in the phone header's strip (LeafCrumbStrip). When
 *   a sheet opens over a leaf, the sheet's crumb carries all three levels and
 *   the leaf's crumb steps aside, keeping its box.
 *
 * At most three levels. An ancestor goes to its route (a sheet's ancestors
 * first close the sheet through its one close path, retiring its history
 * entry). The last level is the current page. The first level and the last
 * stay whole: the middle gives up its width first (its label ellipsizes, down
 * to a floor that keeps its chevron and a 44 px target), and a long last
 * label wraps onto a second line rather than losing its end.
 */
export interface CrumbLevel { label: string; tab?: ActiveTab }

export const CRUMB_MAX_LEVELS = 3;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * The deep leaves: the v3 route map's L2 pages, each a page under its home
 * with no pill of its own (F-SHELL-1 takes the last pills off them), and the
 * v3 name its crumb gives it. A short pill name where the page has one, else
 * a crumb name of its own (nav.crumb.leaf.*): never the long nav.tab.* names
 * the old hubs printed ("Child Memory", "Safety & Escalation"). Left out on
 * purpose: #/attribution (admin only, no parent name) and the Learn reader
 * (#/learn with a card, its own history entry in LearnLibrary).
 */
export const DEEP_LEAF_NAME_KEY: Readonly<Partial<Record<ActiveTab, string>>> = {
  "day-windows": "nav.pill.day-windows",
  "smart-reminders": "nav.pill.reminders",
  memory: "nav.crumb.leaf.memory",
  screening: "nav.crumb.leaf.screening",
  journal: "nav.crumb.leaf.journal",
  science: "nav.tab.science",
  safety: "nav.pill.safety",
  handoff: "nav.tab.handoff",
  "school-brief": "nav.pill.school-brief",
  sharing: "nav.pill.sharing",
  "care-team": "nav.pill.sharing",
  appointments: "nav.tab.appointments",
  reports: "nav.tab.reports",
  family: "nav.crumb.leaf.family",
};

/** A translation, or null when the key has none (translate falls back to the key). */
function named(key: string, t: Translate): string | null {
  const label = t(key);
  return label && label !== key ? label : null;
}

/**
 * The route's own name under its home: its leaf name, or the name its pill
 * row prints (IA-02). None for the home's own pill unless that pill carries a
 * name of its own (My child's "Development map"; Now's first pill IS Now), and
 * none for a route with neither: an old nav.tab.* name is never a level.
 */
function routeNameFor(tab: ActiveTab, t: Translate): string | null {
  const leafKey = DEEP_LEAF_NAME_KEY[tab];
  if (leafKey) return named(leafKey, t);
  const pill = pillRowFor(sectionForTab(tab), tab).find(item => item.tab === tab);
  if (!pill) return null;
  const home = homeForTab(tab);
  if (!pill.labelKey && tab === (home.kind === "place" ? home.place : home.door).tab) return null;
  return named(pill.labelKey ?? "nav.tab." + tab, t);
}

/**
 * Level 1 is the home the chrome lights and names (chromeLitHome, as the top
 * bar and the Sidebar do): Talk is a panel over Now, so #/coach reads Now and
 * the panel is no level of its own. Level 2 is the route's own name, when it
 * is a page under that home (routeNameFor).
 */
function routeLevelsFor(tab: ActiveTab, lang: string, t: Translate): CrumbLevel[] {
  const home = homeForTab(tab);
  const lit = chromeLitHome(home);
  const place = lit.kind === "place" ? lit.place : lit.door;
  const homeLabel = lang === "he" ? place.he : place.en;
  const levels: CrumbLevel[] = [{ label: homeLabel, tab: place.tab }];
  const name = lit === home ? routeNameFor(tab, t) : null;
  if (name && name !== homeLabel) levels.push({ label: name, tab });
  return levels;
}

/** An open sheet's levels: the route's (routeLevelsFor), then the sheet. */
export function crumbLevelsFor(tab: ActiveTab, sheetLabel: string, lang: string, t: Translate): CrumbLevel[] {
  return [...routeLevelsFor(tab, lang, t), { label: sheetLabel }];
}

/**
 * A deep leaf's levels: its home, then the page itself (the current level, no
 * route to go to). null for every other route, which the plain home title
 * names (Topbar).
 */
export function leafCrumbLevelsFor(tab: ActiveTab, lang: string, t: Translate): CrumbLevel[] | null {
  if (!DEEP_LEAF_NAME_KEY[tab] || !backTargetFor(tab)) return null;
  const levels = routeLevelsFor(tab, lang, t);
  if (levels.length < 2) return null;
  return [...levels.slice(0, -1), { label: levels[levels.length - 1].label }];
}

/** Where the crumb is drawn: over the top bar title (lg+) or under the phone header. */
export type CrumbPlace = "bar" | "strip";
/** What carries it: an open sheet (drawn over the chrome) or a deep leaf (drawn in it). */
export type CrumbKind = "sheet" | "route";

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

/**
 * A sheet's crumb is a chip that floats over the dimmed chrome (absolute, on
 * opaque paper, placed by placeCrumb); a leaf's crumb sits in the chrome's
 * own flow, as the title it replaces does (its first label lines up with
 * where that title starts).
 */
const NAV_CLASS: Record<CrumbKind, string> = {
  sheet: "pointer-events-auto absolute flex min-h-11 min-w-0 items-center rounded-xl px-1.5",
  route: "flex min-h-11 min-w-0 items-center -ms-1",
};
const SHEET_CHIP: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  // A token, not a color-mix: no percentage ever reaches the markup
  // (the clinical firewall's render checks read every "%" as a score).
  boxShadow: "var(--shadow-md)",
};

export function Breadcrumb({ levels, place, kind = "sheet", onSelect, navRef, style, className }: {
  levels: CrumbLevel[];
  place: CrumbPlace;
  kind?: CrumbKind;
  /** Where an ancestor goes (a sheet's ancestor closes the sheet, then goes there). */
  onSelect: (tab: ActiveTab) => void;
  navRef?: React.Ref<HTMLElement>;
  style?: React.CSSProperties;
  className?: string;
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
      data-crumb-kind={kind}
      className={className ? `${NAV_CLASS[kind]} ${className}` : NAV_CLASS[kind]}
      style={{ ...(kind === "sheet" ? SHEET_CHIP : {}), color: "var(--arbor-ink)", ...style }}
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
        ? { top: "var(--crumb-top, 10px)", insetInlineStart: "var(--crumb-start, 1.25rem)", maxInlineSize: "var(--crumb-max, none)" }
        : { top: "var(--crumb-top, calc(env(safe-area-inset-top) + 4rem))", insetInline: "16px" }}
    />
  );
}

/**
 * A deep leaf's crumb for one place, or null: the route is no deep leaf, or
 * this is not the place's width (the bar is lg+, the strip below lg, so the
 * page holds one leaf crumb at a time). `held`: an open sheet's crumb stands
 * in for it (it carries the leaf's two levels and the sheet), so the leaf's
 * crumb steps aside and keeps its box.
 */
export function useLeafCrumb(place: CrumbPlace): { levels: CrumbLevel[]; held: boolean } | null {
  const { activeTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const compact = useCompactSurface();
  const held = useSheetCrumbShown();
  const levels = leafCrumbLevelsFor(activeTab, uiLang, t);
  if (!levels || compact !== (place === "strip")) return null;
  return { levels, held };
}

/** The strip sits 8 px under the phone header's row (its mb-4, less 8 px), as a sheet's strip does. */
const STRIP_CLASS = "lg:hidden -mt-2 mb-2";

/**
 * Below lg, a deep leaf's crumb: the strip right under the phone header
 * (ChildContextHeader renders it after its row). Its first level goes to the
 * home; the page itself is the current level. While a sheet's crumb stands in
 * for it, its one-row box stays, empty, so the page under the sheet does not
 * move.
 */
export function LeafCrumbStrip() {
  const { setActiveTab } = useArbor();
  const leaf = useLeafCrumb("strip");
  if (!leaf) return null;
  if (leaf.held) return <div aria-hidden="true" data-crumb-held="strip" className={`${STRIP_CLASS} min-h-11`} />;
  return <Breadcrumb kind="route" place="strip" levels={leaf.levels} onSelect={setActiveTab} className={STRIP_CLASS} />;
}
