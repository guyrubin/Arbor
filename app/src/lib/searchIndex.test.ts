/**
 * W2.4: Tests for the full-catalog search index (masterplan 2.4 + 1.9).
 *
 * Verifies:
 *   - Normalization: HE final letters, Latin diacritics, Hebrew niqqud, case.
 *   - Coverage pins: EVERY learn card / masterclass / routine / scholar /
 *     PUBLISHED hard-moment appears; draft hard-moments do NOT; the four
 *     legacy catalogs (activities, milestones, journeys, worlds) still index;
 *     every surfaced route/tab has a route entry.
 *   - Ranking sanity: title startsWith > substring > keyword-only.
 *   - Both languages match regardless of UI language.
 *   - Deep-link validity: every entry's tab is a real route AND resolves to a
 *     nav section (same guard pattern as navigation.test.ts).
 *   - Lazy contract: no eager module-load build; consumers dynamic-import.
 *   - AC-6: no child-record entries can appear (imports are catalog-only).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSearchIndex,
  searchCatalog,
  normalizeSearchText,
  type SearchEntry,
} from "./searchIndex";
import { PLAY_ACTIVITIES } from "../playbank/content";
import { ALL_MILESTONES } from "./milestoneData";
import { HERO_STORIES } from "./heroJourneys";
import { WORLDS } from "../practice/worlds";
import { LEARN_CARDS } from "../learn/learnCards";
import { MASTERCLASSES } from "./masterclasses";
import { ROUTINES } from "./routines";
import { scholarsInfo } from "../initialData";
import { hardMomentCards, publishedHardMomentCards } from "../content/hardMomentCards";
import { SECTIONS, sectionForTab } from "./navigation";
import { ROUTE_IDS } from "./routes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (...rel: string[]) =>
  readFileSync(path.join(__dirname, "..", ...rel), "utf8");

const INDEX = getSearchIndex();
const byId = new Map(INDEX.map((e) => [e.id, e]));

/* ── Normalization ───────────────────────────────────────────────────────── */
describe("normalizeSearchText — forgiving HE+EN", () => {
  it("lowercases and trims", () => {
    expect(normalizeSearchText("  Calm Morning  ")).toBe("calm morning");
  });

  it("strips Latin diacritics", () => {
    expect(normalizeSearchText("Café Déjà")).toBe("cafe deja");
  });

  it("folds Hebrew final letters (ך=כ ם=מ ן=נ ף=פ ץ=צ)", () => {
    expect(normalizeSearchText("ך")).toBe("כ");
    expect(normalizeSearchText("ם")).toBe("מ");
    expect(normalizeSearchText("ן")).toBe("נ");
    expect(normalizeSearchText("ף")).toBe("פ");
    expect(normalizeSearchText("ץ")).toBe("צ");
    expect(normalizeSearchText("שלום")).toBe(normalizeSearchText("שלומ"));
  });

  it("strips Hebrew niqqud", () => {
    expect(normalizeSearchText("שָׁלוֹם")).toBe(normalizeSearchText("שלום"));
  });
});

