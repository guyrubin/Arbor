/**
 * W2.4 + W2.7 + W1.9 — search surfaces + nav-weighting guards (source-level).
 *
 * Node harness (vitest environment: "node") — no DOM/React rendering; wiring
 * is asserted at source level (same convention as kidLock.test.ts).
 *
 * Covers:
 *  1. Mobile entry points render: accessories-strip button (Shell) + More
 *     sheet row (MobileNav) both open the ONE SearchModal via
 *     requestOpenSearch, and Shell's listener re-checks the kid gate.
 *  2. KID-LOCK guard intact: Ctrl/Cmd+K early-returns on the gate and the
 *     modal stays unmounted while locked (pins mirror kidLock.test.ts).
 *  3. Nav weighting (2.7) is EMPHASIS ONLY: primary ids unchanged, no tab
 *     removed/reordered, quieter treatment is tokens/opacity/size only.
 *  4. Analytics events wired: search_open (mobile/desktop/more) and
 *     search_result_tap({kind}) on both result surfaces.
 *  5. i18nElevation/searchnav module shape (registration-ready en/he records).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as searchnavEn, he as searchnavHe, searchnavText } from "../../lib/i18nElevation/searchnav";
import { normalizeSearchText } from "../../lib/searchNormalize";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(__dirname, "..", "..");
const readSrc = (...rel: string[]) => readFileSync(path.join(SRC_ROOT, ...rel), "utf8");

const shell = readSrc("components", "layout", "Shell.tsx");
const mobileNav = readSrc("components", "layout", "MobileNav.tsx");
const searchModal = readSrc("components", "search", "SearchModal.tsx");
const topbarSearch = readSrc("components", "search", "TopbarSearch.tsx");

/* ── 1. Mobile entry points ──────────────────────────────────────────────── */
describe("W1.9: mobile search entry points", () => {
  it("Shell accessories strip opens search via requestOpenSearch('mobile')", () => {
    expect(shell).toContain('requestOpenSearch("mobile")');
  });

  it("MobileNav More sheet carries a search row via requestOpenSearch('more')", () => {
    expect(mobileNav).toContain('requestOpenSearch("more")');
    // The row lives inside the More sheet (after the sheet dialog opens).
    expect(mobileNav).toContain('import { Sheet } from "../ui/Sheet";');
    const sheetAt = mobileNav.indexOf("<Sheet");
    expect(sheetAt).toBeGreaterThan(-1);
    expect(mobileNav.indexOf('requestOpenSearch("more")')).toBeGreaterThan(sheetAt);
    // 44px touch target on the row.
    const rowAt = mobileNav.indexOf('requestOpenSearch("more")');
    const rowChunk = mobileNav.slice(rowAt, rowAt + 400);
    expect(rowChunk).toContain("min-h-[44px]");
  });

  it("both entries route through the ONE SearchModal open-event seam", () => {
    expect(searchModal).toContain('export const SEARCH_OPEN_EVENT = "arbor:search:open"');
    expect(searchModal).toContain("export function requestOpenSearch");
    expect(shell).toContain("SEARCH_OPEN_EVENT");
  });

  it("Shell's open-request listener re-checks the kid gate before opening", () => {
    const listenerAt = shell.indexOf("const onOpenRequest");
    expect(listenerAt).toBeGreaterThan(-1);
    const guardAt = shell.indexOf("if (isKidModeActive()) return;", listenerAt);
    const openAt = shell.indexOf("setSearchOpen(true)", listenerAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(openAt);
  });

  it("SearchModal is 375px-usable: input top, scrollable results, 44px rows", () => {
    expect(searchModal).toContain("min-h-[44px]");
    expect(searchModal).toContain("overflow-y-auto");
    expect(searchModal).toContain("max-sm:h-full"); // full-height dialog on phones
  });
});

/* ── 2. KID-LOCK intact (mirrors kidLock.test.ts LEAK 5 pins) ────────────── */
describe("W0.9 kid-lock guard survives the search wave (source pins)", () => {
  it("Ctrl/Cmd+K still early-returns on the gate before toggling", () => {
    const comboAt = shell.indexOf('e.key.toLowerCase() === "k"');
    expect(comboAt).toBeGreaterThan(-1);
    const guardAt = shell.indexOf("if (isKidModeActive()) return;", comboAt);
    const toggleAt = shell.indexOf("setSearchOpen((s) => !s)", comboAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(toggleAt);
  });

  it("SearchModal stays unmounted while locked", () => {
    expect(shell).toContain("{!kidLocked && <SearchModal");
  });

  it("TopbarSearch no longer owns a duplicate Ctrl/Cmd+K listener (Shell is the one owner)", () => {
    expect(topbarSearch).not.toContain("metaKey");
    expect(topbarSearch).not.toContain('=== "k"');
  });
});

/* ── 3. Nav weighting: emphasis only, zero regression ────────────────────── */
describe("W2.7 nav de-overload — emphasis only", () => {
  // Heartwood D5 ratified the W2.7 canon follow-up: the slot ORDER now matches
  // the emphasis set (Today · Journal · Ask lead, Growth fourth). Still four
  // tabs + More — no section is removed from the bar.
  it("three companion places remain navigation; conversation is the shared global dock", () => {
    expect(mobileNav).toContain('const PRIMARY_SECTION_IDS = ["today", "growth", "practice"] as const;');
    expect(mobileNav).toContain('section.id !== "ask"');
    expect(shell).toContain("<CompanionWorkspace");
    const workspace = readSrc("components", "companion", "CompanionWorkspace.tsx");
    expect(workspace).toContain('data-testid="companion-launcher"');
    expect(workspace).toContain('<CoachTab key={childProfile.id} embedded visible={visible} />');
  });

  it("all three labeled places remain equally readable", () => {
    expect(mobileNav).toContain('new Set<string>(["today", "growth", "practice"])');
  });

  it("quieter rendering is size/opacity only — colors stay on tokens", () => {
    const navBarAt = mobileNav.indexOf("<nav");
    const sheetAt = mobileNav.indexOf('role="dialog"');
    const barChunk = mobileNav.slice(navBarAt, sheetAt);
    expect(barChunk).toContain("var(--arbor-clay-deep)");
    expect(barChunk).toContain("var(--arbor-muted)");
    expect(barChunk).not.toMatch(/opacity:\s*0\.[0-9]/);
    // No raw hex colors introduced in the bar region.
    expect(barChunk).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("the More entry and overflow sheet still expose every remaining category", () => {
    // The same overflow list is partitioned, not reduced, by these two groups.
    // parentRecordHierarchy.test.tsx also renders EN/HE, asserts every original
    // SECTIONS destination exactly once, and invokes each navigation callback.
    expect(mobileNav).toContain('(["records", "support"] as const).map');
    expect(mobileNav).toContain('overflow.filter(sec => RECORD_SECTION_IDS.has(sec.id) === (group === "records")).map');
    expect(mobileNav).toContain("data-more-destination={primaryTabOf(sec)}");
    expect(mobileNav).toContain('data-more-destination="memory"');
    expect(mobileNav).toContain("setMoreOpen(true)");
  });
});

/* ── 4. Analytics wiring ─────────────────────────────────────────────────── */
describe("search analytics", () => {
  it("search_open fires with a surface on every entry path", () => {
    expect(shell).toContain('track("search_open", { surface: "desktop" })'); // Ctrl+K
    expect(shell).toContain('track("search_open", { surface })'); // mobile + more via event
    expect(topbarSearch).toContain('track("search_open", { surface: "desktop" })');
  });

  it("search_result_tap carries the result kind on both surfaces", () => {
    expect(searchModal).toContain('track("search_result_tap", { kind: r.kind })');
    expect(topbarSearch).toContain('track("search_result_tap", { kind: entry.kind })');
  });
});

/* ── 5. searchnav i18n module shape ──────────────────────────────────────── */
describe("i18nElevation/searchnav — registration-ready module", () => {
  it("en and he cover identical elev.searchnav.* key sets", () => {
    const enKeys = Object.keys(searchnavEn).sort();
    const heKeys = Object.keys(searchnavHe).sort();
    expect(enKeys).toEqual(heKeys);
    for (const k of enKeys) expect(k.startsWith("elev.searchnav.")).toBe(true);
  });

  it("every SearchKind has a badge label in both languages", () => {
    const kinds = ["route", "learn", "masterclass", "routine", "scholar", "hard-moment", "activity", "milestone", "journey", "world"];
    for (const k of kinds) {
      expect(searchnavEn["elev.searchnav.kind." + k], k).toBeTruthy();
      expect(searchnavHe["elev.searchnav.kind." + k], k).toBeTruthy();
    }
  });

  it("searchnavText resolves per language and falls back to the key", () => {
    expect(searchnavText("elev.searchnav.kind.route", false)).toBe("Go");
    expect(searchnavText("elev.searchnav.kind.route", true)).toBe("מעבר");
    expect(searchnavText("elev.searchnav.nope", true)).toBe("elev.searchnav.nope");
  });

  it("index.ts registers the searchnav module (integrator merge landed)", () => {
    const idx = readSrc("lib", "i18nElevation", "index.ts");
    expect(idx).toContain('import * as searchnav from "./searchnav"');
    expect(idx).toMatch(/\r?\n\s+searchnav,\r?\n/);
  });
});

/* ── Critic r1 (W2-ASKJB): the topbar search hit target meets the 44 px floor ── */
describe("TopbarSearch hit target is the whole 44 px pill", () => {
  it("the pill is a <label> with min-h-11 / 44px and the input stretches to fill it", () => {
    expect(topbarSearch).toMatch(/<label\s+className="[^"]*\bmin-h-11\b/);
    expect(topbarSearch).toContain('height: "44px"');
    expect(topbarSearch).not.toContain('height: "40px"');
    // Critic r2: field-bare keeps the global input fill off (one surface).
    expect(topbarSearch).toMatch(/<input[\s\S]{0,1500}className="field-bare min-h-11 self-stretch"/);
    // A 1px border would take 2 px from the input; the hairline is an inset shadow.
    expect(topbarSearch).not.toMatch(/border:\s*open/);
  });
});

/* ── B-SHELL-14: one search result model + "Ask Arbor about …" ───────────── */
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (k: string) => k, uiLang: "en" }) }));

