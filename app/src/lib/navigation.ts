import type { LucideIcon } from "lucide-react";
import {
  Home, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, Activity, Languages,
  Users, FileBarChart, Calendar,
  Share2, BookOpen, Sliders, Waypoints, ShieldAlert,
  Target, Map, Gauge, School, Moon,
  MessageCircle, NotebookPen, UserCircle,
  Clock, ListChecks, BarChart3, Bell, BadgeCheck,
  Sparkles, Heart,
} from "lucide-react";
import type { ActiveTab } from "../context/ArborContext";

export type NavItem = {
  tab: ActiveTab;
  label: string;
  icon: LucideIcon;
  /** Optional Material Symbols Rounded ligature for the shared <Icon> component
   *  (UC-2 visual-match). Carried on a hub's `tools` items for the contextual
   *  pill row; lucide `icon` remains the fallback / pill-row glyph. */
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
   *  the hub/Overview item first + at most 1–2 truly primary leaves. The hub's
   *  secondary capabilities live in `tools` below (NOT a global drawer).
   *  subTabsForSection() returns THIS; hubTabsForSection() returns primary +
   *  primaryTabs + tools as the full contextual pill set. */
  primaryTabs: NavItem[];
  /** UC-6: the hub's OWN secondary capabilities — the tools that used to live in
   *  the (now-removed) global TOOLS drawer, folded into the hub they belong to.
   *  Rendered as contextual pills (after the primary sub-tabs) when you are in
   *  this hub, so tools feel integrated rather than a separate drawer. */
  tools: NavItem[];
};

/**
 * UC-3 (fluid IA): the EIGHT-category Arbor information architecture — aligned
 * to the "Arbor Web App" wireframe (claude.ai/design 6ddac523): TODAY ·
 * BEHAVIORS · GROWTH · JOURNAL · ACADEMY · ASK ARBOR · CARE NETWORK · PROFILE.
 *
 * Each category exposes a SHORT primary sub-tab set (its CATFEAT row) plus its
 * own `tools` (secondary capabilities). UC-6 REMOVED the global TOOLS drawer:
 * each hub's tools are now folded into that hub and rendered as contextual pills
 * (hubTabsForSection = primary + sub-tabs + tools), so the sidebar is the eight
 * hubs only and tools feel integrated rather than a separate drawer.
 *
 * NOTHING is dropped: the union of (category hubs) + (primaryTabs) + (per-hub
 * tools) + (TAB_SECTION_FALLBACK) covers EVERY one of the 45 ActiveTab routes —
 * the navigation guard test enforces this 45-route floor.
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
    // Today is a single-surface hub; its tools (Day Windows, Reminders) render as
    // contextual pills inside the hub (folded out of the old global drawer).
    primaryTabs: [
      { tab: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    tools: [
      { tab: "day-windows", label: "Day Windows", icon: Clock, msIcon: "schedule" },
      { tab: "smart-reminders", label: "Reminders", icon: Bell, msIcon: "notifications" },
    ],
  },
  {
    id: "behaviors",
    label: "Behaviors",
    icon: Activity,
    msIcon: "monitoring",
    items: [
      { tab: "behaviors", label: "Behaviors", icon: Activity },
      { tab: "plans", label: "Action Plans", icon: Sliders },
    ],
    primaryTabs: [
      { tab: "behaviors", label: "Behaviors", icon: Activity },
    ],
    // Action Plans moved here from Growth (clarity): every plan template is a
    // behavior challenge (morning departure, screen shutdown, sibling conflict),
    // so "turn a challenge into a step-by-step plan" is a Behaviors tool.
    tools: [
      { tab: "plans", label: "Action Plans", icon: Sliders, msIcon: "tune" },
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
    ],
    // Growth is now purely developmental: Development hub + the two clinical
    // spines (milestones, language), with Daily Play and the Development Check as
    // tools. Action Plans moved to Behaviors; the Practice arcade is the child's
    // world (Kid Mode) and is no longer a parent pill (still a valid route).
    primaryTabs: [
      { tab: "development", label: "Development", icon: Gauge },
      { tab: "milestones", label: "Milestones", icon: Sprout },
      { tab: "language", label: "Language & Communication", icon: Languages },
    ],
    tools: [
      // Wireframe: Ready-made Routines — the research-backed routine library
      // (morning, goodbye, meal, tidy, screens, bedtime…), each a step board.
      { tab: "routines", label: "Routines", icon: ListChecks, msIcon: "event_repeat" },
      { tab: "daily-play", label: "Daily Play", icon: Map, msIcon: "playing_cards" },
      // M4 surfacing (IA masterplan): the quick-check screener was fallback-only
      // (reachable via one ChildProfile JumpLink) — now a visible Growth pill.
      { tab: "screening", label: "Development Check", icon: ShieldAlert, msIcon: "fact_check" },
    ],
  },
  {
    id: "journal",
    label: "Journal",
    icon: NotebookPen,
    msIcon: "edit_note",
    // Journal and Story are two DENSITIES of one timeline surface (TimelineTab),
    // not two capabilities: they render the same ledger stream. The density
    // toggle lives IN the surface, so the hub exposes a single capability — a
    // pill row switching the same thing would re-create the duplication this
    // collapse removes. `timeline` is therefore no longer a separately-navigable
    // leaf; it stays a valid deep-link route that resolves back to this section
    // via TAB_SECTION_FALLBACK.
    items: [
      { tab: "journal", label: "Journal", icon: NotebookPen },
    ],
    primaryTabs: [
      { tab: "journal", label: "Journal", icon: NotebookPen },
    ],
    tools: [],
  },
  {
    id: "academy",
    label: "Academy",
    icon: GraduationCap,
    msIcon: "school",
    items: [
      // Story Journeys render AS personalized comics starring the child's hero.
      // UC-4: Hero Comics + Family Formation are IN-HUB tiles reached from the
      // Academy surfaces (not category items, not drawer entries) — they resolve
      // to Academy via TAB_SECTION_FALLBACK so the sidebar still highlights.
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "bedtime-stories", label: "Bedtime Story", icon: Moon },
    ],
    // Hub (Masterclasses) + Story Journeys. Bedtime Stories is the hub's
    // contextual tool (folded out of the drawer).
    primaryTabs: [
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
    ],
    tools: [
      { tab: "bedtime-stories", label: "Bedtime Stories", icon: Moon, msIcon: "auto_stories" },
      // M4 surfacing (IA masterplan): Hero Comics is THE viral surface and Family
      // Formation a real capability — both were in-hub tiles only; now one click.
      { tab: "comics", label: "Hero Comics", icon: Sparkles, msIcon: "auto_awesome" },
      { tab: "family", label: "Family Formation", icon: Heart, msIcon: "favorite" },
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
    tools: [],
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
    // Care Team, Trusted Sharing and Appointments are the hub's contextual tools
    // (folded out of the drawer).
    primaryTabs: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
    tools: [
      { tab: "school-brief", label: "School Brief", icon: School, msIcon: "school" },
      { tab: "care-team", label: "My Care Team", icon: Users, msIcon: "groups" },
      { tab: "sharing", label: "Trusted Sharing", icon: Share2, msIcon: "share" },
      { tab: "appointments", label: "Appointments", icon: Calendar, msIcon: "calendar_month" },
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
    // Hub only; Child Memory, The Science and the Weekly Report are the hub's
    // contextual tools (folded out of the drawer). weekly + science resolve to
    // Profile via TAB_SECTION_FALLBACK (they are not category `items`).
    primaryTabs: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
    ],
    tools: [
      { tab: "memory", label: "Child Memory", icon: Waypoints, msIcon: "neurology" },
      { tab: "science", label: "The Science", icon: BadgeCheck, msIcon: "verified" },
      { tab: "weekly", label: "Weekly Report", icon: BarChart3, msIcon: "bar_chart" },
    ],
  },
];

/**
 * Map any leaf tab to its owning section — including tabs that are NOT surfaced
 * as primary items, so the sidebar still highlights the right category when one
 * of those views opens by deep link or programmatic navigation. The guard test
 * (navigation.test.ts) asserts sectionForTab() resolves for EVERY ActiveTab.
 */
