/**
 * W2.4 (masterplan 2026-08-11): Static content-catalog search index —
 * "search that works": index ALL content libraries, forgiving HE+EN matching.
 *
 * AC-6 SAFETY CONTRACT — this module imports ONLY approved STATIC catalogs:
 *   - app/src/playbank/content.ts         (activity names + domain)
 *   - app/src/lib/milestoneData.ts        (milestone names + domain)
 *   - app/src/lib/heroJourneys.ts         (journey titles)
 *   - app/src/practice/worlds.ts          (practice-world names)
 *   - app/src/learn/learnCards.ts         (Learn Library card catalog)
 *   - app/src/learn/learnLibrary.ts       (shelf labels only)
 *   - app/src/lib/masterclasses.ts        (masterclass catalog)
 *   - app/src/lib/routines.ts             (ready-made routine catalog)
 *   - app/src/initialData.ts              (scholarsInfo static roster only)
 *   - app/src/content/selectCards.ts (contextual reviewed/editorial-pilot gate;
 *     only explicitly released cards index)
 *   - app/src/lib/navigation.ts + i18n.ts (route/tab entries + their labels)
 *   - app/src/lib/routes.ts               (ROUTE_IDS — the canonical route-id
 *     list the router itself uses; ids only, no child record anywhere near it.
 *     Added for IA-20: deriving coverage from the router is what stops a route
 *     becoming unfindable because nobody remembered a hand-kept list.)
 *
 * It NEVER imports: memory/, families/, behaviors data, childData,
 * ChildMemory, observation logs, ProfileContext, or any child-record field.
 * The index is STATIC CONTENT METADATA only. Results are deep-links, not
 * data reads. No AI inference on the query — normalized string match only.
 *
 * arbor-sec WILL grep this file's imports. Do NOT add imports here.
 *
 * LAZY CONTRACT (perf budget, masterplan 4.6): the static index is built ONCE, on
 * first use (module memo in getSearchIndex()) — and this MODULE itself must
 * only ever be loaded via dynamic import() from the search surfaces
 * (SearchModal / TopbarSearch on open), so the catalogs above never join the
 * initial Today parse. Do NOT static-import this module from eager code;
 * `import type` is fine (erased at build).
 */

import { ROUTE_IDS } from "./routes";
import { PLAY_ACTIVITIES } from "../playbank/content";
import { ALL_MILESTONES } from "./milestoneData";
import { HERO_STORIES } from "./heroJourneys";
import { WORLDS } from "../practice/worlds";
import { LEARN_CARDS } from "../learn/learnCards";
import { LEARN_CATEGORIES } from "../learn/learnLibrary";
import { MASTERCLASSES, FRAME_LABELS } from "./masterclasses";
import { ROUTINES } from "./routines";
import { scholarsInfo } from "../initialData";
import { availableHardMomentCards } from "../content/selectCards";
import type { HardMomentContext } from "../content/pilotRelease";
import { SECTIONS } from "./navigation";
import { translate } from "./i18n";
import type { ActiveTab } from "../context/ArborContext";

/** Result-entry kind — drives the badge label (elev.searchnav.kind.*) + color. */
export type SearchKind =
  | "route"
  | "learn"
  | "masterclass"
  | "routine"
  | "scholar"
  | "hard-moment"
  | "activity"
  | "milestone"
  | "journey"
  | "world";

/** Bilingual display pair. `he` falls back to `en` for EN-only catalogs. */
export interface LocalizedPair {
  en: string;
  he: string;
}

/** A single search entry — content metadata + deep-link target only. */
export interface SearchEntry {
  /** Unique, kind-prefixed id (React key + coverage-test pin). */
  id: string;
  kind: SearchKind;
  title: LocalizedPair;
  /** Sub-label shown under the title (domain/shelf/pack — descriptive only). */
  sub: LocalizedPair;
  /** Extra matchable terms per language (hooks, theories, shelf names). */
  keywords: { en: string[]; he: string[] };
  /** Deep-link: the existing tab to navigate to on selection (tab-only —
   *  the app has no focus-param convention; see lib/routes.ts). */
  tab: ActiveTab;
  /** Precomputed normalized haystacks (both languages, always searched). */
  normTitles: string[];
  normKeywords: string[];
}

/* ── Forgiving normalization ─────────────────────────────────────────────── */

const HE_FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/**
 * Case-insensitive, diacritic-insensitive (Latin combining marks + Hebrew
 * niqqud/cantillation), Hebrew final-letter–insensitive (ך=כ ם=מ ן=נ ף=פ ץ=צ).
 * Applied identically to index text and query, so matching is symmetric.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin combining diacritics
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud + cantillation
    .replace(/[ךםןףץ]/g, (c) => HE_FINALS[c])
    .trim();
}

/* ── Index construction (lazy, memoized) ─────────────────────────────────── */

function pair(en: string, he?: string): LocalizedPair {
  return { en, he: he && he.trim() ? he : en };
}

