import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Brain,
  Clock,
  CheckCircle2,
  BarChart2,
  Sliders,
  BookOpen,
  Compass,
  FileText,
  Shield,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";

type Item = { tab: ActiveTab; label: string; icon: React.ReactNode };

const PRIMARY: Item[] = [
  { tab: "overview", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
  { tab: "coach", label: "Coach", icon: <Brain className="w-5 h-5" /> },
  { tab: "behaviors", label: "Logs", icon: <Clock className="w-5 h-5" /> },
  { tab: "milestones", label: "Growth", icon: <CheckCircle2 className="w-5 h-5" /> },
];

const MORE: Item[] = [
  { tab: "weekly", label: "Weekly Report", icon: <BarChart2 className="w-5 h-5" /> },
  { tab: "plans", label: "Action Plans", icon: <Sliders className="w-5 h-5" /> },
  { tab: "stories", label: "Bedtime Stories", icon: <BookOpen className="w-5 h-5" /> },
  { tab: "scholar", label: "Scholar Academy", icon: <Compass className="w-5 h-5" /> },
  { tab: "handoff", label: "School Handoff", icon: <FileText className="w-5 h-5" /> },
  { tab: "safety", label: "Safety", icon: <Shield className="w-5 h-5" /> },
];

/** Bottom tab bar shown on mobile (< md). A "More" sheet exposes the remaining tabs. */
export default function MobileNav() {
  const { activeTab, setActiveTab } = useArbor();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => m.tab === activeTab);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#08090c]/95 backdrop-blur-xl border-t border-white/10 flex">
        {PRIMARY.map((item) => (
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
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More sections"
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${moreActive ? "text-[#f4d991]" : "text-[#a8a093]"}`}
        >
          <MoreHorizontal className="w-5 h-5" />
          More
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              className="w-full bg-[#0c0e14] border-t border-white/10 rounded-t-3xl p-4 pb-8"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-black uppercase tracking-widest text-[#a8a093]">More sections</span>
                <button onClick={() => setMoreOpen(false)} aria-label="Close" className="p-1.5 rounded-lg border border-white/5 text-[#a8a093] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MORE.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setMoreOpen(false);
                    }}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border text-[11px] font-bold transition ${
                      activeTab === item.tab ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
