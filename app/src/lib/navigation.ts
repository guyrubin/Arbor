import type { LucideIcon } from "lucide-react";
import {
  Home, Sparkles, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, Activity, Languages,
  Users, FileBarChart, Calendar,
  Share2, BookOpen, Heart, Sliders, Waypoints, ShieldAlert,
  Target, Map, Gauge, School, Moon,
  MessageCircle, NotebookPen, UserCircle,
  Clock, ListChecks, BarChart3, Bell, BadgeCheck, Crown,
} from "lucide-react";
import type { ActiveTab } from "../context/ArborContext";

export type NavItem = {
  tab: ActiveTab;
  label: string;
  icon: LucideIcon;
  /** Optional Material Symbols Rounded ligature for the shared <Icon> component
   *  (UC-2 visual-match). Used by the Sidebar TOOLS drawer; lucide `icon`
   *  remains the fallback / pill-row glyph. */
  msIcon?: string;
};
/** Generalized sidebar badge: the two legacy app-state badges
 *  ("milestone" | "plans") OR a free-form { kind: "count" } slot that any
 *  category can carry (e.g. Ask Arbor unread coach count), fed from app state in
 *  the Sidebar (never hardcoded). */
export type NavBadge = "milestone" | "plans" | { kind: "count" } | { kind: "dot" };
export type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Material Symbols Rounded ligature for the section rail glyph (UC-2
   *  visual-match). The shell rails (Sidebar / MobileNav) render this via the
   *  shared <Icon>; `icon` (lucide) is retained as a fallback / for any
   *  non-shell consumer. */
  msIcon: string;
  /** optional sidebar badge fed from app state */
  badge?: NavBadge;
  /** The FULL set of leaf capabilities that resolve to this category. Used by
   *  sectionForTab() for direct highlight resolution. NOT all of these appear
   *  in the sub-tab pill row — see `primaryTabs`. */
  items: NavItem[];
  /** UC-3: the CURATED, short sub-tab pill row (the wireframe's CATFEAT feel):
   *  the hub/Overview item first + at most 1–2 truly primary leaves. Secondary
   *  capabilities are demoted to the global TOOLS drawer. subTabsForSection()
   *  returns THIS (never the full `items`), keeping the pill row fluid. */
  primaryTabs: NavItem[];
};

/**
 * UC-3 (fluid IA): the EIGHT-category Arbor information architecture — aligned
 * to the "Arbor Web App" wireframe (claude.ai/design 6ddac523): TODAY ·
 * BEHAVIORS · GROWTH · JOURNAL · ACADEMY · ASK ARBOR · CARE NETWORK · PROFILE.
 *
 * The wireframe presents capabilities fluidly: each category exposes only a
 * SHORT sub-tab set (its CATFEAT row), and ALL secondary capabilities live in a
 * single global TOOLS drawer in the sidebar. UC-1/UC-2 over-stuffed every pill
 * row with the full `items[]`; UC-3 trims the pill row to `primaryTabs` and
 * moves the demoted leaves into the exported TOOLS list below.
 *
 * NOTHING is dropped: the union of (category hubs) + (primaryTabs) + (TOOLS) +
 * (TAB_SECTION_FALLBACK) covers EVERY one of the 45 ActiveTab routes — the
 * navigation guard test enforces this 45-route floor.
 */
export const SECTIONS: NavSection[] = [
  {
    id: "today",
    label: "Today",
    icon: Home,
    msIcon: "home",
    items: [
      { tab: "overview", label: "Overview", icon: LayoutDashboard },
      { tab: "day-windows", label: "Day Windows", icon: Map },
      { tab: "smart-reminders", label: "Smart Reminders", icon: Calendar },
    ],
    // Today is a single-surface hub; its tools (Day Windows, Reminders) live in
    // the TOOLS drawer — keeps the dashboard pill row clean (no row renders).
    primaryTabs: [
      { tab: "overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    id: "behaviors",
    label: "Behaviors",
    icon: Activity,
    msIcon: "monitoring",
    items: [
      { tab: "behaviors", label: "Behaviors", icon: Activity },
    ],
    primaryTabs: [
      { tab: "behaviors", label: "Behaviors", icon: Activity },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: Sprout,
    msIcon: "eco",
    badge: "milestone",
    items: [
      { tab: "development", label: "Development", icon: Gauge },
      { tab: "milestones", label: "Milestones", icon: Sprout },
      { tab: "language", label: "Language & Communication", icon: Languages },
      { tab: "daily-play", label: "Daily Play", icon: Map },
      { tab: "practice", label: "Practice", icon: Target },
      { tab: "plans", label: "Growth Plans", icon: Sliders },
    ],
    // Hub + the two clinical spines (milestones, language). Daily Play, Practice
    // and Growth Plans are demoted to TOOLS.
    primaryTabs: [
      { tab: "development", label: "Development", icon: Gauge },
      { tab: "milestones", label: "Milestones", icon: Sprout },
      { tab: "language", label: "Language & Communication", icon: Languages },
    ],
  },
  {
    id: "journal",
    label: "Journal",
    icon: NotebookPen,
    msIcon: "edit_note",
    items: [
      { tab: "journal", label: "Journal", icon: NotebookPen },
      { tab: "timeline", label: "Story", icon: Waypoints },
    ],
    primaryTabs: [
      { tab: "journal", label: "Journal", icon: NotebookPen },
      { tab: "timeline", label: "Story", icon: Waypoints },
    ],
  },
  {
    id: "academy",
    label: "Academy",
    icon: GraduationCap,
    msIcon: "school",
    items: [
      // Story Journeys render AS personalized comics starring the child's hero.
      // Hero Comics is the batch studio (the viral surface).
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "bedtime-stories", label: "Bedtime Story", icon: Moon },
      { tab: "comics", label: "Hero Comics", icon: Sparkles },
      { tab: "family", label: "Family Formation", icon: Heart },
    ],
    // Hub (Masterclasses) + Story Journeys. Bedtime Story, Hero Comics and
    // Family Formation are demoted to TOOLS / reached from their surfaces.
    primaryTabs: [
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
    ],
  },
  {
    id: "ask",
    label: "Ask Arbor",
    icon: MessageCircle,
    msIcon: "forum",
    badge: { kind: "count" },
    items: [
      { tab: "coach", label: "Ask Arbor", icon: MessageCircle },
    ],
    primaryTabs: [
      { tab: "coach", label: "Ask Arbor", icon: MessageCircle },
    ],
  },
  {
    id: "care",
    label: "Care Network",
    icon: HeartHandshake,
    msIcon: "diversity_1",
    items: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "school-brief", label: "School Brief", icon: School },
      { tab: "care-team", label: "My Care Team", icon: Users },
      { tab: "sharing", label: "Trusted Sharing", icon: Share2 },
      { tab: "appointments", label: "Appointments", icon: Calendar },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
    // Hub (Consult) + Safety (the load-bearing escalation surface). School Brief,
    // Care Team, Trusted Sharing and Appointments are demoted to TOOLS.
    primaryTabs: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserCircle,
    msIcon: "person",
    items: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
      { tab: "memory", label: "Child Memory", icon: Waypoints },
    ],
    // Hub only; Child Memory is demoted to TOOLS.
    primaryTabs: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
    ],
  },
];