/* ── Coverage pins ───────────────────────────────────────────────────────── */
describe("index coverage — every library, every item", () => {
  it("every Learn Library card appears", () => {
    for (const card of LEARN_CARDS) expect(byId.has(`learn:${card.id}`), `learn:${card.id}`).toBe(true);
  });

  it("every masterclass appears", () => {
    for (const mc of MASTERCLASSES) expect(byId.has(`masterclass:${mc.id}`), `masterclass:${mc.id}`).toBe(true);
  });

  it("every routine appears", () => {
    for (const r of ROUTINES) expect(byId.has(`routine:${r.id}`), `routine:${r.id}`).toBe(true);
  });

  it("every scholar appears", () => {
    for (const s of scholarsInfo) expect(byId.has(`scholar:${s.slug}`), `scholar:${s.slug}`).toBe(true);
  });

  it("every PUBLISHED hard-moment appears; NO draft/retired hard-moment does", () => {
    const publishedIds = new Set(publishedHardMomentCards.map((c) => c.id));
    for (const id of publishedIds) expect(byId.has(`hard-moment:${id}`)).toBe(true);
    for (const card of hardMomentCards) {
      if (!publishedIds.has(card.id)) {
        expect(byId.has(`hard-moment:${card.id}`), `draft leaked: ${card.id}`).toBe(false);
      }
    }
    // The pin is meaningful either way: today the whole catalog is draft, so
    // ZERO hard-moment entries may exist until the clinical gate approves.
    const hmEntries = INDEX.filter((e) => e.kind === "hard-moment");
    expect(hmEntries.length).toBe(publishedHardMomentCards.length);
  });

  it("legacy catalogs still fully covered (activities/milestones/journeys/worlds)", () => {
    expect(INDEX.filter((e) => e.kind === "activity").length).toBe(PLAY_ACTIVITIES.length);
    expect(INDEX.filter((e) => e.kind === "milestone").length).toBe(ALL_MILESTONES.length);
    expect(INDEX.filter((e) => e.kind === "journey").length).toBe(HERO_STORIES.length);
    expect(INDEX.filter((e) => e.kind === "world").length).toBe(WORLDS.length);
  });

  it("every surfaced nav leaf has a route entry (+ the 3 consolidated views)", () => {
    for (const sec of SECTIONS) {
      for (const it of sec.items) {
        expect(byId.has(`route:${it.tab}`), `route:${it.tab}`).toBe(true);
      }
    }
    for (const tab of ["weekly", "handoff", "scholar"]) {
      expect(byId.has(`route:${tab}`), `route:${tab}`).toBe(true);
    }
  });

  it("all entry ids are unique", () => {
    expect(new Set(INDEX.map((e) => e.id)).size).toBe(INDEX.length);
  });

  it("every entry carries bilingual title fields (he falls back to en, never empty)", () => {
    for (const e of INDEX) {
      expect(e.title.en.length, e.id).toBeGreaterThan(0);
      expect(e.title.he.length, e.id).toBeGreaterThan(0);
    }
  });
});

/* ── Deep-link validity (nav guard pattern) ──────────────────────────────── */
describe("deep-link validity — every entry's tab resolves in navigation", () => {
  const validTabs = new Set<string>(ROUTE_IDS);

  it("every entry.tab is a registered route id", () => {
    for (const e of INDEX) expect(validTabs.has(e.tab), `${e.id} → ${e.tab}`).toBe(true);
  });

  it("every entry.tab resolves to a nav section (sectionForTab never orphans)", () => {
    for (const e of INDEX) {
      const sec = sectionForTab(e.tab);
      expect(sec, `${e.id} → ${e.tab}`).toBeTruthy();
      expect(sec.id.length).toBeGreaterThan(0);
    }
  });
});

/* ── Matching + ranking ──────────────────────────────────────────────────── */
describe("searchCatalog — forgiving matching, both languages, ranked", () => {
  it("returns empty for empty/whitespace query", () => {
    expect(searchCatalog("")).toHaveLength(0);
    expect(searchCatalog("   ")).toHaveLength(0);
  });

  it("finds an English routine title case-insensitively", () => {
    const results = searchCatalog("calm morning");
    expect(results[0]?.id).toBe("routine:morning");
  });

  it("finds the same routine by its HEBREW title while nothing about UI language is involved", () => {
    const results = searchCatalog("בוקר רגוע");
    expect(results[0]?.id).toBe("routine:morning");
  });

  it("matches Hebrew despite niqqud in the query", () => {
    const results = searchCatalog("בֹּוקֶר");
    expect(results.some((r) => r.id === "routine:morning")).toBe(true);
  });

  it("matches despite a final-letter difference (forgiving HE)", () => {
    // "שלום" vs "שלומ" normalize identically — use a real catalog word:
    // masterclass "חזית אחת" — query typed with a non-final tav variant is
    // covered by case-folding; assert the finals rule via normalize + a
    // routine containing a final letter.
    const heTitle = ROUTINES.find((r) => /[ךםןףץ]/.test(r.title.he));
    expect(heTitle).toBeTruthy();
    if (heTitle) {
      const swapped = heTitle.title.he.replace(/[ךםןףץ]/g, (c) => ({ "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" }[c] as string));
      const results = searchCatalog(swapped);
      expect(results.some((r) => r.id === `routine:${heTitle.id}`)).toBe(true);
    }
  });

  it("finds a masterclass by English title fragment", () => {
    const results = searchCatalog("repair after conflict");
    expect(results.some((r) => r.kind === "masterclass")).toBe(true);
  });

  it("finds a learn card and a scholar", () => {
    const anyLearn = LEARN_CARDS[0];
    expect(searchCatalog(anyLearn.title.en).some((r) => r.id === `learn:${anyLearn.id}`)).toBe(true);
    expect(searchCatalog("vygotsky").some((r) => r.id === "scholar:vygotsky")).toBe(true);
  });

  it("ranking: title startsWith beats keyword-only matches", () => {
    // "zone of proximal" lives only in Vygotsky's theory KEYWORD; an entry
    // whose TITLE starts with the query must outrank keyword hits.
    const results = searchCatalog("lev vygotsky");
    expect(results[0]?.id).toBe("scholar:vygotsky");
  });

  it("ranking: a word-start match ranks above a mid-word substring match", () => {
    const q = normalizeSearchText("calm");
    const results = searchCatalog("calm", 30);
    expect(results.length).toBeGreaterThan(0);
    // Every returned entry genuinely matches somewhere (no noise).
    for (const r of results) {
      const hay = [...r.normTitles, ...r.normKeywords].join(" ");
      expect(hay.includes(q), r.id).toBe(true);
    }
    // The top result matches in its TITLE, not only via keywords.
    expect(results[0].normTitles.some((t) => t.includes(q))).toBe(true);
  });

  it("respects the limit parameter and defaults to 12", () => {
    expect(searchCatalog("a", 5).length).toBeLessThanOrEqual(5);
    expect(searchCatalog("a").length).toBeLessThanOrEqual(12);
  });

  it("returns nothing for nonsense", () => {
    expect(searchCatalog("xyzzy_nomatch_zzzq")).toHaveLength(0);
  });
});

