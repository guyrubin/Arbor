import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";
import { ArborMark } from "../ui/ArborMark";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { requestOpenSettings } from "./settingsBus";
import { type NavBadge } from "../../lib/navigation";
import { COMPANION_PLACES, COMPANION_DOORS, homeForTab, type CompanionHome } from "../../lib/companionPlaces";
import { requestCompanionConversation } from "../../lib/companionConversation";
import { useEntitlement } from "../../hooks/useEntitlement";
import type { EntitlementInfo } from "../../lib/api";

/** v3 F-SHELL-2: the account row's plan line. null while the plan is unknown
 *  (loading, or the client fallback): never print "Free" as a guess (MOB-08).
 *  Same branch order as SettingsModal's plan label. */
export function sidebarPlanKey(entitlement: EntitlementInfo, loading: boolean, isFallback: boolean): string | null {
  if (loading || isFallback) return null;
  const isPaid = entitlement.plan !== "free";
  if (isPaid && !entitlement.enforced) return "elev.sidebar.plan.beta";
  if (entitlement.plan === "family") return "elev.sidebar.plan.family";
  if (entitlement.plan === "plus") return "elev.sidebar.plan.plus";
  return "elev.sidebar.plan.free";
}

/** v3 F-SHELL-2 (critic ruling 10): Talk is a panel over a page, never a
 *  place. On #/coach and #/scholar the page under the panel is Now, so the
 *  sidebar lights Now; the Talk door is never the current row. */
export function sidebarLitHome(home: CompanionHome): CompanionHome {
  return home.kind === "door" && home.door.id === "talk" ? { kind: "place", place: COMPANION_PLACES[0] } : home;
}

/** Resolve the generalized sidebar badge to its display string from app state.
 *  Returns "" when the badge should not render.
 *
 *  B-SHELL-26: NO badges in parent mode. "Ask Arbor 103" read as 103 unread
 *  messages (it was a queue of notes to review — parent-written facts are now
 *  kept on creation and inferences are asked inline, B-AI-07), and "Growth 6"
 *  was a count with nothing new behind it. The plumbing (NavBadge, the state
 *  the callers pass) stays so a visit-due marker (Care, within 48 h) can use
 *  it; no data is deleted. */
export function badgeText(
  badge: NavBadge | undefined,
  state: { milestonesNoticed: number; plansCount: number; pendingReviewCount: number }
): string {
  void badge;
  void state;
  return "";
}

