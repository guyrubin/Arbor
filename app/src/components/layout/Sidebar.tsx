import React, { useState, useRef, useEffect } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";
import { ArborMark } from "../ui/ArborMark";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { requestOpenSettings } from "./settingsBus";
import { type NavBadge } from "../../lib/navigation";
import { COMPANION_PLACES, placeForTab } from "../../lib/companionPlaces";

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
  const { user, signOut, firebaseEnabled } = useAuth();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const activePlace = placeForTab(activeTab).id;
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

      <nav aria-label={t("elev.sidebar.nav.aria")} className="flex flex-col gap-2 flex-1">
        {COMPANION_PLACES.map(place => {
          const active = activePlace === place.id && activeTab !== "coach";
          return <button key={place.id} onClick={() => setActiveTab(place.tab)} aria-current={active ? "page" : undefined}
            className="flex items-start gap-3 rounded-2xl px-3 py-4 text-start min-h-11 transition-colors"
            style={{ background: active ? "var(--arbor-clay-dim)" : "transparent", color: active ? "var(--arbor-clay-deep)" : "var(--arbor-ink)" }}>
            <Icon name={place.icon} size={24} fill={active ? 1 : 0} />
            <span><span className="block text-[16px] font-bold">{he ? place.he : place.en}</span>
              <span className="block mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{he ? place.detailHe : place.detailEn}</span></span>
          </button>;
        })}
        <div className="mt-5 pt-5 space-y-1" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
          {([
            { tab: "masterclasses", icon: "school", en: "For you, the parent", he: "בשבילך, ההורה" },
            { tab: "consult", icon: "diversity_1", en: "Care, together", he: "יחד עם אנשי המקצוע" },
          ] as const).map(link => {
            const label = he ? link.he : link.en;
            return <button key={link.tab} onClick={() => setActiveTab(link.tab)} aria-current={activeTab === link.tab ? "page" : undefined}
            className="w-full min-h-11 flex items-center gap-3 px-3 py-3 rounded-xl text-start text-sm font-semibold"
            style={{ color: activeTab === link.tab ? "var(--arbor-clay-deep)" : "var(--arbor-muted)", background: activeTab === link.tab ? "var(--arbor-clay-dim)" : "transparent" }}>
            <Icon name={link.icon} size={21}/>{label}

          </button>; })}
        </div>
      </nav>

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
              // B-SHELL-23: ONE SettingsModal — Shell's, through the settings bus
              // (same seam and Kid Mode gate as the More sheet's Settings row).
              onClick={() => { setPopoverOpen(false); requestOpenSettings(); }}
              className="w-full flex items-center gap-3 px-2.5 py-2 min-h-11 rounded-xl text-[13px] font-semibold transition text-start"
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
                className="w-full flex items-center gap-3 px-2.5 py-2 min-h-11 rounded-xl text-[13px] font-semibold transition text-start"
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

    </aside>
  );
}
