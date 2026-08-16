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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as searchnavEn, he as searchnavHe, searchnavText } from "../../lib/i18nElevation/searchnav";

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
    const sheetAt = mobileNav.indexOf('role="dialog"');
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
  it("primary section ids are the Heartwood D5 slots (no removal)", () => {
    expect(mobileNav).toContain('const PRIMARY_SECTION_IDS = ["today", "journal", "ask", "growth"] as const;');
  });

  it("emphasis set is the three primary jobs (today/ask/journal)", () => {
    expect(mobileNav).toContain('new Set<string>(["today", "ask", "journal"])');
  });

  it("quieter rendering is size/opacity only — colors stay on tokens", () => {
    const navBarAt = mobileNav.indexOf("<nav");
    const sheetAt = mobileNav.indexOf('role="dialog"');
    const barChunk = mobileNav.slice(navBarAt, sheetAt);
    expect(barChunk).toContain("var(--arbor-clay-deep)");
    expect(barChunk).toContain("var(--arbor-muted)");
    expect(barChunk).toContain("opacity");
    // No raw hex colors introduced in the bar region.
    expect(barChunk).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("the More entry and overflow sheet still expose every remaining category", () => {
    expect(mobileNav).toContain("overflow.map((sec)");
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
