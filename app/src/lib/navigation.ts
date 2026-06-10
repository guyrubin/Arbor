import type { LucideIcon } from "lucide-react";
import {
  Home, Sparkles, Brain, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, UserCircle, CheckCircle2, Activity, Languages,
  BookMarked, Search, Users, FileBarChart, Calendar,
  Share2, BookOpen, Heart, Sliders, Waypoints, ShieldAlert, ClipboardCheck,
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
 * The six-section Arbor information architecture (IA v2 + Wave-1 consolidation).
 *
 * Wave 1 collapsed visible redundancy so the IA reads as deliberate, not
 * scattered: 22 nav leaves → 17. No capability was deleted — the routes below
 * are still valid tabs (deep-linkable, reachable programmatically), they are
 * just no longer surfaced as equal-weight primary items:
 *   - "strengths" folded into Development Profile.
 *   - "scholar" lives as the lens picker inside Ask Arbor.
 *   - "weekly" surfaces from the Story timeline.
 *   - "handoff" merged under "Reports & Handoffs".
 * Safety now has a real home under Care Network (was orphaned). "My Care Team"
 * was rebuilt from real share grants in Wave 2 and is a primary item again.
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
    label: "My Child",
    icon: Brain,
    badge: "milestone",
    items: [
      { tab: "timeline", label: "Story", icon: Waypoints },
      { tab: "profile", label: "Development Profile", icon: UserCircle },
      { tab: "milestones", label: "Development Milestones", icon: CheckCircle2 },
      { tab: "screening", label: "Development Check", icon: ClipboardCheck },
      { tab: "behaviors", label: "Moments", icon: Activity },
      { tab: "language", label: "Language & Communication", icon: Languages },
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
      { tab: "care-team", label: "My Care Team", icon: Users },
      { tab: "find-pro", label: "Find a Professional", icon: Search },
      { tab: "reports", label: "Reports & Handoffs", icon: FileBarChart },
      { tab: "sharing", label: "Trusted Sharing", icon: Share2 },
      { tab: "appointments", label: "Appointments", icon: Calendar },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
  },
  {
    id: "academy",
    label: "Arbor Academy",
    icon: GraduationCap,
    items: [
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "family", label: "Family Formation", icon: Heart },
    ],
  },
];

/**
 * Map any leaf tab to its owning section — including tabs that are no longer
 * surfaced as primary items (strengths→profile, scholar→ask, weekly→story,
 * handoff→reports, care-team→find-pro) so the sidebar still highlights the right
 * section when one of those views is opened by deep link or in-app navigation.
 */
const TAB_SECTION_FALLBACK: Record<string, string> = {
  strengths: "intelligence",
  weekly: "intelligence",
  scholar: "ask",
  handoff: "care",
};

export function sectionForTab(tab: ActiveTab): NavSection {
  const direct = SECTIONS.find((s) => s.items.some((i) => i.tab === tab));
  if (direct) return direct;
  const fallbackId = TAB_SECTION_FALLBACK[tab];
  return SECTIONS.find((s) => s.id === fallbackId) ?? SECTIONS[0];
}

export function primaryTabOf(section: NavSection): ActiveTab {
  return section.items[0].tab;
}
