import React from "react";
import {
  LayoutDashboard,
  Brain,
  Clock,
  CheckCircle2,
  Sliders,
  Mountain,
  BarChart2,
  Compass,
  Languages,
  FileText,
  Shield,
} from "lucide-react";
import { LogOut } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";
import { ArborMark } from "../ui/ArborMark";

export default function Sidebar() {
  const { activeTab, setActiveTab, milestonesPercent, actionPlans } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();

  const navItemClass = (tab: ActiveTab) =>
    `flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
      activeTab === tab
        ? "bg-white/5 text-[#f7f1e7] border-white/10"
        : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside className="hidden md:flex border-r border-white/10 bg-[#08090c]/90 backdrop-blur-2xl px-6 py-8 flex-col gap-8 h-auto xl:h-screen xl:sticky xl:top-0 overflow-y-auto">
      {/* Brand header */}
      <div className="flex items-center gap-3">
        <ArborMark size={46} />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Arbor</h1>
          <p className="text-[10px] uppercase tracking-widest text-[#a8a093] font-semibold mt-0.5">Development Fieldbook</p>
        </div>
      </div>

      {/* Child profile switcher */}
      <ProfileSwitcher />

      {/* Navigation Items */}
      <nav className="flex flex-col gap-1.5 flex-1">
        <button onClick={() => setActiveTab("overview")} className={navItemClass("overview")}>
          <span className="flex items-center gap-3">
            <LayoutDashboard className="w-4 h-4" /> Overview Dashboard
          </span>
          <span className="text-[10px] bg-[#d7aa55] text-black font-extrabold px-1.5 py-0.5 rounded-md">OS</span>
        </button>

        <button onClick={() => setActiveTab("coach")} className={navItemClass("coach")}>
          <span className="flex items-center gap-3">
            <Brain className="w-4 h-4" /> Parent Coach
          </span>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded-md">AI</span>
        </button>

        <button onClick={() => setActiveTab("behaviors")} className={navItemClass("behaviors")}>
          <span className="flex items-center gap-3">
            <Clock className="w-4 h-4" /> Behavior & Emotion Tracker
          </span>
        </button>

        <button onClick={() => setActiveTab("milestones")} className={navItemClass("milestones")}>
          <span className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4" /> Milestones Tracker
          </span>
          <span className="text-xs text-[#d7aa55] font-extrabold">{milestonesPercent}%</span>
        </button>

        <button onClick={() => setActiveTab("plans")} className={navItemClass("plans")}>
          <span className="flex items-center gap-3">
            <Sliders className="w-4 h-4" /> Action Plans
          </span>
          <span className="text-xs text-green-400 font-bold">{actionPlans.length} Active</span>
        </button>

        <button onClick={() => setActiveTab("stories")} className={navItemClass("stories")}>
          <span className="flex items-center gap-3">
            <Mountain className="w-4 h-4" /> Hero Journeys
          </span>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded-md">AI</span>
        </button>

        <button onClick={() => setActiveTab("weekly")} className={navItemClass("weekly")}>
          <span className="flex items-center gap-3">
            <BarChart2 className="w-4 h-4" /> Weekly Report
          </span>
        </button>

        <button onClick={() => setActiveTab("scholar")} className={navItemClass("scholar")}>
          <span className="flex items-center gap-3">
            <Compass className="w-4 h-4" /> Scholar Academy
          </span>
        </button>

        <button onClick={() => setActiveTab("language")} className={navItemClass("language")}>
          <span className="flex items-center gap-3">
            <Languages className="w-4 h-4" /> Language Lab
          </span>
        </button>

        <button onClick={() => setActiveTab("handoff")} className={navItemClass("handoff")}>
          <span className="flex items-center gap-3">
            <FileText className="w-4 h-4" /> School Handoff Hub
          </span>
        </button>

        <button onClick={() => setActiveTab("safety")} className={navItemClass("safety")}>
          <span className="flex items-center gap-3">
            <Shield className="w-4 h-4" /> Safety & Guardrails
          </span>
        </button>
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-white/5 space-y-3">
        {firebaseEnabled && user && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{user.displayName || "Signed in"}</p>
              {user.email && <p className="text-[10px] text-[#a8a093] truncate">{user.email}</p>}
            </div>
            <button
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="flex-shrink-0 p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-[#a8a093] hover:text-[#ffb59c] transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-[#a8a093] leading-relaxed">
          <span className="font-bold text-white mb-1 block">Arbor Architecture:</span>
          Expert-reviewed knowledge modules + parent-approved child memory.
        </p>
      </div>
    </aside>
  );
}
