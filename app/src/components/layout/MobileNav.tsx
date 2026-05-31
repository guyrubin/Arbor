import React from "react";
import { LayoutDashboard, Brain, Clock, CheckCircle2, BarChart2 } from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";

const ITEMS: { tab: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { tab: "overview", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
  { tab: "coach", label: "Coach", icon: <Brain className="w-5 h-5" /> },
  { tab: "behaviors", label: "Logs", icon: <Clock className="w-5 h-5" /> },
  { tab: "milestones", label: "Growth", icon: <CheckCircle2 className="w-5 h-5" /> },
  { tab: "weekly", label: "Report", icon: <BarChart2 className="w-5 h-5" /> },
];

/** Bottom tab bar shown on mobile (< md). */
export default function MobileNav() {
  const { activeTab, setActiveTab } = useArbor();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#08090c]/95 backdrop-blur-xl border-t border-white/10 flex">
      {ITEMS.map((item) => (
        <button
          key={item.tab}
          onClick={() => setActiveTab(item.tab)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${
            activeTab === item.tab ? "text-[#f4d991]" : "text-[#a8a093]"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
