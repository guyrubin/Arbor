import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab } from "../../lib/companionPlaces";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";
import { useSheetCrumb } from "./crumbBus";

/**
 * v3 IA-06 — where an open L2 sheet sits: home › route › sheet.
 *
 * It renders only while a sheet has declared itself through crumbBus
 * (useL2Sheet). The desktop top bar shows it under the page title, in place of
 * the hub sentence; the phone shows it as a one-line strip under the header.
 * At most three levels. The ancestors are buttons that close the sheet first
 * and then go to their route; the sheet itself is the current page.
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

function levelClass(compact: boolean, index: number, last: number): string {
  if (index === last) return "flex min-w-0 items-center gap-1";
  if (!compact) return "flex items-center gap-1";
  if (index === 0) return "flex shrink-0 items-center gap-1";
  // Phone: the middle level gives up its width first, down to a floor that
  // keeps its chevron and a 44 px target; the last level ellipsizes only once
  // the first two fit no tighter.
  return "flex min-w-16 shrink-[999] items-center gap-1 truncate";
}

export function Breadcrumb({ levels, compact = false, onSelect, className }: {
  levels: CrumbLevel[];
  compact?: boolean;
  onSelect?: (tab: ActiveTab) => void;
  className?: string;
}) {
  const { t } = useLanguage();
  const shown = levels.slice(-CRUMB_MAX_LEVELS);
  if (!shown.length) return null;
  const last = shown.length - 1;
  return (
    <nav aria-label={t("nav.crumb.aria")} data-testid="topbar-crumb" className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <ol className="flex items-center gap-1 min-w-0">
        {shown.map((level, index) => (
          <li key={`${index}-${level.label}`} data-crumb-level={index + 1} className={levelClass(compact, index, last)}>
            {index > 0 && <Icon name="chevron_right" size={16} className="rtl:-scale-x-100 shrink-0" style={{ color: "var(--arbor-muted)" }} />}
            {index < last && level.tab ? (
              <button
                type="button"
                onClick={() => onSelect?.(level.tab!)}
                className="min-h-11 min-w-11 px-1 flex items-center text-start rounded-lg text-[13px] font-semibold"
                style={{ color: "var(--arbor-muted)" }}
              >
                <span className="min-w-0 truncate" dir="auto">{level.label}</span>
              </button>
            ) : (
              <span
                aria-current={index === last ? "page" : undefined}
                className="min-w-0 truncate px-1 text-[13px] font-semibold"
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

/** The crumb of the open L2 sheet, or nothing when no sheet is open. */
export function SheetBreadcrumb({ compact = false, className }: { compact?: boolean; className?: string }) {
  const crumb = useSheetCrumb();
  const { activeTab, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  if (!crumb) return null;
  return (
    <Breadcrumb
      levels={crumbLevelsFor(activeTab, crumb.label, uiLang, t)}
      compact={compact}
      className={className}
      onSelect={tab => crumb.close(() => setActiveTab(tab))}
    />
  );
}
