import React, { useState } from "react";
import { Settings, LogOut } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";
import { ArborMark } from "../ui/ArborMark";
import SettingsModal from "./SettingsModal";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";

export default function Sidebar() {
  const { activeTab, setActiveTab, milestonesPercent, actionPlans } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const activeSectionId = sectionForTab(activeTab).id;
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className="hidden md:flex flex-col gap-6 px-5 py-7 h-auto xl:h-screen xl:sticky xl:top-0 overflow-y-auto bg-white" style={{ borderRight: "1px solid var(--arbor-rule)" }}>
      {/* Brand lockup */}
      <div className="flex items-center gap-3 px-1">
        <ArborMark size={42} />
        <div>
          <h1 className="text-xl font-extrabold leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold mt-1" style={{ color: "var(--arbor-muted)" }}>Development Fieldbook</p>
        </div>
      </div>

      {/* Child profile card */}
      <ProfileSwitcher />

      {/* Six primary sections */}
      <nav className="flex flex-col gap-1 flex-1">
        {SECTIONS.map((sec) => {
          const active = sec.id === activeSectionId;
          const Icon = sec.icon;
          const badge =
            sec.badge === "milestone" ? `${milestonesPercent}%`
            : sec.badge === "plans" ? (actionPlans.length ? String(actionPlans.length) : "")
            : "";
          return (
            <button
              key={sec.id}
              onClick={() => setActiveTab(primaryTabOf(sec))}
              aria-current={active ? "page" : undefined}
              className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl text-left text-sm transition"
              style={active
                ? { background: "#e4f4ec", color: "#1f8a5a", fontWeight: 800 }
                : { color: "var(--arbor-muted)", fontWeight: 600 }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--arbor-paper-deep)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-[18px] h-[18px]" /> {sec.label}
              </span>
              {badge && (
                <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={active ? { background: "#34b277", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account / settings */}
      <div className="mt-auto pt-4 space-y-1" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
        <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition" style={{ color: "var(--arbor-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <Settings className="w-[18px] h-[18px]" /> Settings
        </button>
        {firebaseEnabled && user && (
          <div className="flex items-center justify-between gap-2 px-3.5 pt-2">
            <div className="min-w-0">
              <p className="text-[12px] font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || "Signed in"}</p>
              {user.email && <p className="text-[10px] truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
            </div>
            <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="flex-shrink-0 p-1.5 rounded-lg transition" style={{ color: "var(--arbor-muted)" }}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </aside>
  );
}
