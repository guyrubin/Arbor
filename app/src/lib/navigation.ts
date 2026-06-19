import type { LucideIcon } from "lucide-react";
import {
  Home, Sparkles, Brain, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, Activity, Languages,
  Users, FileBarChart, Calendar,
  Share2, BookOpen, Heart, Sliders, Waypoints, ShieldAlert,
  Target, Map, Gauge,
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
    id: "today",
    label: "Today",
    icon: Home,
    items: [{ tab: "overview", label: "Today", icon: LayoutDashboard }],
  },
  {
    id: "ask",
    label: "Ask Arbor",
    icon: Sparkles,
    items: [{ tab: "coach", label: "Ask Arbor", icon: Sparkles }],
  },
  {
    id: "child",
    label: "My Child",
    icon: Brain,
    badge: "milestone",
    items: [
      { tab: "timeline", label: "Story", icon: Waypoints },
      { tab: "development", label: "Development", icon: Gauge },
      { tab: "behaviors", label: "Moments", icon: Activity },
      { tab: "language", label: "Language & Communication", icon: Languages },
    ],
  },
  {
    id: "grow",
    label: "Grow",
    icon: Sprout,
    badge: "plans",
    items: [
      { tab: "daily-play", label: "Daily Play", icon: Map },
      { tab: "practice", label: "Practice", icon: Target },
      { tab: "plans", label: "Growth Plans", icon: Sliders },
    ],
  },
  {
    id: "care",
    label: "Care Network",
    icon: HeartHandshake,
    items: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "care-team", label: "My Care Team", icon: Users },
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
      // Story Journeys now render AS personalized comics starring the child's hero
      // (the comic capability is embedded in the stories, not a separate subtab).
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
  // My Child — leaves now reached via the Development hub or Story spine.
  copilot: "child",
  profile: "child",
  milestones: "child",
  strengths: "child",
  journey: "child",
  // b2: screening + memory are now INLINE BEHAVIORS (Quick-check sheet + Story
  // memory-review card), no longer visible leaves — but they remain valid,
  // deep-linkable full-page routes. DO NOT prune these fallbacks (e.g. in b5).
  screening: "child",
  memory: "child",
  weekly: "child",
  // Ask — scholar lens lives inside the coach.
  scholar: "ask",
  // Grow — drills reached via the Practice hub. (ia-b1: missions fully folded
  // into the Today daily loop and retired as a route — no fallback needed.)
  speech: "grow",
  mimic: "grow",
  feelings: "grow",
  adventures: "grow",
  // Care — the former handoff doors now live inside Consult. The standalone
  // `handoff` door is retired (b3): #/handoff now resolves to the Consult flow
  // (Shell remaps it to ConsultTab) and is no longer a primary nav item, but the
  // route stays valid and deep-linkable — keep its fallback so the sidebar still
  // highlights Care when it is opened. `reports`/`find-pro` likewise stay routable.
  reports: "care",
  handoff: "care",
  "find-pro": "care",
  // Internal/admin (P0-5): the attribution dashboard is reached by deep link or
  // the admin-gated Settings entry, never the parent sidebar. Map it to a section
  // only so highlighting resolves cleanly when it is open.
  attribution: "care",
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
