import React from "react";
import {
  LayoutDashboard,
  Brain,
  Clock,
  CheckCircle2,
  Sliders,
  BookOpen,
  BarChart2,
  Compass,
  FileText,
  Shield,
} from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import ProfileSwitcher from "../profile/ProfileSwitcher";

export default function Sidebar() {
  const { activeTab, setActiveTab, milestonesPercent, actionPlans } = useArbor();

  const navItemClass = (tab: ActiveTab) =>
    `flex items-center justify-between px-4 py-3 rounded-xl text-left border text-sm transition ${
      activeTab === tab
        ? "bg-white/5 text-[#f7f1e7] border-white/10"
        : "text-[#a8a093] border-transparent hover:bg-white/5 hover:text-white"
    }`;

  return (
    <aside className="border-r border-white/10 bg-[#08090c]/90 backdrop-blur-2xl px-6 py-8 flex flex-col gap-8 h-auto xl:h-screen xl:sticky xl:top-0 overflow-y-auto">
      {/* Brand header */}
      <div className="flex items-center gap-3">
        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="arb-teal" x1="54" y1="6" x2="28" y2="84" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#18F0D2" />
              <stop offset="50%" stopColor="#38C8F0" />
              <stop offset="100%" stopColor="#68B4FF" />
            </linearGradient>
            <linearGradient id="arb-purple" x1="12" y1="90" x2="46" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CCA8FF" />
              <stop offset="100%" stopColor="#A07AF8" />
            </linearGradient>
            <radialGradient id="arb-orange" cx="36%" cy="28%" r="62%">
              <stop offset="0%" stopColor="#FFC07A" />
              <stop offset="100%" stopColor="#FF5822" />
            </radialGradient>
          </defs>
          <path d="M40 88 C40 50 52 22 65 16 C78 22 90 50 90 88 L76 88 C76 56 70 32 65 32 C60 32 54 56 54 88Z" fill="#1B2898" />
          <path d="M14 88 C12 72 16 54 28 42 C34 36 42 34 46 40 C44 52 40 66 38 76 C36 82 28 88 20 88Z" fill="url(#arb-purple)" />
          <path d="M52 6 C62 14 66 32 62 50 C60 62 54 74 44 80 C36 84 28 80 22 72 C18 64 18 50 22 38 C28 24 38 8 52 6Z" fill="url(#arb-teal)" />
          <circle cx="78" cy="15" r="12" fill="url(#arb-orange)" />
        </svg>
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
            <BookOpen className="w-4 h-4" /> AI Bedtime Stories
          </span>
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
      <div className="mt-auto pt-6 border-t border-white/5 text-[11px] text-[#a8a093] leading-relaxed">
        <span className="font-bold text-white mb-1 block">Arbor Architecture:</span>
        Expert-reviewed knowledge modules + parent-approved child memory.
      </div>
    </aside>
  );
}
