import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * TODAY-2 / CODEX-1 / TODAY-7 / CODEX-7 — Today-hub consolidation acceptance
 * (2026-07-23 next-level wave 2).
 *
 * The vitest env is node-only, so these are SOURCE-BASED structural guards in
 * the house pattern (clinicalFirewall.wave3.test.ts): they pin the shape that
 * makes the acceptance true at runtime —
 *   1. hero and action card are mutually exclusive (focusHeadline renders once,
 *      never a stacked duplicate),
 *   2. exactly ONE gradient-primary CTA exists on the pre-accept anchor and
 *      none on the action card,
 *   3. the duplicate "Recent context" section is gone (ProgressNarrative's
 *      evidence cell is the single recent-moments surface),
 *   4. the TODAY-1 guard survived the merge (accept reachable only from a real
 *      AI focus headline),
 *   5. no static confidence/certainty verdict in capture-review copy (EN+HE) —
 *      firewall condition: this wording may never return.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
// Drop /* */ and // comments so prose about the rules can't trip the scans.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("TODAY-2/CODEX-1 — one loop, not three stacked widgets", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const hero = stripComments(read("components/overview/TodayRecommendation.tsx"));
  const loop = stripComments(read("components/overview/TodayActionLoop.tsx"));
  const promptCard = stripComments(read("components/overview/PromptCaptureCard.tsx"));

  it("OverviewTab renders ONE mutually-exclusive primary slot (W1 1.2 chain)", () => {
    // The guaranteed-action chain: accepted action → focus hero → prompt
    // capture card / play promotion — one ternary chain, one slot.
    expect(overview).toMatch(/activeTodayAction\s*\?\s*\(\s*<TodayActionLoop\s*\/>\s*\)\s*:\s*todayChoice\.kind\s*===\s*"focus"\s*\?\s*\(/);
    expect(count(overview, /<TodayActionLoop/g)).toBe(1);
    expect(count(overview, /<TodayRecommendation/g)).toBe(1);
    expect(count(overview, /<PromptCaptureCard/g)).toBe(1);
  });

  it("the hero owns the pre-accept state: capacity chips + accept row", () => {
    expect(hero).toMatch(/capacityMinutes/);
    expect(hero).toMatch(/accept\?:/);
  });

  it("TODAY-1 guard survives the merge: accept is offered ONLY from a real focus headline", () => {
    expect(overview).toMatch(/accept=\{focusHeadline\s*\?/);
    // and the action card can no longer persist anything into actionLoops
    expect(loop).not.toMatch(/acceptTodayAction/);
  });

  it("the action card renders only accepted/completed state (no pre-accept fork left)", () => {
    expect(loop).toMatch(/if\s*\(!activeTodayAction\)\s*return null/);
    expect(loop).not.toMatch(/today\.loop\.empty/);
  });

  it("exactly ONE gradient-primary CTA per possible anchor, none on the action card", () => {
    expect(count(hero, /--arbor-gradient-primary/g)).toBe(1);
    // The prompt capture card is the hero's mutually-exclusive sibling in the
    // chain — it carries its own single gradient primary; at runtime only one
    // of the two renders (Rule A: one primary action above the fold).
    expect(count(promptCard, /--arbor-gradient-primary/g)).toBe(1);
    expect(count(loop, /--arbor-gradient-primary/g)).toBe(0);
    expect(count(overview, /--arbor-gradient-primary/g)).toBe(0);
  });

  it("the duplicate 'Recent context' section is deleted (single recent-moments surface)", () => {
    expect(overview).not.toMatch(/Recent context/);
    expect(overview).not.toMatch(/הקשר אחרון/);
    expect(overview).not.toMatch(/today-recent-context/);
  });

  it("section order: capture → since-strip → day anchor → noticed → narrative → tools", () => {
    // W1 Rule A: SinceLastVisit sits between the capture chrome and the
    // primary-action slot; the Daily Play section is a single JSX instance
    // (playSection const, placed by the budget logic) so it is order-exempt.
    const order = [
      overview.indexOf("<QuickCaptureBar"),
      overview.indexOf("<SinceLastVisit"),
      overview.indexOf("<TodayActionLoop"),
      overview.indexOf("<ArborNoticedCard"),
      overview.indexOf("<ProgressNarrative"),
      overview.indexOf("<DailyCheckinCard"),
    ];
    for (const idx of order) expect(idx).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(count(overview, /<DailyPlayCard/g)).toBe(1);
  });

  it("the merged action row is fully bilingual (today.action.* in both dictionaries)", () => {
    for (const key of ["today.action.make", "today.action.length", "today.action.min"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });
});

describe("CODEX-7 — capture review carries no static confidence verdict (firewall: may never return)", () => {
  it("QuickLogModal has no confidence/certainty wording in EN or HE copy", () => {
    const code = stripComments(read("components/overview/QuickLogModal.tsx"));
    expect(code).not.toMatch(/confidence/i);
    expect(code).not.toMatch(/certainty/i);
    expect(code).not.toMatch(/ודאות/);
    expect(code).not.toMatch(/ביטחון/);
  });

  it("no i18n capture-review key asserts a static confidence verdict", () => {
    for (const dict of [en, he]) {
      for (const [key, value] of Object.entries(dict)) {
        if (!/^(ql|quicklog)\./.test(key)) continue;
        expect(value, `${key} carries confidence wording`).not.toMatch(/confidence|ודאות/i);
      }
    }
  });
});
