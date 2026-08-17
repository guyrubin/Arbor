import type { LucideIcon } from "lucide-react";
import {
  Home, Sprout, HeartHandshake, GraduationCap,
  LayoutDashboard, Activity, Languages,
  FileBarChart, Calendar,
  Share2, BookOpen, Sliders, Waypoints, ShieldAlert,
  Target, Map, Gauge, School, Moon,
  MessageCircle, NotebookPen, UserCircle,
  Clock, ListChecks, BarChart3, Bell, BadgeCheck,
  Sparkles, Heart, Library,
  Mic, Camera, Smile, Footprints, Compass,
} from "lucide-react";
import type { ActiveTab } from "../context/ArborContext";
import type { HubId } from "./surfaceContract";

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
  /** One of the ten Heartwood hub ids (surfaceContract HUB_IDS) — typed so the
   *  sections, the surface contracts, and usePulses() can never drift apart
   *  (the pulse map is a Record<HubId, …> consumed by section id). */
  id: HubId;
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
 * Heartwood D2+D3 (fluid IA): the TEN-hub Arbor information architecture —
 * TODAY · JOURNAL · ASK ARBOR · BEHAVIORS · GROWTH · PRACTICE · STORIES ·
 * LEARN · CARE NETWORK · PROFILE.
 *
 * D2 split the former ACADEMY into two hubs along the register seam: STORIES
 * (child-starring content — Story Journeys, Bedtime Stories, Hero Comics) vs
 * LEARN (parent learning — Masterclasses, Learn Library, Family Formation).
 * D3 promoted PRACTICE from a Growth tools pill to its own depth-0 hub owning
 * the kid-facing drill suite (speech/mimic/feelings/journey/adventures);
 * Copilot stays in Growth per canon. The Weekly Report re-homed from Profile
 * to Today.
 *
 * Each category exposes a SHORT primary sub-tab set (its CATFEAT row) plus its
 * own `tools` (secondary capabilities). UC-6 REMOVED the global TOOLS drawer:
 * each hub's tools are now folded into that hub and rendered as contextual pills
 * (hubTabsForSection = primary + sub-tabs + tools), so the sidebar is the ten
 * hubs only and tools feel integrated rather than a separate drawer.
 *
 * NOTHING is dropped: the union of (category hubs) + (primaryTabs) + (per-hub
 * tools) + (TAB_SECTION_FALLBACK) covers EVERY one of the 43 ActiveTab routes —
 * the navigation guard test enforces this 43-route floor.
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
    // Today is a single-surface hub; its tools (Day Windows, Reminders, and —
    // Heartwood D3 — the Weekly Report, re-homed from Profile as the week's
    // rhythm readout) render as contextual pills inside the hub.
    primaryTabs: [
      { tab: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    tools: [
      { tab: "day-windows", label: "Day Windows", icon: Clock, msIcon: "schedule" },
      { tab: "smart-reminders", label: "Reminders", icon: Bell, msIcon: "notifications" },
      { tab: "weekly", label: "Weekly Report", icon: BarChart3, msIcon: "bar_chart" },
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
    // tools. Action Plans moved to Behaviors. Heartwood D3: the Practice Studio
    // pill promoted OUT of Growth into its own depth-0 Practice hub; Copilot
    // stays homed here per canon (fallback → growth).
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
    id: "practice",
    label: "Practice",
    icon: Target,
    msIcon: "extension",
    // Heartwood D3: Practice promoted from a Growth tools pill to a depth-0 hub.
    // #/practice hosts the parent-register Practice Studio LAUNCHER (the door
    // into the ten practice worlds); the kid-register Hero Arcade lives only
    // inside Kid Mode. The standalone drill routes (speech/mimic/feelings/
    // journey/adventures) are the hub's tools: listing them here renders them
    // as always-visible one-click pills in the hub's contextual pill row
    // (hubTabsForSection) IN ADDITION to the launcher's tiles — they were
    // already reachable as deep links pre-D3, but the pill row widens the
    // register seam (kid-register worlds one click from parent chrome).
    // OPEN DESIGN CALL (Guy): keep the pills, or empty `tools` so entry is
    // launcher-mediated only (routes stay valid via TAB_SECTION_FALLBACK).
    items: [
      { tab: "practice", label: "Practice Studio", icon: Target },
    ],
    primaryTabs: [
      { tab: "practice", label: "Practice Studio", icon: Target },
    ],
    tools: [
      { tab: "speech", label: "Speech Coach", icon: Mic, msIcon: "mic" },
      { tab: "mimic", label: "Mimic Studio", icon: Camera, msIcon: "photo_camera" },
      { tab: "feelings", label: "Feelings Lab", icon: Smile, msIcon: "mood" },
      { tab: "journey", label: "Development Journey", icon: Footprints, msIcon: "route" },
      { tab: "adventures", label: "Adventures", icon: Compass, msIcon: "explore" },
    ],
  },
  {
    id: "stories",
    label: "Stories",
    icon: BookOpen,
    msIcon: "auto_stories",
    // Heartwood D2 (Academy split, register seam): STORIES is the child-starring
    // half — Story Journeys render AS personalized comics starring the child's
    // hero; Bedtime Stories and Hero Comics are the hub's tools. The parent-
    // learning half lives in the LEARN hub.
    items: [
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
      { tab: "bedtime-stories", label: "Bedtime Story", icon: Moon },
    ],
    primaryTabs: [
      { tab: "stories", label: "Story Journeys", icon: BookOpen },
    ],
    tools: [
      { tab: "bedtime-stories", label: "Bedtime Stories", icon: Moon, msIcon: "bedtime" },
      // M4 surfacing (IA masterplan): Hero Comics is THE viral surface — an
      // in-hub tile AND a one-click pill; resolves here via fallback.
      { tab: "comics", label: "Hero Comics", icon: Sparkles, msIcon: "auto_awesome" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    icon: GraduationCap,
    msIcon: "school",
    // Heartwood D2 (Academy split, register seam): LEARN is the parent-learning
    // half — Masterclasses (hub) + Learn Library, with Family Formation as the
    // hub's tool. Child-starring content lives in the STORIES hub. NOTE: the
    // section id "learn" is ALSO a route id (the Learn Library leaf), so
    // #/learn deep-links land on the Library (routes are canon and always win
    // over aliases) while the sidebar hub button opens Masterclasses.
    items: [
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "learn", label: "Learn Library", icon: Library },
    ],
    primaryTabs: [
      { tab: "masterclasses", label: "Parent Masterclasses", icon: GraduationCap },
      { tab: "learn", label: "Learn Library", icon: Library },
    ],
    tools: [
      { tab: "family", label: "Family Formation", icon: Heart, msIcon: "favorite" },
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
      { tab: "sharing", label: "Trusted Sharing", icon: Share2 },
      { tab: "appointments", label: "Appointments", icon: Calendar },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
    // Hub (Consult) + Safety (the load-bearing escalation surface). School Brief,
    // Trusted Sharing and Appointments are the hub's contextual tools (folded out
    // of the drawer). W4.4: My Care Team merged into Trusted Sharing — one
    // roster surface over the same share grants.
    primaryTabs: [
      { tab: "consult", label: "Consult", icon: FileBarChart },
      { tab: "safety", label: "Safety & Escalation", icon: ShieldAlert },
    ],
    tools: [
      { tab: "school-brief", label: "School Brief", icon: School, msIcon: "school" },
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
    // Hub only; Child Memory and The Science are the hub's contextual tools.
    // science resolves to Profile via TAB_SECTION_FALLBACK (it is not a
    // category `item`). Heartwood D3: the Weekly Report re-homed to Today.
    primaryTabs: [
      { tab: "profile", label: "Development Profile", icon: UserCircle },
    ],
    tools: [
      { tab: "memory", label: "Child Memory", icon: Waypoints, msIcon: "neurology" },
      { tab: "science", label: "The Science", icon: BadgeCheck, msIcon: "verified" },
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
  // Growth — the development hub absorbs copilot/screening; strengths is
  // folded into the Development Profile but resolves to Growth's map spine.
  // Copilot stays homed in Growth per canon (NOT the Practice hub).
  copilot: "growth",
  screening: "growth",
  strengths: "growth",
  // Wireframe: Ready-made Routines library — a Growth tool pill.
  routines: "growth",

  // Practice (Heartwood D3) — the standalone drill routes are the Practice
  // hub's tools; they stay valid deep links resolving here for highlighting,
  // reached through the launcher's tiles.
  journey: "practice",
  speech: "practice",
  mimic: "practice",
  feelings: "practice",
  adventures: "practice",

  // Journal — Story is the rich DENSITY of the one timeline surface, reached by
  // the in-surface density toggle (and deep links), not by its own pill.
  timeline: "journal",

  // Today — the Weekly Report is the week's rhythm readout, re-homed from
  // Profile to the Today hub (Heartwood D3).
  weekly: "today",

  // Ask Arbor — coach is now a first-class section; scholar lens lives inside it.
  scholar: "ask",

  // Stories / Learn (Heartwood D2 Academy split) — Hero Comics is a Stories
  // tool (child-starring register); Family Formation a Learn tool (parent
  // register). Both stay valid deep-link routes mapped for highlight.
  comics: "stories",
  family: "learn",

  // Care — the former handoff/reports/find-pro doors live inside Consult; they
  // stay valid, deep-linkable routes mapped to Care so the sidebar highlights.
  reports: "care",
  handoff: "care",
  "find-pro": "care",
  // W4.4: My Care Team merged into Trusted Sharing — #/care-team stays a valid
  // deep-link route resolving to Care (Shell hosts it on TrustedSharing).
  "care-team": "care",
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