function entry(
  id: string,
  kind: SearchKind,
  title: LocalizedPair,
  sub: LocalizedPair,
  keywords: { en: string[]; he: string[] },
  tab: ActiveTab,
): SearchEntry {
  const normTitles = [...new Set([normalizeSearchText(title.en), normalizeSearchText(title.he)])].filter(Boolean);
  const normKeywords = [...new Set([...keywords.en, ...keywords.he, sub.en, sub.he].map(normalizeSearchText))].filter(Boolean);
  return { id, kind, title, sub, keywords, tab, normTitles, normKeywords };
}

/** Consolidated views reachable only via search (labels: sm.extra.*). */
const EXTRA_ROUTE_TABS: readonly ActiveTab[] = ["weekly", "handoff", "scholar"];

/** IA-20: routes deliberately NOT offered in search, each with the reason it
 *  would be wrong to surface. Absence is a product decision recorded here, not
 *  an oversight — searchRouteCoverage.test.ts requires every other route in
 *  ROUTE_IDS to be findable by name. */
export const UNSEARCHABLE_ROUTES: Partial<Record<ActiveTab, string>> = {
  attribution: "Legal/credits surface reached from Settings; not somewhere a parent navigates to by name.",
  science: "Evidence and credits, reached from a trust link in context rather than as a destination.",
};

function buildIndex(): readonly SearchEntry[] {
  const entries: SearchEntry[] = [];

  // 1. Route/tab entries — every surfaced leaf across the eight sections,
  //    labeled in both languages via the existing nav.tab.* dictionary.
  const seenTabs = new Set<ActiveTab>();
  for (const sec of SECTIONS) {
    for (const it of sec.items) {
      if (seenTabs.has(it.tab)) continue;
      seenTabs.add(it.tab);
      entries.push(entry(
        `route:${it.tab}`,
        "route",
        pair(translate("en", "nav.tab." + it.tab), translate("he", "nav.tab." + it.tab)),
        pair(translate("en", "nav." + sec.id), translate("he", "nav." + sec.id)),
        { en: [], he: [] },
        it.tab,
      ));
    }
  }
  for (const tab of EXTRA_ROUTE_TABS) {
    if (seenTabs.has(tab)) continue;
    seenTabs.add(tab);
    entries.push(entry(
      `route:${tab}`,
      "route",
      pair(translate("en", "sm.extra." + tab), translate("he", "sm.extra." + tab)),
      pair(translate("en", "sm.extra." + tab + "Sub"), translate("he", "sm.extra." + tab + "Sub")),
      { en: [], he: [] },
      tab,
    ));
  }

  // IA-20, properly. The two loops above cover routes that are section items,
  // plus three that somebody remembered to hand-list. Everything else the app
  // can navigate to was unreachable by name: a parent could open Screening,
  // Find a professional, Care team, Reports or Timeline from a hub and then
  // never find it again by typing it. Fifteen routes were in that state.
  //
  // A hand-maintained list is the shape that failed here: it is only ever as
  // complete as the last person to remember it. So the remainder is derived
  // from ROUTE_IDS — the canonical list the router itself uses — and a route
  // is absent from search ONLY if it is named in UNSEARCHABLE_ROUTES with a
  // reason. searchRouteCoverage.test.ts holds the other end, so a new route
  // either gets a name or gets an explicit decision, and cannot quietly
  // become unfindable.
  for (const tab of ROUTE_IDS) {
    if (seenTabs.has(tab) || tab in UNSEARCHABLE_ROUTES) continue;
    const en = translate("en", "nav.tab." + tab);
    const he = translate("he", "nav.tab." + tab);
    // translate() falls back to the KEY when a string is missing, which would
    // print "nav.tab.foo" to a parent. An unlabelled route is left out and the
    // coverage guard fails, which is the right way round: a missing label is a
    // job to do, never something to render.
    if (en === "nav.tab." + tab) continue;
    seenTabs.add(tab);
    entries.push(entry(
      `route:${tab}`,
      "route",
      pair(en, he),
      pair(translate("en", "nav.short.more"), translate("he", "nav.short.more")),
      { en: [], he: [] },
      tab,
    ));
  }

  // 2. Learn Library cards (title en+he; hook + shelf label as keywords).
  const shelfLabel = new Map(LEARN_CATEGORIES.map((c) => [c.id, c.label]));
  for (const card of LEARN_CARDS) {
    const shelf = shelfLabel.get(card.category);
    entries.push(entry(
      `learn:${card.id}`,
      "learn",
      pair(card.title.en, card.title.he),
      pair(shelf?.en ?? card.category, shelf?.he ?? card.category),
      { en: [card.hook.en], he: [card.hook.he] },
      "learn",
    ));
  }

  // 3. Masterclasses (title/titleHe; hook + frame label as keywords).
  for (const mc of MASTERCLASSES) {
    const frame = FRAME_LABELS[mc.frame];
    entries.push(entry(
      `masterclass:${mc.id}`,
      "masterclass",
      pair(mc.title, mc.titleHe),
      pair(frame?.en ?? "", frame?.he ?? ""),
      { en: [mc.hook], he: [mc.hookHe] },
      "masterclasses",
    ));
  }

  // 4. Ready-made routines (title en+he; domains chip + why-line as keywords).
  for (const routine of ROUTINES) {
    entries.push(entry(
      `routine:${routine.id}`,
      "routine",
      pair(routine.title.en, routine.title.he),
      pair(routine.domains.en, routine.domains.he),
      { en: [routine.why.en], he: [routine.why.he] },
      "routines",
    ));
  }

  // 5. Scholar frameworks (names are Latin-script canon; concept + theory
  //    as keywords — catalog carries no Hebrew, title falls back to EN).
  for (const scholar of scholarsInfo) {
    entries.push(entry(
      `scholar:${scholar.slug}`,
      "scholar",
      pair(scholar.name),
      pair(scholar.concept),
      { en: [scholar.theory, scholar.concept], he: [] },
      "scholar",
    ));
  }

  // Hard-moment entries are resolved per call below, outside the static memo.

  // 7. Bedtime stories: generate-and-discard (lib/bedtimeStories.ts exports a
  //    prompt builder, no static preset catalog) — nothing static to index;
  //    the #/bedtime-stories route itself is covered by the route entries.

  // 8. Play activities (EN-only catalog; domain as sub/keyword).
  for (const activity of PLAY_ACTIVITIES) {
    entries.push(entry(
      `activity:${activity.id}`,
      "activity",
      pair(activity.title),
      pair(activity.domain),
      { en: [activity.domain], he: [] },
      "daily-play",
    ));
  }

  // 9. Milestones (EN-only catalog; domain as sub/keyword).
  for (const milestone of ALL_MILESTONES) {
    entries.push(entry(
      `milestone:${milestone.id}`,
      "milestone",
      pair(milestone.title),
      pair(milestone.domain),
      { en: [milestone.domain], he: [] },
      "development",
    ));
  }

  // 10. Hero journeys (EN-only catalog; pack as sub).
  for (const story of HERO_STORIES) {
    entries.push(entry(
      `journey:${story.id}`,
      "journey",
      pair(story.title),
      pair(story.pack),
      { en: [story.pack], he: [] },
      "stories",
    ));
  }

  // 11. Practice worlds (EN-only catalog).
  for (const world of WORLDS) {
    entries.push(entry(
      `world:${world.id}`,
      "world",
      pair(world.title),
      pair(world.status === "live" ? "available" : "coming soon"),
      { en: [], he: [] },
      "practice",
    ));
  }

  return Object.freeze(entries);
}

