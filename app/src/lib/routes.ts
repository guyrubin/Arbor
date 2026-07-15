/**
 * SINGLE SOURCE OF TRUTH for the app's route/tab set.
 *
 * Historically the route list was hand-maintained in THREE parallel places —
 * the `ActiveTab` union type, the `VALID_TABS` runtime set (both in
 * ArborContext), and Shell's `tabRegistry` — so adding or moving a route meant
 * editing three files or a route silently orphaned. That drift is the mechanical
 * reason edits here "break something over there."
 *
 * Now everything derives from this one array:
 *   • `ActiveTab`            = typeof ROUTE_IDS[number]        (the type)
 *   • `VALID_TABS`           = new Set(ROUTE_IDS)              (hash-router guard)
 *   • Shell `tabRegistry`    is Record<ActiveTab, Component>  → TypeScript now
 *     forces the registry to provide exactly one component per route id.
 *
 * Add a route: add its id here. TS will then require a component in the registry
 * and the nav guard test will require it to resolve to a section. Remove a route:
 * delete it here and the compiler points at every stale reference.
 *
 * Ordering is grouped for readability only; it carries no behavior.
 */
export const ROUTE_IDS = [
  // Core surfaces
  "overview", "coach", "behaviors", "milestones", "plans", "stories", "weekly",
  "scholar", "language", "handoff", "safety",
  // Child intelligence / IA-refactor capability views
  "profile", "memory", "strengths", "screening", "timeline", "journal",
  // Care Network
  "find-pro", "care-team", "appointments", "sharing", "reports",
  // Academy
  "masterclasses", "family", "comics",
  // Practice Studio (kid-facing suite)
  "speech", "mimic", "feelings", "journey", "adventures", "copilot",
  // IA consolidation hubs
  "development", "daily-play", "practice", "consult",
  // Internal / admin (deep-link + admin-gated Settings only)
  "attribution",
  // Standalone parent surfaces
  "day-windows", "smart-reminders", "science", "school-brief", "bedtime-stories",
  "routines",
] as const;

/** The canonical leaf-view identifier. Every hash route is `#/<ActiveTab>`. */
export type ActiveTab = (typeof ROUTE_IDS)[number];
