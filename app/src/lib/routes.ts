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
  "masterclasses", "family", "comics", "learn",
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

const ROUTE_ID_SET: ReadonlySet<string> = new Set<string>(ROUTE_IDS);

/**
 * HASH ALIASES — human-guessable names that are NOT route ids.
 *
 * The route ids above are canon and must never be renamed: they are persisted
 * in `arbor.activeTab` and baked into every deep link ever shared. But several
 * of them do not match what the product CALLS the surface — the Today hub's
 * route id is `overview`, the Growth hub's is `development`, the Ask Arbor hub's
 * is `coach`. A parent (or a plan doc, or an email CTA) who follows the visible
 * label and tries `#/today` used to hit a dead deep link: `tabFromHash()`
 * returned null and the app silently restored whatever tab was last stored, so
 * the link landed somewhere arbitrary.
 *
 * This map closes that gap WITHOUT inventing routes: aliases resolve to a real
 * ROUTE_ID inside the hash router only. Keys are the nav SECTION ids and the
 * slugified nav LABELS whose slug differs from the route id (compare
 * navigation.ts SECTIONS to ROUTE_IDS). Rules enforced by routes.test.ts:
 *   • every value is a real ROUTE_ID,
 *   • no alias key shadows a route id (a real route always wins),
 *   • keys are lowercase kebab-case.
 */
export const HASH_ALIASES: Readonly<Record<string, ActiveTab>> = {
  // Nav SECTION ids whose hub leaf carries a different route id.
  today: "overview",
  growth: "development",
  academy: "masterclasses",
  ask: "coach",
  care: "consult",
  // Slugified nav LABELS that differ from their route id.
  home: "overview",
  "ask-arbor": "coach",
  "care-network": "consult",
  "action-plans": "plans",
  "development-check": "screening",
  "development-profile": "profile",
  "parent-masterclasses": "masterclasses",
  "learn-library": "learn",
  "story-journeys": "stories",
  "bedtime-story": "bedtime-stories",
  "hero-comics": "comics",
  "family-formation": "family",
  "child-memory": "memory",
  "the-science": "science",
  "weekly-report": "weekly",
  "practice-studio": "practice",
  "trusted-sharing": "sharing",
  "my-care-team": "care-team",
  reminders: "smart-reminders",
};

/**
 * Resolve a raw hash fragment to a canonical route id, or null if it is not a
 * route at all (the caller then falls back exactly as it always did).
 *
 * Exact route-id matching is unchanged and case-SENSITIVE — an unknown hash
 * stays unknown. Only the alias lookup is case-insensitive, so `#/Today` and
 * `#/today` behave the same for a human-typed label.
 */
export function resolveRouteId(raw: string): ActiveTab | null {
  const key = raw.replace(/^#\/?/, "").replace(/\/+$/, "").trim();
  if (!key) return null;
  if (ROUTE_ID_SET.has(key)) return key as ActiveTab;
  return HASH_ALIASES[key.toLowerCase()] ?? null;
}
