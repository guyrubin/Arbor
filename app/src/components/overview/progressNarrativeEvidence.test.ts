import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * TODAY-6 — narrative earns its card (2026-07-23 next-level wave 3).
 *
 * AR-CAP-03 acceptance: "every inference links to source signals". The vitest
 * env is node-only, so these are SOURCE-BASED structural guards in the house
 * pattern (todayConsolidation.test.ts / clinicalFirewall.wave3.test.ts) that
 * pin the shape making the acceptance true at runtime:
 *   1. every evidence row in ProgressNarrative is a TAPPABLE button passing
 *      its signal id through onOpenEvidence(item.id) — not a dead label,
 *   2. OverviewTab hands the narrative JOURNAL SIGNAL ids (the `moment-`/
 *      `play-` prefixes buildTimeline assigns) and routes a tapped id through
 *      the requestJournalFocus seam before opening the Journal,
 *   3. JournalTab consumes the request once, anchors every row with a
 *      journal-signal-<id> element id, and scrolls the cited row into view,
 *   4. the deep-link payload is the bare signal id — no derived score rides
 *      along (clinical-firewall CONDITION on TODAY-6),
 *   5. the "What changed" cell carries ONE NON-COMPARATIVE current-week count
 *      built from the weekCount template, present in EN + HE (the original
 *      week-vs-week sentence was retired as a firewall breach — see the
 *      describe block below and ProgressNarrative.firewall.test.ts).
 * (The banned-token scan over the template lives with its wave-3 siblings in
 * lib/clinicalFirewall.wave3.test.ts.)
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const narrative = stripComments(read("components/overview/ProgressNarrative.tsx"));
const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
const journal = stripComments(read("components/tabs/JournalTab.tsx"));
const context = stripComments(read("context/ArborContext.tsx"));

