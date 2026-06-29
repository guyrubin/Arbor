import type { LucideIcon } from "lucide-react";
import {
  Home, Sparkles, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, Activity, Languages,
  Users, FileBarChart, Calendar,
  Share2, BookOpen, Heart, Sliders, Waypoints, ShieldAlert,
  Target, Map, Gauge, School, Moon,
  MessageCircle, NotebookPen, UserCircle,
} from "lucide-react";
import type { ActiveTab } from "../context/ArborContext";

export type NavItem = { tab: ActiveTab; label: string; icon: LucideIcon };
/** Generalized sidebar badge: the two legacy app-state badges
 *  ("milestone" | "plans") OR a free-form { kind: "count" } slot that any
 *  category can carry (e.g. Ask Arbor unread coach count), fed from app state in
 *  the Sidebar (never hardcoded). */
export type NavBadge = "milestone" | "plans" | { kind: "count" } | { kind: "dot" };
export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** optional sidebar badge fed from app state */
  badge?: NavBadge;
  items: NavItem[];
};

/**
 * UC-1: the EIGHT-category Arbor information architecture — aligned to the
 * "Arbor Web App" prototype (claude.ai/design 6ddac523): TODAY · BEHAVIORS ·
 * GROWTH · JOURNAL · ACADEMY · ASK ARBOR · CARE NETWORK · PROFILE.
 *
 * The eight categories are the PRIMARY rail. Each category's secondary tools
 * live under `items[]` (the Overview-first sub-tab pill row, via
 * subTabsForSection). EVERY one of the 45 ActiveTab routes still has a home —
 * either as a surfaced item under a category, or via TAB_SECTION_FALLBACK — so
 * nothing is orphaned (the navigation guard test enforces this).
 *
 * IA reconciliation note (deck's 6 vs mock's 8): the deck commits to six parent
 * categories; the web-app mock promotes Behaviors and Journal to primary. We
 * follow the mock's 8 (the shipped surface) while keeping the deck's spine: the
 * 7-domain Development Map threads through Growth, and Behaviors/Journal feed it.
 *
 * Ask Arbor (coach) is now a FIRST-CLASS category row (was a top-bar action +
 * Today card); the AskArborButton topbar entry still works — both routes are
 * valid. Its sidebar badge carries the unread-coach count.
 */
export const SECTIONS: NavSection[] = [
  {
    id: "today",
    label: "Today",
    icon: Home,
    items: [
      { tab: "overview", label: "Overview", icon: LayoutDashboard },
      { tab: "day-windows", label: "Day Windows", icon: Map },
      { tab: "smart-reminders", label: "Smart Reminders", icon: Calendar },
    ],
  },
  {
    id: "behaviors",
    label: "Behaviors",
    icon: Activity,
    items: [
      { tab: "behaviors", label: "Behaviors", icon: Activity },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: Sprout,
    badge: "milestone",
    items: [
      { tab: "development", label: "Development", icon: Gauge },
      { tab: "milestones", label: "Milestones", icon: Sprout },
      { tab: "language", label: "Language & Communication", icon: Languages },
      { tab: "daily-play", label: "Daily Play", icon: Map },
      { tab: "practice", label: "Practice", icon: Target },
      { tab: "plans", label: "Growth Plans", icon: Sliders },
    ],
  },
  {
    id: "journal",
    label: "Journal",
    icon: NotebookPen,
    items: [
      { tab: "journal", label: "Journal", icon: NotebookPen },
      { tab: "timeline", label: "Story", icon: Waypoints },
    ],
  },
  {
    id: "academy",
    label: "Academy",
    icon: GraduationCap,
    items: [
      // Story Journeys render AS personalized comics starring the child's hero.
      // Hero Comics is the batch studio (the viral surface).
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "bedtime-stories", label: "Bedtime Story", icon: Moon },
      { tab: "comics", label: "Hero Comics", icon: Sparkles },
      { tab: "family", label: "Family Formation", icon: Heart },
    ],
  },
  {
    id: "ask",
    label: "Ask Arbor",
    icon: MessageCircle,
    badge: { kind: "count" },
    items: [
      { tab: "coach", label: "Ask Arbor", icon: MessageCircle },
    ],
  },
  {
    id: "care",
    label: "Care Network",
    icon: HeartHandshake,
    items: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "school-brief", label: "School Brief", icon: School },
      { tab: "care-team", label: "My Care Team", icon: Users },
      { tab: "sharing", label: "Trusted Sharing", icon: Share2 },
      { tab: "appointments", label: "Appointments", icon: Calendar },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserCircle,
    items: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
      { tab: "memory", label: "Child Memory", icon: Waypoints },
    ],
  },
];

/**
 * Map any leaf tab to its owning section — including tabs that are NOT surfaced
 * as primary items, so the sidebar still highlights the right category when one
 * of those views opens by deep link or programmatic navigation. The guard test
 * (navigation.test.ts) asserts sectionForTab() resolves for EVERY ActiveTab.
 */
const TAB_SECTION_FALLBACK: Record<string, string> = {
  // Growth — the development hub absorbs copilot/journey/screening; strengths is
  // folded into the Development Profile but resolves to Growth's map spine.
  copilot: "growth",
  journey: "growth",
  screening: "growth",
  strengths: "growth",
  // Practice drills reached via the Practice hub (under Growth).
  speech: "growth",
  mimic: "growth",
  feelings: "growth",
  adventures: "growth",

  // Profile — the development profile is the Profile category; weekly snapshot
  // surfaces from the Story/Journal spine but resolves to Profile.
  weekly: "profile",

  // Ask Arbor — coach is now a first-class section; scholar lens lives inside it.
  scholar: "ask",

  // Care — the former handoff/reports/find-pro doors live inside Consult; they
  // stay valid, deep-linkable routes mapped to Care so the sidebar highlights.
  reports: "care",
  handoff: "care",
  "find-pro": "care",
  // Internal/admin: attribution dashboard reached by deep link / admin Settings.
  attribution: "care",
  // The Science trust page — reached from Settings footer; nearest home = Care.
  science: "care",
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

/**
 * The Overview-first sub-tab pill row for a section: the section's primary
 * (hub/Overview) item first, followed by its remaining tools. Shell renders
 * this as the navy/white pill row pinned above the scroll region. Returns the
 * full items[] (primary is already items[0]); callers that want "Overview +
 * tools" simply render the list as-is.
 */
export function subTabsForSection(section: NavSection): NavItem[] {
  return section.items;
}
