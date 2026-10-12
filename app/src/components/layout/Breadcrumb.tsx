import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab } from "../../lib/companionPlaces";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";
import type { SheetClose } from "../../hooks/useSheetHistory";

/**
 * v3 IA-06 — where an open L2 sheet sits: home › route › sheet.
 *
 * The crumb lives INSIDE the sheet, on the line under its title. An open
 * dialog shields everything outside it (lib/dialogStack makes the app root
 * inert and aria-hidden; Modal also dims and blurs it), so a crumb in the top
 * bar could be neither read, reached nor announced while the sheet it names
 * was open, and on a phone it scrolled away with the page. In the dialog it is
 * all three, and it is on screen the moment the sheet opens.
 *
 * At most three levels. The ancestors are buttons: each closes the sheet
 * through its one close path (retiring its history entry) and then goes to
 * its route. The sheet itself is the current page.
 */
export interface CrumbLevel { label: string; tab?: ActiveTab }

export const CRUMB_MAX_LEVELS = 3;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Level 1 is the route's home (its place or door, IA-04). Level 2 is the
 * route's own name as its pill row prints it (IA-02), dropped when it is the
 * home again (Now's first pill IS Now). Level 3 is the sheet. v3 F-SHELL-1:
 * `childName` fills About {name} as the pill prints it; a filter pill
 * (Together's ?f=) is a state of its route, not the route's own name.
 */
export function crumbLevelsFor(tab: ActiveTab, sheetLabel: string, lang: string, t: Translate, childName = ""): CrumbLevel[] {
  const home = homeForTab(tab);
  const named = home.kind === "place" ? home.place : home.door;
  const homeLabel = lang === "he" ? named.he : named.en;
  const levels: CrumbLevel[] = [{ label: homeLabel, tab: named.tab }];
  const pill = pillRowFor(sectionForTab(tab), tab).find(item => item.tab === tab && !item.query);
  const key = pill?.labelKey === "nav.pill.about" && !childName ? "nav.pill.aboutChild" : pill?.labelKey ?? "nav.tab." + tab;
  const routeLabel = pill?.labelKey || tab !== named.tab ? t(key, { name: childName }) : homeLabel;
  if (routeLabel && routeLabel !== key && routeLabel !== homeLabel) levels.push({ label: routeLabel, tab });
  levels.push({ label: sheetLabel });
  return levels;
}

/**
 * One line, never a horizontal scroll. Compact: the home stays whole; the
 * middle level gives up its width first (its label ellipsizes) down to a floor
 * that keeps its chevron and a 44 px target; the sheet's own level ellipsizes
 * only after that, as a last resort, because its full text is the title right
 * above it. Wide: every ancestor may shrink to the same floor. No level clips
 * its box (overflow would cut the 2 px focus ring); only label spans truncate.
 */
function levelClass(compact: boolean, index: number, last: number): string {
  if (index === last) return "flex min-w-0 items-center gap-1";
  if (!compact) return "flex min-w-16 items-center gap-1";
  if (index === 0) return "flex shrink-0 items-center gap-1";
  return "flex min-w-16 shrink-[999] items-center gap-1";
}

export function Breadcrumb({ levels, compact = false, onSelect, className }: {
  levels: CrumbLevel[];
  compact?: boolean;
  /** Where an ancestor goes. Without it the ancestors are plain text, never dead buttons. */
  onSelect?: (tab: ActiveTab) => void;
  className?: string;
}) {
  const { t } = useLanguage();
  const shown = levels.slice(-CRUMB_MAX_LEVELS);
  if (!shown.length) return null;
  const last = shown.length - 1;
  return (
    <nav aria-label={t("nav.crumb.aria")} data-testid="sheet-crumb" className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <ol className="flex items-center gap-1 min-w-0">
        {shown.map((level, index) => (
          <li key={`${index}-${level.label}`} data-crumb-level={index + 1} className={levelClass(compact, index, last)}>
            {index > 0 && <Icon name="chevron_right" size={16} className="rtl:-scale-x-100 shrink-0" style={{ color: "var(--arbor-muted)" }} />}
            {index < last && level.tab && onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(level.tab!)}
                className="min-h-11 min-w-11 px-1 flex items-center text-start rounded-lg text-[13px] font-semibold hover:underline underline-offset-2"
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

/**
 * The crumb an L2 sheet renders as the first line of its body, directly under
 * the dialog's title row (pulled up against it; -ms-1 lines the first label up
 * with the title). After the close button in DOM order, so a sheet still opens
 * with focus on its close, never on a route change.
 */
export function SheetBreadcrumb({ label, close, className = "-mt-3 mb-1 -ms-1" }: {
  label: string;
  close: SheetClose;
  className?: string;
}) {
  const { activeTab, setActiveTab, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  return (
    <Breadcrumb
      compact
      levels={crumbLevelsFor(activeTab, label, uiLang, t, (childProfile?.name || "").trim().split(/\s+/)[0] || "")}
      className={className}
      onSelect={tab => close(() => setActiveTab(tab))}
    />
  );
}