describe("TODAY-6 — evidence rows deep-link to their source entries", () => {
  it("each evidence row is a button passing its id through onOpenEvidence(item.id)", () => {
    expect(narrative).toMatch(/onClick=\{\(\)\s*=>\s*onOpenEvidence\(item\.id\)\}/);
    // and the row is a real button, not a bare <li> label
    expect(narrative).toMatch(/evidence\.map\(\(item\)\s*=>\s*\(\s*<li[\s\S]{0,200}<button/);
  });

  it("onOpenEvidence accepts an optional id; 'Open source moments' still opens the whole journal", () => {
    expect(narrative).toMatch(/onOpenEvidence:\s*\(evidenceId\?:\s*string\)\s*=>\s*void/);
    expect(narrative).toMatch(/onClick=\{\(\)\s*=>\s*onOpenEvidence\(\)\}/);
  });

  it("OverviewTab hands the narrative journal signal ids (moment-/play- prefixes)", () => {
    expect(overview).toMatch(/id:\s*`moment-\$\{item\.id\}`/);
    expect(overview).toMatch(/id:\s*`play-\$\{item\.id\}`/);
  });

  it("OverviewTab routes a tapped id through requestJournalFocus, then opens the Journal", () => {
    expect(overview).toMatch(/if\s*\(evidenceId\)\s*requestJournalFocus\(evidenceId\);\s*setActiveTab\("journal"\)/);
  });

  it("the seam carries ONLY the signal id — no derived score in the payload (firewall)", () => {
    expect(context).toMatch(/requestJournalFocus\s*=\s*\(signalId:\s*string\)\s*=>\s*setPendingJournalFocusId\(signalId\)/);
    // consume-once contract exists, mirroring the capture seam
    expect(context).toMatch(/consumeJournalFocus\s*=\s*\(\)\s*=>\s*setPendingJournalFocusId\(null\)/);
  });

  it("JournalTab consumes the request once and scrolls the cited row into view", () => {
    expect(journal).toMatch(/pendingJournalFocusId/);
    expect(journal).toMatch(/consumeJournalFocus\(\)/);
    expect(journal).toMatch(/journal-signal-\$\{focusId\}/);
    expect(journal).toMatch(/scrollIntoView/);
  });

  it("every journal row carries the journal-signal-<id> anchor the deep-link targets", () => {
    expect(journal).toMatch(/id=\{`journal-signal-\$\{signal\.id\}`\}/);
  });

  it("the highlighted row uses tokens only (green register, no hex literal)", () => {
    expect(journal).toMatch(/focused\s*\?\s*"var\(--arbor-green-soft\)"/);
  });
});

describe("TODAY-6 — 'What changed' carries ONE non-comparative week count", () => {
  // AR-UI 2026-08-12: the original TODAY-6 sentence was a week-vs-week
  // comparative ("N moments this week vs M last week") inside a cell titled
  // "What changed for <name>" — a trend delta about the CHILD on a child-data
  // parent surface, which the standing firewall bans. The cell keeps the
  // parent's capture momentum as a single current-week count; the prior-window
  // number is no longer rendered (guard: ProgressNarrative.firewall.test.ts).
  it("ProgressNarrative renders the weekCount template alongside changedBody", () => {
    expect(narrative).toMatch(/t\("today\.narrative\.weekCount",\s*\{[\s\S]*?moments:\s*plural\("today\.narrative\.changedBody\.moments",\s*recentBehaviors\.length\)[\s\S]*?\}\)/);
    expect(narrative).toMatch(/\$\{copy\.changedBody\}\s*\$\{weekCount\}/);
  });

  it("no prior-window count is interpolated into the rendered copy", () => {
    expect(narrative).not.toMatch(/\blastWeek\s*:/);
    expect(narrative).not.toMatch(/t\(\s*["'][^"']*["'][^)]*momentsLastWeek/);
  });

  it("weekCount + openItem exist in BOTH dictionaries (HE/EN parity)", () => {
    for (const key of ["today.narrative.weekCount", "today.narrative.openItem"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
    for (const dict of [en, he]) {
      expect(dict["today.narrative.weekCount"]).toContain("{moments}");
      expect(dict["today.narrative.weekCount"]).not.toContain("{lastWeek}");
    }
    // the retired comparative key is gone from both dictionaries
    expect(en["today.narrative.weekCompare"]).toBeUndefined();
    expect(he["today.narrative.weekCompare"]).toBeUndefined();
  });

  it("the narrative component emits no verdict primitive (wave-3 token classes)", () => {
    for (const tok of ["intensityTrend", "TrendingUp", "TrendingDown", "conic-gradient", "ProgressRing", "milestonesPercent", "score.overall"]) {
      expect(narrative, `ProgressNarrative references verdict token "${tok}"`).not.toContain(tok);
    }
    expect(narrative).not.toMatch(/\b(easing|rising|intensifying)\b/i);
  });
});

/* ── RUN-19 — one empty sentence, not two ────────────────────────────────────
   "What changed" and "Your evidence" both rendered the identical "There are
   not enough confirmed moments…" line on an empty picture. The evidence cell
   now has its own one-line empty state (with the journal button as the single
   next action); the sentence renders once. */
describe("RUN-19 — Developing picture renders the empty sentence once", () => {
  it("NEGATIVE CONTROL — the pre-fix shape rendered copy.noChange in BOTH cells", () => {
    const preFix = `<NarrativeCell icon="moving" title={copy.changed} body={hasEvidence ? \`\${copy.changedBody} \${weekCount}\` : copy.noChange} />
          ))}</ul> : <p className="mt-3 text-[11px] leading-relaxed">{copy.noChange}</p>}`;
    expect((preFix.match(/copy\.noChange/g) ?? []).length).toBe(2);
  });

  it("copy.noChange is rendered exactly once (the What-changed cell); the evidence cell uses its own line", () => {
    const rendered = narrative.slice(narrative.indexOf("return ("));
    expect((rendered.match(/copy\.noChange/g) ?? []).length).toBe(1);
    expect(rendered).toContain("{copy.evidenceEmpty}");
  });

  it("the evidence empty line exists in EN + HE and differs from noChange", () => {
    for (const dict of [en, he]) {
      expect(dict["today.narrative.evidenceEmpty"]).toBeTruthy();
      expect(dict["today.narrative.evidenceEmpty"]).not.toBe(dict["today.narrative.noChange"]);
    }
  });
});
