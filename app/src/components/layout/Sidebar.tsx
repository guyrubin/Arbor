import React, { useState, useRef, useEffect } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";
import { ArborMark } from "../ui/ArborMark";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import SettingsModal from "./SettingsModal";
import { SECTIONS, sectionForTab, primaryTabOf, type NavBadge } from "../../lib/navigation";

/** Resolve the generalized sidebar badge to its display string from app state.
 *  Returns "" when the badge should not render. Clinical firewall: the milestone
 *  badge is a COUNT of parent-noticed milestones, never a percentage/score. */
export function badgeText(
  badge: NavBadge | undefined,
  state: { milestonesNoticed: number; plansCount: number; unreadCoachCount: number }
): string {
  if (!badge) return "";
  if (badge === "milestone") return state.milestonesNoticed ? String(state.milestonesNoticed) : "";
  if (badge === "plans") return state.plansCount ? String(state.plansCount) : "";
  if (badge.kind === "count") return state.unreadCoachCount ? String(state.unreadCoachCount) : "";
  return ""; // { kind: "dot" } handled by the caller
}

export default function Sidebar() {
  const { activeTab, setActiveTab, milestones, actionPlans, unreadCoachCount } = useArbor();
  const milestonesNoticed = milestones.filter((m) => m.checked).length;
  const { user, signOut, firebaseEnabled } = useAuth();
  const { t } = useLanguage();
  const activeSectionId = sectionForTab(activeTab).id;
  const [showSettings, setShowSettings] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account popover on outside click / Escape.
  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setPopoverOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopoverOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [popoverOpen]);

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
      className="hidden lg:flex flex-col gap-5 px-4 py-6 h-screen sticky top-0 overflow-y-auto bg-white"
      style={{ borderInlineEnd: "1px solid var(--arbor-rule)" }}
    >
      {/* Brand lockup — softer 38px rounded mark + wordmark (UC-1 density) */}
      <div className="flex items-center gap-2.5 px-1">
        <ArborMark size={38} />
        {/* CR-21: this was a second <h1> on every desktop route — the page's one
            heading belongs to the hub, not to the chrome's wordmark. */}
        <p className="text-[21px] font-extrabold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</p>
      </div>

      {/* Child profile card */}
      <ProfileSwitcher />

      {/* Eight primary categories — denser, rounder rows (UC-1) */}
      <nav aria-label={t("elev.sidebar.nav.aria")} className="flex flex-col gap-1 flex-1">
        {SECTIONS.map((sec) => {
          const active = sec.id === activeSectionId;
          const text = badgeText(sec.badge, { milestonesNoticed, plansCount: actionPlans.length, unreadCoachCount });
          const showDot = typeof sec.badge === "object" && sec.badge.kind === "dot";
          return (
            <button
              key={sec.id}
              onClick={() => setActiveTab(primaryTabOf(sec))}
              aria-current={active ? "page" : undefined}
              className="flex items-center justify-between gap-3 rounded-[13px] text-start transition"
              style={{
                padding: "11px 13px",
                fontSize: "14.5px",
                ...(active
                  ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)", fontWeight: 700 }
                  : { color: "var(--arbor-muted)", fontWeight: 600 }),
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--arbor-paper-deep)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon name={sec.msIcon} size={22} fill={active ? 1 : 0} />
                <span className="truncate">{t("nav.cat." + sec.id)}</span>
              </span>
              {showDot ? (
                <span aria-hidden="true" className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: "var(--arbor-clay)" }} />
              ) : text ? (
                <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5 flex-shrink-0" style={active ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                  {text}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* UC-6: the global TOOLS drawer is REMOVED. The sidebar is now exactly the
          eight hubs + the account row. Each hub's secondary capabilities are
          folded into its own contextual pill row (Shell › hubTabsForSection), so
          tools feel integrated with their hub rather than a separate drawer. */}

      {/* Account row + upward popover (Language toggle + Settings) — UC-1 */}
      <div ref={accountRef} className="mt-auto pt-4 relative" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
        {popoverOpen && (
          <div
            role="menu"
            aria-label={t("nav.popover.more")}
            className="absolute bottom-full mb-2 inset-inline-start-0 w-full rounded-2xl p-2 z-30"
            style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "0 12px 32px color-mix(in srgb, var(--arbor-ink) 12%, transparent)" }}
          >
            {/* OBJ-SHELL-02: the language toggles that lived here are GONE.
                Two canons ran side by side — these 35×25 buttons flipped the
                whole app on touch, while Settings asks for a draft and a Save.
                Settings is the canon (UC-1: one system-control panel with an
                explicit save/cancel), so the popover keeps only the door to it.
                Pinned by languageSettingsCanonical.test.ts, which now fails on
                any setUiLang call outside SettingsModal. */}
            {/* Settings entry */}
            <button
              role="menuitem"
              onClick={() => { setPopoverOpen(false); setShowSettings(true); }}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition text-start"
              style={{ color: "var(--arbor-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="settings" size={18} /> {t("nav.popover.settings")}
            </button>
            {firebaseEnabled && user && (
              <button
                role="menuitem"
                onClick={() => void signOut()}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] font-semibold transition text-start"
                style={{ color: "var(--arbor-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="logout" size={18} /> {t("nav.signout")}
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setPopoverOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={popoverOpen}
          aria-label={t("nav.popover.more")}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-2xl transition"
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Avatar name={user?.displayName} photoURL={user?.photoURL} size={34} ring />
          <div className="min-w-0 flex-1 text-start">
            <p className="text-[12px] font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user?.displayName || t("nav.parent")}</p>
            {user?.email && <p className="text-[10px] truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
          </div>
          <Icon name="expand_less" size={18} style={{ color: "var(--arbor-muted)", transform: popoverOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 150ms ease" }} />
        </button>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </aside>
  );
}