describe("B-SHELL-14 · both surfaces render ONE hook", () => {
  const hook = readSrc("components", "search", "useSearchResults.ts");

  it("SearchModal and TopbarSearch both call useSearchResults with the same limits; neither owns a model", () => {
    for (const src of [searchModal, topbarSearch]) {
      expect(src).toContain('import { useSearchResults, type SearchRow } from "./useSearchResults";');
      expect(src).toContain("useSearchResults(");
      expect(src).toContain("catalogLimit: 12, recordLimit: 12");
      expect(src).not.toContain('import("../../lib/searchIndex")');
      expect(src).not.toContain("behaviorLogs");
      expect(src).not.toContain("searchCatalog(");
    }
    // the lazy import contract moved into the hook — still a dynamic import()
    expect(hook).toContain('import("../../lib/searchIndex")');
    expect(hook).toMatch(/import type \{ SearchEntry, SearchKind \} from "\.\.\/\.\.\/lib\/searchIndex";/);
  });

  it("record rows stay on-device: the hook never writes to searchIndex", () => {
    expect(hook).not.toMatch(/getSearchIndex\(\)\.push|addToIndex|registerEntry/);
    expect(readSrc("lib", "searchIndex.ts")).not.toContain("behaviorLogs");
  });

  it("a log row reads in place on #/journal, focused — no Behaviors switch, no capture sheet", () => {
    const log = hook.slice(hook.indexOf("for (const l of behaviorLogs)"), hook.indexOf("for (const c of conversations)"));
    expect(log).toContain('requestJournalFocus("moment-" + l.id); setActiveTab("journal");');
    expect(log).not.toMatch(/setActiveTab\("behaviors"\)|openCaptureSheet/);
  });

  it("the ask row seeds the composer (prefill only) and opens Ask; first on '?'", () => {
    expect(hook).toContain('seedCoach({ prompt: term, source: "search" }); setActiveTab("coach");');
    expect(hook).toMatch(/ask && askFirst\(term\) \? \[ask, \.\.\.catalog, \.\.\.record\] : \[\.\.\.catalog, \.\.\.record, \.\.\.\(ask \? \[ask\] : \[\]\)\]/);
  });

  it("analytics carry the kind only — never the query", () => {
    expect(searchModal).toContain('track("search_result_tap", { kind: r.kind })');
    expect(topbarSearch).toContain('track("search_result_tap", { kind: entry.kind })');
    for (const src of [searchModal, topbarSearch, hook]) {
      expect(src).not.toMatch(/track\([^)]*\b(q|query|term)\b[^)]*\)/);
    }
  });
});

