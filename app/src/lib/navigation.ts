import type { LucideIcon } from "lucide-react";
import {
  Home, Sparkles, Brain, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, UserCircle, CheckCircle2, Activity, Languages, Gem,
  BarChart2, BookMarked, Search, Users, FileText, FileBarChart, Calendar,
  Share2, BookOpen, Compass, Heart, Sliders,
} from "lucide-react";
import type { ActiveTab } from "../context/ArborContext";

export type NavItem = { tab: ActiveTab; label: string; icon: LucideIcon };
export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** optional sidebar badge fed from app state */
  badge?: "milestone" | "plans";
  items: NavItem[];
};

/**
 * The six-section Arbor information architecture. Every existing capability is
 * preserved and mapped into a section; nothing is deleted. Safety & Guardrails
 * is intentionally absent as a primary item — it is embedded as the Trust &
 * Safety layer across guidance, reports, sharing and handoffs.
 */
export const SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    items: [{ tab: "overview", label: "Home", icon: LayoutDashboard }],
  },
  {
    id: "ask",
    label: "Ask Arbor",
    icon: Sparkles,
    items: [{ tab: "coach", label: "Ask Arbor", icon: Sparkles }],
  },
  {
    id: "intelligence",
    label: "Child Intelligence",
    icon: Brain,
    badge: "milestone",
    items: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
      { tab: "milestones", label: "Development Milestones", icon: CheckCircle2 },
      { tab: "behaviors", label: "Behavior Patterns", icon: Activity },
      { tab: "language", label: "Language & Communication", icon: Languages },
      { tab: "strengths", label: "Strengths & Challenges", icon: Gem },
      { tab: "weekly", label: "Weekly Insight", icon: BarChart2 },
      { tab: "memory", label: "Child Memory", icon: BookMarked },
    ],
  },
  {
    id: "growth",
    label: "Growth Plans",
    icon: Sprout,
    badge: "plans",
    items: [{ tab: "plans", label: "Active Growth Plans", icon: Sliders }],
  },
  {
    id: "care",
    label: "Care Network",
    icon: HeartHandshake,
    items: [
      { tab: "find-pro", label: "Find a Professional", icon: Search },
      { tab: "care-team", label: "My Care Team", icon: Users },
      { tab: "handoff", label: "School & Care Handoff", icon: FileText },
      { tab: "reports", label: "Reports", icon: FileBarChart },
      { tab: "appointments", label: "Appointments", icon: Calendar },
      { tab: "sharing", label: "Trusted Sharing", icon: Share2 },
    ],
  },
  {
    id: "academy",
    label: "Arbor Academy",
    icon: GraduationCap,
    items: [
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "scholar", label: "Scholar Frameworks", icon: Compass },
      { tab: "family", label: "Family Formation", icon: Heart },
    ],
  },
];

/** Map any leaf tab (including "safety") to its owning section. */
export function sectionForTab(tab: ActiveTab): NavSection {
  return SECTIONS.find((s) => s.items.some((i) => i.tab === tab)) ?? SECTIONS[0];
}

export function primaryTabOf(section: NavSection): ActiveTab {
  return section.items[0].tab;
}