export const TAB_SECTION_FALLBACK: Record<string, string> = {
  // Growth — the development hub absorbs copilot/journey/screening; strengths is
  // folded into the Development Profile but resolves to Growth's map spine.
  copilot: "growth",
  journey: "growth",
  screening: "growth",
  strengths: "growth",
  // Practice arcade + drills are the child's world (Kid Mode); they stay valid
  // routes resolving to Growth for deep-link highlighting, but are no longer
  // parent pills.
  practice: "growth",
  // Wireframe: Ready-made Routines library — a Growth tool pill.
  routines: "growth",
  speech: "growth",
  mimic: "growth",
  feelings: "growth",
  adventures: "growth",

  // Journal — Story is the rich DENSITY of the one timeline surface, reached by
  // the in-surface density toggle (and deep links), not by its own pill.
  timeline: "journal",

  // Profile — the development profile is the Profile category; weekly snapshot
  // surfaces from the Story/Journal spine but resolves to Profile.
  weekly: "profile",

  // Ask Arbor — coach is now a first-class section; scholar lens lives inside it.
  scholar: "ask",

  // Academy — Hero Comics (batch studio) + Family Formation are IN-HUB tiles
  // reached from the Academy surfaces; they resolve to Academy for highlight.
  comics: "academy",
  family: "academy",

  // Care — the former handoff/reports/find-pro doors live inside Consult; they
  // stay valid, deep-linkable routes mapped to Care so the sidebar highlights.
  reports: "care",
  handoff: "care",
  "find-pro": "care",
  // Internal/admin: attribution dashboard reached by deep link / admin Settings.
  attribution: "care",
  // UC-4: The Science is a product trust/editorial page, not a care surface —
  // re-homed to Profile (Profile › The Science) so the TOOLS entry and the
  // sidebar highlight agree.
  science: "profile",
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
 * leaves (the wireframe's CATFEAT feel). The hub's secondary capabilities live
 * in `section.tools` (surfaced by hubTabsForSection), NOT a global drawer.
 */
export function subTabsForSection(section: NavSection): NavItem[] {
  return section.primaryTabs;
}

/**
 * UC-6: the hub's FULL contextual pill set — primary first, then its remaining
 * primary sub-tabs, then its own tools (the secondary capabilities that used to
 * live in the global TOOLS drawer, now folded into the owning hub). De-duped by
 * tab. Shell renders this row when length > 1, so a hub shows ALL its
 * capabilities as contextual pills and tools feel integrated, not a separate
 * drawer.
 *
 * Order: [primaryTabOf] + (primaryTabs minus primary) + tools.
 */
export function hubTabsForSection(section: NavSection): NavItem[] {
  const primary = section.primaryTabs[0];
  const ordered = [primary, ...section.primaryTabs.slice(1), ...section.tools];
  const seen = new Set<ActiveTab>();
  const out: NavItem[] = [];
  for (const it of ordered) {
    if (seen.has(it.tab)) continue;
    seen.add(it.tab);
    out.push(it);
  }
  return out;
}
