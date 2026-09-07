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
  ask: "coach",
  care: "consult",
  // LEGACY section id: Academy split into Stories + Learn (Heartwood D2);
  // #/academy deep links baked into old docs/emails keep landing on the
  // Masterclasses hub. The new section ids (practice/stories/learn) are
  // themselves route ids, so they need no alias.
  academy: "masterclasses",
  // Slugified nav LABELS that differ from their route id.
  //
  // GP-19 renamed four of these labels ("Development Profile" → "My Child",
  // "Development Milestones" → "Milestones", "Development" → "Growth",
  // "Development Journey" → "Growth Journey"). Both slugs stay: the OLD ones
  // because they are in shared links, emails and plan docs already, and the NEW
  // ones because the invariant this map exists for is that the name a parent
  // reads on screen is a name they can type. Aliases are cheap; a dead deep
  // link is not.
  "my-child": "profile",
  "growth-journey": "journey",
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
/**
 * GP-26 / IA-09 — RETIRED ROUTES.
 *
 * `#/strengths` was a declared route whose whole content is Profile chapter 4
 * ("Strengths" + "Where to support"), and its ONLY entry point was a 16 px
 * link inside that same chapter — a door out of a room that led back into it.
 * The leaf also carried its own hard-coded English titles, so the duplicate
 * was drifting as well as redundant.
 *
 * A retired route is NOT deleted from ROUTE_IDS. The id is persisted in
 * `arbor.activeTab` and baked into every deep link ever shared, and the route
 * table is the type that drives Shell's registry, the module-budget floors and
 * the navigation guard — removing the id would rewrite all four for a leaf
 * nobody can reach. Instead the HASH stops resolving to it: the id keeps its
 * seat in the table, and `#/strengths` lands on the hub that owns the content.
 *
 * Checked BEFORE the exact-id match, which is the one place an alias may
 * outrank a route id — hence its own map rather than an entry in HASH_ALIASES
 * (whose invariant is that a real route always wins).
 */
export const RETIRED_ROUTES: Readonly<Record<string, ActiveTab>> = {
  strengths: "profile",
};

export function resolveRouteId(raw: string): ActiveTab | null {
  const key = raw.replace(/^#\/?/, "").replace(/\/+$/, "").trim();
  if (!key) return null;
  // A retired hash outranks its own (still-typed) route id — see above.
  const retired = RETIRED_ROUTES[key.toLowerCase()];
  if (retired) return retired;
  if (ROUTE_ID_SET.has(key)) return key as ActiveTab;
  return HASH_ALIASES[key.toLowerCase()] ?? null;
}

/**
 * IA-13 — what a hash that is not a route should DO.
 *
 * `resolveRouteId` answers "is this a route?", and every caller treated `null`
 * as "then keep whatever was on screen". So `#/nonexistent-route` rendered the
 * last stored `arbor.activeTab` — Reports, for the lane that found this — with
 * More highlighted in the sidebar and the wrong URL still in the address bar.
 * A stale nudge, an old share link or a typo'd deep link therefore landed a
 * parent on an unrelated screen with no sign that anything had gone wrong, and
 * the URL they would copy and send on was still the broken one.
 *
 * This separates the three cases the callers were collapsing into two:
 *
 *   empty hash   → `stored` (or Today). First load: nothing was asked for.
 *   known hash   → that route. Unchanged.
 *   unknown hash → Today, `unknown: true`. The caller rewrites the URL with
 *                  replaceState (so back still works) and says so once.
 *
 * A 404 screen is deliberately not the answer: the parent asked for something
 * that no longer exists, and the useful reply is the app's front door plus one
 * quiet sentence, not a dead end.
 */
export type HashResolution = { tab: ActiveTab; unknown: boolean };

export const FALLBACK_ROUTE: ActiveTab = "overview";

export function resolveHash(raw: string, stored?: string | null): HashResolution {
  const key = raw.replace(/^#\/?/, "").replace(/\/+$/, "").trim();
  if (!key) {
    // A parent whose last session ended on a retired leaf is returned to the
    // hub that absorbed it, not to a screen that no longer has a door.
    const retiredStore = stored ? RETIRED_ROUTES[stored.toLowerCase()] : undefined;
    const kept = retiredStore ?? (stored && ROUTE_ID_SET.has(stored) ? (stored as ActiveTab) : FALLBACK_ROUTE);
    return { tab: kept, unknown: false };
  }
  const resolved = resolveRouteId(key);
  if (resolved) return { tab: resolved, unknown: false };
  return { tab: FALLBACK_ROUTE, unknown: true };
}