/**
 * UC-3 global TOOLS drawer — the HOME for every secondary capability (the
 * wireframe's 9-item TOOLS section, rendered in the Sidebar below the eight
 * category rows, quieter than primary nav).
 *
 * This list is the reachability home for every leaf demoted from a category's
 * primaryTabs, PLUS the wireframe's tool entries. Wireframe label → our route:
 *   Log a Moment   → behaviors
 *   Day Windows    → day-windows
 *   Routines       → daily-play   (nearest existing route to "routines")
 *   Weekly Report  → weekly
 *   Behavior Logs  → behaviors
 *   Bedtime Stories→ bedtime-stories
 *   Reminders      → smart-reminders
 *   The Science    → science
 *   Arbor Plus     → profile      (billing/Plus entry — Settings › Arbor Plus)
 * Plus the remaining demoted leaves so NOTHING is orphaned: Practice, Growth
 * Plans, Hero Comics, Family Formation, School Brief, Care Team, Trusted
 * Sharing, Appointments, Child Memory.
 *
 * `msIcon` carries the wireframe's Material Symbols ligature for the <Icon>
 * component; `icon` (lucide) is the structural fallback.
 */
export const TOOLS: NavItem[] = [
  // ── Wireframe's nine ──
  { tab: "behaviors", label: "Log a Moment", icon: NotebookPen, msIcon: "edit_note" },
  { tab: "day-windows", label: "Day Windows", icon: Clock, msIcon: "schedule" },
  { tab: "daily-play", label: "Routines", icon: ListChecks, msIcon: "checklist" },
  { tab: "weekly", label: "Weekly Report", icon: BarChart3, msIcon: "bar_chart" },
  { tab: "behaviors", label: "Behavior Logs", icon: Activity, msIcon: "fact_check" },
  { tab: "bedtime-stories", label: "Bedtime Stories", icon: Moon, msIcon: "auto_stories" },
  { tab: "smart-reminders", label: "Reminders", icon: Bell, msIcon: "notifications" },
  { tab: "science", label: "The Science", icon: BadgeCheck, msIcon: "verified" },
  { tab: "profile", label: "Arbor Plus", icon: Crown, msIcon: "workspace_premium" },
  // ── Remaining demoted leaves (kept reachable; no wireframe slot) ──
  { tab: "practice", label: "Practice", icon: Target, msIcon: "target" },
  { tab: "plans", label: "Growth Plans", icon: Sliders, msIcon: "tune" },
  { tab: "comics", label: "Hero Comics", icon: Sparkles, msIcon: "auto_awesome" },
  { tab: "family", label: "Family Formation", icon: Heart, msIcon: "favorite" },
  { tab: "school-brief", label: "School Brief", icon: School, msIcon: "school" },
  { tab: "care-team", label: "My Care Team", icon: Users, msIcon: "groups" },
  { tab: "sharing", label: "Trusted Sharing", icon: Share2, msIcon: "share" },
  { tab: "appointments", label: "Appointments", icon: Calendar, msIcon: "calendar_month" },
  { tab: "memory", label: "Child Memory", icon: Waypoints, msIcon: "neurology" },
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
  // The Science trust page — reached from the TOOLS drawer; nearest home = Care.
  science: "care",
};

export function sectionForTab(tab: ActiveTab): NavSection {
  const direct = SECTIONS.find((s) => s.items.some((i) => i.tab === tab));
  if (direct) return direct;
  const fallbackId = TAB_SECTION_FALLBACK[tab];
  return SECTIONS.find((s) => s.id === fallbackId) ?? SECTIONS[0];
}

export function primaryTabOf(section: NavSection): ActiveTab {
  return section.primaryTabs[0].tab;
}

/**
 * UC-3: the CURATED Overview-first sub-tab pill row for a section — the section's
 * primary (hub/Overview) item first, followed by at most 1–2 truly primary
 * leaves (the wireframe's CATFEAT feel). Secondary capabilities live in the
 * global TOOLS drawer, NOT here. Shell renders this as the navy/white pill row;
 * a single-item result renders no row.
 */
export function subTabsForSection(section: NavSection): NavItem[] {
  return section.primaryTabs;
}