export default function Sidebar() {
  const { activeTab, setActiveTab } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  // v3 IA-01: ONE active entry across the three places and the three doors:
  // the route's home (table A). #/consult lights Care, together and nothing else.
  // v3 F-SHELL-2: except Talk, which is a panel over Now (sidebarLitHome).
  const lit = sidebarLitHome(homeForTab(activeTab));
  const { entitlement, loading: planLoading, isFallback: planUnverified } = useEntitlement();
  const planKey = sidebarPlanKey(entitlement, planLoading, planUnverified);

  return (
    /* OBJ-SHELL-03 / R16 — the seam between the sidebar and the content column
       is the logical inline-end border, never a physical right one: under
       `dir="rtl"` the sidebar moves to the right of the viewport, so a physical
       right border draws against the window edge and the seam the parent
       actually reads — the one against the content — disappears. The logical
       property follows the direction for free. `data-arbor-seam` stamps the
       node the rendered
       acceptance measures, so a validator reads THIS element's computed
       border-inline-end rather than guessing which <aside> it found. */
    <aside
      data-testid="app-sidebar"
      data-arbor-seam="inline-end"
      className="hidden lg:flex flex-col gap-5 px-4 py-6 h-full min-h-0 sticky top-0 overflow-y-auto bg-white"
      style={{ borderInlineEnd: "1px solid var(--arbor-rule)" }}
    >
      {/* Brand lockup — softer 38px rounded mark + wordmark (UC-1 density) */}
      <div className="flex items-center gap-2.5 px-1">
        <ArborMark size={38} />
        {/* CR-21: this was a second <h1> on every desktop route — the page's one
            heading belongs to the hub, not to the chrome's wordmark. */}
        {/* v3 F-SHELL-2: the wordmark is display 24/600. */}
        <p className="text-[24px] font-semibold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</p>
      </div>

      {/* Child profile card */}
      <ProfileSwitcher />

      <nav aria-label={t("elev.sidebar.nav.aria")} className="flex flex-col gap-1 flex-1">
        {COMPANION_PLACES.map(place => {
          const active = lit.kind === "place" && lit.place.id === place.id;
          return <button key={place.id} data-home={place.id} onClick={() => setActiveTab(place.tab)} aria-current={active ? "page" : undefined}
            className="flex items-start gap-3 rounded-2xl px-3 py-3 text-start min-h-11 transition-colors"
            style={{ background: active ? "var(--arbor-clay-dim)" : "transparent", color: active ? "var(--arbor-clay-deep)" : "var(--arbor-ink)" }}>
            <Icon name={place.icon} size={24} chrome active={active} />
            <span><span className="block text-[15.5px] font-bold">{he ? place.he : place.en}</span>
              <span className="block mt-1 text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{he ? place.detailHe : place.detailEn}</span></span>
          </button>;
        })}
        {/* v3 IA-01: the three doors sit under a hairline, below the places.
            Their names come from i18nCompanion through COMPANION_DOORS, and
            Talk carries no count (B-SHELL-26).
            v3 F-SHELL-2 (critic ruling 10): Talk opens the conversation panel
            over the current page through the shared seam; the route does not
            change and the Talk row is never current. */}
        <div className="mt-3 pt-4 space-y-0.5" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
          {COMPANION_DOORS.map(door => {
            const isTalk = door.id === "talk";
            const active = !isTalk && lit.kind === "door" && lit.door.id === door.id;
            return <button key={door.id} data-home={door.id}
              onClick={() => (isTalk ? requestCompanionConversation({ source: "sidebar" }) : setActiveTab(door.tab))}
              aria-haspopup={isTalk ? "dialog" : undefined}
              aria-current={active ? "page" : undefined}
              className="w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-start text-sm font-semibold transition-colors"
              style={{ color: active ? "var(--arbor-clay-deep)" : "var(--arbor-muted)", background: active ? "var(--arbor-clay-dim)" : "transparent" }}>
              <Icon name={door.icon} size={21} chrome active={active} />{he ? door.he : door.en}
            </button>;
          })}
        </div>
      </nav>

      {/* v3 F-SHELL-2 (critic ruling 12): the account row is ONE button that
          opens Settings through the settings bus (B-SHELL-23: Shell's one
          SettingsModal, same Kid Mode gate as the More sheet's Settings row).
          It shows the parent's avatar, name and plan, and a settings glyph; no
          email in chrome and no popover. Sign out and the language switch live
          in Settings (OBJ-SHELL-02: languageSettingsCanonical.test.ts fails on
          any setUiLang call outside SettingsModal). The plan line prints
          nothing until the server has answered (MOB-08). */}
      <div className="mt-auto pt-2">
        <button
          type="button"
          data-testid="sidebar-account"
          onClick={() => requestOpenSettings()}
          className="w-full min-h-11 flex items-center gap-2.5 px-2 py-2 rounded-2xl text-start transition"
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {/* The name is printed beside it, so the avatar adds nothing to the button's name. */}
          <span aria-hidden="true" className="flex-shrink-0"><Avatar name={user?.displayName} photoURL={user?.photoURL} size={36} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user?.displayName || t("nav.parent")}</span>
            {planKey && <span data-testid="sidebar-plan" className="block text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{t(planKey)}</span>}
          </span>
          <Icon name="settings" size={18} style={{ color: "var(--arbor-muted)" }} />
          <span className="sr-only">{t("nav.popover.settings")}</span>
        </button>
      </div>

    </aside>
  );
}
