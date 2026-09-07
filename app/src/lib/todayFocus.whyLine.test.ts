import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { whyLineParts, whyLineFor } from "./todayFocus";
import { en, he } from "./i18n";

/**
 * OBJ-TODAY-02 — the Today why-line may only name inputs that exist.
 *
 * Two provenance defects the 7 Sep object audit measured on `#/overview`:
 *
 *  1. "today's rhythm" appeared at `confidence: "low"`, on the same screen
 *     whose narrative said "7 more days of moments and Arbor can start reading
 *     Dylan's daily rhythm". The page contradicted itself in two paragraphs.
 *  2. A cached `inputsUsed.momentCount` outranked the live ledger, so a day-0
 *     Today (0 logs, 0 milestones) printed "Chosen from recent moments, age."
 *
 *  3. `PromptCaptureCard` — the card that renders precisely when there is NO
 *     AI focus — printed the authored `today.intent.whySimple` ("…age, goals,
 *     interests, and what you've captured so far") beside zero goals and zero
 *     interests. It now takes the derived line the hero uses.
 *
 * Node-only vitest env, so the render half is a source assertion in the house
 * pattern (todayConsolidation.test.ts / whyLineTrustChain.test.ts).
 */

const app = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(app, "src", rel), "utf8");
const tEn = (k: string, v?: Record<string, string | number>) => resolve(en, k, v);
const tHe = (k: string, v?: Record<string, string | number>) => resolve(he, k, v);
function resolve(dict: Record<string, string>, k: string, v?: Record<string, string | number>): string {
  let s = dict[k] ?? k;
  for (const [key, val] of Object.entries(v ?? {})) s = s.split(`{${key}}`).join(String(val));
  return s;
}

const base = { name: "Maya", goals: 0, interests: 0 };

describe("OBJ-TODAY-02 — rhythm is named only when a rhythm read exists", () => {
  it("`low` confidence does NOT name rhythm (the pre-fix behaviour)", () => {
    const parts = whyLineParts({ ...base, recentCount: 4, confidence: "low" });
    expect(String(parts.vars.list)).not.toContain("today.intent.why.rhythm");
    expect(whyLineFor({ ...base, recentCount: 4, confidence: "low" }, tEn)).not.toMatch(/rhythm/i);
  });

  it("`none` still does not name rhythm", () => {
    expect(String(whyLineParts({ ...base, recentCount: 4, confidence: "none" }).vars.list))
      .not.toContain("today.intent.why.rhythm");
  });

  it("`medium` and `high` DO name it — the guard is not a blanket removal", () => {
    for (const confidence of ["medium", "high"]) {
      expect(String(whyLineParts({ ...base, recentCount: 4, confidence }).vars.list))
        .toContain("today.intent.why.rhythm");
    }
  });

  it("negative control: the pre-fix rule (`confidence !== 'none'`) would have named it at low", () => {
    // The exact predicate that shipped, applied to the same input. If someone
    // restores it, the first case above goes red — this pins WHY.
    const preFixNamesRhythm = (confidence: string) => confidence !== "none";
    expect(preFixNamesRhythm("low")).toBe(true);
    expect(String(whyLineParts({ ...base, recentCount: 4, confidence: "low" }).vars.list))
      .not.toContain("today.intent.why.rhythm");
  });

  it("Hebrew takes the same path — no rhythm token, no English leak", () => {
    const line = whyLineFor({ ...base, name: "מאיה", recentCount: 4, confidence: "low" }, tHe);
    expect(line).not.toMatch(/[A-Za-z]/);
    expect(line).not.toContain(he["today.intent.why.rhythm"]);
  });
});

describe("OBJ-TODAY-02 — the live ledger decides whether there are moments", () => {
  it("a stale report of 4 moments over an empty ledger falls to the day-0 line", () => {
    const parts = whyLineParts({ ...base, recentCount: 0, confidence: "high", inputsUsed: { momentCount: 4 } });
    expect(parts.key).toBe("today.intent.why.day0");
    expect(whyLineFor({ ...base, recentCount: 0, confidence: "high", inputsUsed: { momentCount: 4 } }, tEn))
      .not.toMatch(/recent moments|rhythm/i);
  });

  it("with a live ledger the report still refines the count", () => {
    expect(whyLineParts({ ...base, recentCount: 5, confidence: "none", inputsUsed: { momentCount: 0 } }).key)
      .toBe("today.intent.why.day0");
    expect(whyLineParts({ ...base, recentCount: 5, confidence: "none", inputsUsed: { momentCount: 2 } }).key)
      .toBe("today.intent.why.list");
  });
});

describe("OBJ-TODAY-02 — the prompt card stops asserting unused inputs", () => {
  const card = read("components/overview/PromptCaptureCard.tsx");
  const overview = read("components/tabs/OverviewTab.tsx");

  it("PromptCaptureCard no longer prints the authored whySimple claim", () => {
    // Comments stripped: the prop's doc-comment names the retired key on
    // purpose, so the reader knows what this card stopped saying.
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("today.intent.whySimple");
  });

  it("it renders the derived line the hub passes, and nothing when there is none", () => {
    expect(card).toMatch(/whyLine\?:\s*string/);
    expect(card).toMatch(/\{whyLine\s*&&\s*\(/);
  });

  it("OverviewTab feeds it the SAME whyLineFor result the hero gets", () => {
    expect(overview).toMatch(/whyLine=\{focusWhy\}/);
    expect(overview).toMatch(/why=\{focusWhy\}/);
    expect(overview).toMatch(/whyLineFor\(/);
  });

  it("negative control: the shipped markup fails both card assertions", () => {
    const shipped = `        <span dir="auto">
          <span className="font-extrabold">{t("today.intent.why")}</span>{" "}
          {t("today.intent.whySimple")}
        </span>`;
    expect(shipped).toContain("today.intent.whySimple");
    expect(/\{whyLine\s*&&\s*\(/.test(shipped)).toBe(false);
  });
});