/** Module memo — the index is built exactly once, on first use. */
let memo: readonly SearchEntry[] | undefined;

/** Static metadata is cached; governed hard-moment entries are revalidated each call. */
export function getSearchIndex(context?: HardMomentContext): readonly SearchEntry[] {
  const base = (memo ??= buildIndex());
  // Missing child context leaves this catalog out; never index an age guess.
  if (!context) return base;
  return [...base, ...availableHardMomentCards(context).map((card) => entry(
    `hard-moment:${card.id}`, "hard-moment",
    pair(card.title.en, card.title.he),
    pair(translate("en", "hm.cat." + card.category), translate("he", "hm.cat." + card.category)),
    { en: [card.category], he: [] }, "behaviors",
  ))];
}

/* ── Forgiving matching + simple ranking ─────────────────────────────────── */

/**
 * Score one entry against a normalized query. Both languages are always
 * searched regardless of UI language. Simple startsWith/substring ranking —
 * no fuzzy dependency (hygiene bar: fast, forgiving, HE+EN).
 */
function scoreEntry(e: SearchEntry, q: string): number {
  let best = 0;
  for (const title of e.normTitles) {
    if (title.startsWith(q)) { best = Math.max(best, 100); continue; }
    if (title.split(/\s+/).some((w) => w.startsWith(q))) { best = Math.max(best, 80); continue; }
    if (title.includes(q)) best = Math.max(best, 60);
  }
  if (best >= 100) return best;
  for (const kw of e.normKeywords) {
    if (kw.startsWith(q)) best = Math.max(best, 40);
    else if (kw.includes(q)) best = Math.max(best, 25);
  }
  return best;
}

/**
 * Search the static catalog. Case/diacritic/HE-final-insensitive, EN+HE
 * always, ranked title-startsWith > word-startsWith > title-substring >
 * keyword. Stable within a rank (catalog order). Returns up to `limit`.
 */
export function searchCatalog(query: string, limit = 12, context?: HardMomentContext): SearchEntry[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const scored: { e: SearchEntry; s: number; i: number }[] = [];
  const index = getSearchIndex(context);
  for (let i = 0; i < index.length; i++) {
    const s = scoreEntry(index[i], q);
    if (s > 0) scored.push({ e: index[i], s, i });
  }
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.e);
}