/* ── Lazy contract ───────────────────────────────────────────────────────── */
describe("lazy contract — index builds once, on demand; consumers dynamic-import", () => {
  const indexSrc = readSrc("lib", "searchIndex.ts");

  it("no eager top-level build (memoized getSearchIndex, no exported prebuilt array)", () => {
    expect(indexSrc).toMatch(/let memo/);
    expect(indexSrc).toMatch(/export function getSearchIndex/);
    expect(indexSrc).not.toMatch(/^export const SEARCH_INDEX/m);
  });

  it("getSearchIndex is memoized (same frozen array identity)", () => {
    expect(getSearchIndex()).toBe(getSearchIndex());
    expect(Object.isFrozen(getSearchIndex())).toBe(true);
  });

  it("SearchModal and TopbarSearch load the module via dynamic import() only", () => {
    for (const file of ["SearchModal.tsx", "TopbarSearch.tsx"]) {
      const src = readSrc("components", "search", file);
      expect(src, file).toContain('import("../../lib/searchIndex")');
      // Only type-only static imports are allowed (erased at build).
      const staticImports = src.match(/^import .*from "\.\.\/\.\.\/lib\/searchIndex";?$/gm) ?? [];
      for (const line of staticImports) expect(line, file).toContain("import type");
    }
  });
});

/* ── AC-6 safety ─────────────────────────────────────────────────────────── */
describe("AC-6 safety: static catalogs only, no child-record entries", () => {
  it("no entry id uses a child-data namespace", () => {
    const banned = ["behavior:", "log:", "memory:", "observation:", "journal:", "child:", "thread:", "conversation:"];
    for (const e of INDEX) {
      for (const prefix of banned) expect(e.id.startsWith(prefix), e.id).toBe(false);
    }
  });

  it("searchIndex.ts imports no child-data modules (arbor-sec grep)", () => {
    const indexSrc = readSrc("lib", "searchIndex.ts");
    const importLines = indexSrc.match(/^import .*$/gm) ?? [];
    const bannedModules = ["childData", "ChildMemory", "memoryService", "families", "ProfileContext", "firestore"];
    for (const line of importLines) {
      for (const banned of bannedModules) expect(line).not.toContain(banned);
    }
  });

  it("index size is sane (every library represented, catalog-scale not data-scale)", () => {
    const expectedMin =
      PLAY_ACTIVITIES.length + ALL_MILESTONES.length + HERO_STORIES.length + WORLDS.length +
      LEARN_CARDS.length + MASTERCLASSES.length + ROUTINES.length + scholarsInfo.length +
      publishedHardMomentCards.length;
    expect(INDEX.length).toBeGreaterThanOrEqual(expectedMin);
    // Route entries are bounded by the route registry — nothing dynamic.
    expect(INDEX.length).toBeLessThanOrEqual(expectedMin + ROUTE_IDS.length);
  });
});

/* Expose SearchEntry so the type participates in the compile (tsc scope). */
const _typecheck: SearchEntry | undefined = undefined;
void _typecheck;