describe("B-SHELL-14 · localized record matching + the ask copy (EN + HE)", () => {
  it("a Hebrew query matches a log whose stored behaviorType is English", async () => {
    const { logSearchText } = await import("./useSearchResults");
    const { translate } = await import("../../lib/i18n");
    const { BEHAVIOR_TYPES } = await import("../../content/behaviorTaxonomy");
    const sensory = BEHAVIOR_TYPES.find((b) => b.value === "Sensory Overload")!;
    const heLabel = translate("he", sensory.labelKey);
    expect(/[\u0590-\u05FF]/.test(heLabel)).toBe(true);
    const text = logSearchText({ behaviorType: "Sensory Overload", trigger: "loud mall", response: "", notes: "" });
    expect(text).toContain(normalizeSearchText(heLabel));
    expect(text).toContain("sensory overload");
    expect(text).toContain("loud mall");
    // NEGATIVE CONTROL: the pre-change haystack (raw fields only) misses the Hebrew query.
    const pre = "Sensory Overload loud mall  ".toLowerCase();
    expect(pre.includes(heLabel.toLowerCase())).toBe(false);
  });

  it("askFirst only when the query ends with '?'", async () => {
    const { askFirst } = await import("./useSearchResults");
    expect(askFirst("sleep?")).toBe(true);
    expect(askFirst("  שינה? ")).toBe(true);
    expect(askFirst("sleep")).toBe(false);
  });

  it("'Ask Arbor about …' exists in both languages, and a Hebrew query is isolated in the English line", async () => {
    const { translate } = await import("../../lib/i18n");
    expect(translate("en", "sm.askAbout", { q: "sleep" })).toBe("Ask Arbor about “sleep”");
    expect(translate("en", "sm.askAbout", { q: "שינה" })).toBe("Ask Arbor about “\u2068שינה\u2069”");
    expect(translate("he", "sm.askAbout", { q: "שינה" })).toContain("שינה");
    for (const key of ["sm.askAbout", "sm.askAbout.sub", "sm.kind.ask"]) {
      expect(/[\u0590-\u05FF]/.test(translate("he", key)), key).toBe(true);
      expect(translate("en", key)).not.toBe(key);
    }
  });
});
