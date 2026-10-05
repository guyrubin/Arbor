/**
 * GP-06 — the Growth hub's primary move has to BE on the Growth hub.
 *
 * The surface contract has declared `primaryMove: "notice-milestone"` for the
 * `development` route since it was written (lib/surfaceContract.ts). What the
 * hub actually did was open the SCREENER from its hero CTA, while marking a
 * milestone cost four taps: Growth → Milestones pill → domain row → expand the
 * band → "Seen it". The one act the hub exists for was the hardest thing on
 * the page, and the anxiety surface was in the hero.
 *
 * This is a SOURCE scan (the suite runs in `environment: "node"`, the repo's
 * Screening.firewall.test.ts / whyLineTrustChain.test.ts pattern). Two habits
 * this repo learned the hard way are enforced below:
 *   · \r\n is normalised BEFORE any matching (the tree is CRLF), and
 *   · every extraction is asserted truthy before it is matched against, so a
 *     scan that silently extracts "" can never pass vacuously.
 * Each rule also carries a NEGATIVE CONTROL built from the pre-change source,
 * so a matcher that rots into something permissive fails here first.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(app, rel), "utf8").replace(/\r\n/g, "\n");

const DEV_TAB = read("components/tabs/DevelopmentTab.tsx");

/** The hero CTA block, extracted by its pinned testId. */
function heroCtaBlock(src: string): string {
  const m = src.match(/cta=\{\{[\s\S]{0,600}?testId: "growth-hero-cta",[\s\S]{0,40}?\}\}/);
  return m ? m[0] : "";
}

/* ── The pre-change source, verbatim. Every matcher below must reject it. ── */
const OLD_HERO_CTA = `          cta={{
            label: t("elev.hero.growth.cta"),
            onClick: () => setCheckOpen(true),
            icon: <Icon name="assignment_turned_in" size={16} />,
            testId: "growth-hero-cta",
          }}`;
const OLD_FOCUS_ACTIONS = `            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => weeklyFocus.action === "check" ? setCheckOpen(true) : setActiveTab("daily-play")}>
              <button type="button" onClick={() => setActiveTab("milestones")}>
            </div>`;

describe("GP-06 negative controls — the matchers reject the pre-change hub", () => {
  it("the old hero CTA (opens the screener) is extracted but fails the rule", () => {
    const block = heroCtaBlock(OLD_HERO_CTA);
    expect(block).toBeTruthy(); // extraction proven before it is judged
    expect(block).toContain("setCheckOpen(true)");
    expect(block).not.toContain("focusObserveRow");
  });

  it("the old weekly-focus card carried no observe control", () => {
    expect(OLD_FOCUS_ACTIONS).not.toMatch(/data-testid="growth-observe-(yes|not_sure|not_yet)"/);
    expect(OLD_FOCUS_ACTIONS).not.toContain("observeFocusMilestone");
  });
});

describe("GP-06 — the hub's declared primaryMove is the observe row", () => {
  it("the contract still declares notice-milestone for the development hub", () => {
    const contract = SURFACE_CONTRACTS.find((c) => c.route === "development");
    expect(contract).toBeTruthy();
    expect(contract!.primaryMove).toBe("notice-milestone");
    expect(contract!.depth).toBe(0);
  });

  // W2-GROWTH r1: the hero's scroll-to CTA is DELETED — it only scrolled to
  // the row, and the row now sits in the first 375 viewport. The stamp moved
  // from the 851 px focus <section> onto the observe GROUP itself, so the
  // sweep's above-the-fold check measures the control, not a container edge.
  it("the stamp sits on the observe group, never on a container; no scroll-to hero CTA", () => {
    expect(heroCtaBlock(DEV_TAB)).toBe("");
    expect(DEV_TAB).not.toContain("focusObserveRow");
    const stamps = DEV_TAB.match(/data-primary-move=/g) ?? [];
    // W2-GROWTH r2 (Law 7): ONE literal — check:framework counts the source.
    // The same element is the observe group, or (zero-focus) holds Review milestones.
    expect(stamps).toHaveLength(1);
    expect(DEV_TAB).toMatch(/role=\{weeklyFocus\.milestoneId \? "group" : undefined\}\s+aria-label=\{weeklyFocus\.milestoneId \? t\("elev\.waveR\.growth\.observe\.aria"\) : undefined\}\s+data-primary-move="notice-milestone"/);
    expect(DEV_TAB).not.toMatch(/<section[^>]*data-primary-move/);
  });

  it("Law 7: the contract names the in-page disclosure the hub demotes into", () => {
    const dev = SURFACE_CONTRACTS.find((c) => c.route === "development");
    expect(dev?.demotionTarget).toBe("disclosure");
    expect(DEV_TAB).toContain('data-module-disclosure="growth-more"');
    const fc = readFileSync(path.join(app, "..", "scripts", "framework-check.mjs"), "utf8");
    expect(fc).toContain('a leaf that demotes in page declares demotionTarget "disclosure"');
    expect(fc).not.toMatch(/LEGACY_DISCLOSURE_TARGET = new Set\([^)]*"development"/);
  });

  it("the observe answers carry the card's weight; nothing below them is a filled button", () => {
    const row = DEV_TAB.slice(DEV_TAB.indexOf('data-testid="growth-observe-row"'));
    expect(row).toContain('"var(--arbor-paper-elevated)"');
    expect(row).toContain('"var(--arbor-ink)"');
    expect(row).toContain('"var(--arbor-rule-strong)"');
    // "Choose an activity" is a text link now (no clay/sapphire fill)
    const tryBtn = DEV_TAB.match(/data-testid="growth-focus-try"[^>]*>/)?.[0] ?? "";
    expect(tryBtn).toBeTruthy();
    expect(tryBtn).not.toMatch(/background:/);
    // one --gradient-cta on the page, on the zero-focus stamped control; no clay fills
    expect(DEV_TAB.match(/var\(--gradient-cta\)/g)).toHaveLength(1);
    expect(DEV_TAB).toMatch(/data-primary-move="notice-milestone"[\s\S]{0,2500}?data-testid="growth-focus-review"[\s\S]{0,300}?var\(--gradient-cta\)/);
    expect(DEV_TAB).not.toContain('background: "var(--arbor-clay)"');
  });

  it("the Development Check keeps its own home — the neutral pointer row", () => {
    // The screener must stay reachable; GP-06 moves it OFF the hero, it does
    // not delete it. The pointer row is that home.
    expect(DEV_TAB).toContain('data-testid="dev-watching-pointer"');
    const pointer = DEV_TAB.match(/data-testid="dev-watching-pointer"/);
    expect(pointer).toBeTruthy();
    expect(DEV_TAB).toMatch(/onClick=\{\(\) => setCheckOpen\(true\)\}[\s\S]{0,200}?dev-watching-pointer/);
  });
});

describe("GP-06 — the three-state observe row lives on the hub", () => {
  const row = DEV_TAB.match(/data-testid="growth-observe-row"[\s\S]*?growth-observe-row-end|data-testid="growth-observe-row"[\s\S]{0,3000}/);

  it("renders all three observation states", () => {
    expect(row).toBeTruthy();
    for (const status of ["yes", "not_sure", "not_yet"]) {
      expect(DEV_TAB).toContain(`data-testid={\`growth-observe-\${status}\`}`);
    }
    // The three states are generated from ONE list, so they cannot drift apart.
    expect(DEV_TAB).toMatch(/\["yes",[\s\S]{0,200}?\["not_sure",[\s\S]{0,120}?\["not_yet",/);
  });

  it("writes through the SAME seam the Milestones map uses", () => {
    expect(DEV_TAB).toContain("setMilestoneObservation");
    expect(DEV_TAB).toMatch(/observeFocusMilestone[\s\S]{0,400}?setMilestoneObservation\(milestoneId, status\)/);
  });

  it("celebrates only a FRESH yes, through the capped shared burst", () => {
    expect(DEV_TAB).toMatch(/if \(status !== "yes" \|\| wasChecked\) return;/);
    expect(DEV_TAB).toContain('fireCelebration({ kind: "milestone" })');
    expect(DEV_TAB).toContain('from "../../lib/celebrate"');
  });

  it("keeps 44px targets on the primary move (GP-12)", () => {
    const controls = DEV_TAB.match(/data-testid=\{`growth-observe-\$\{status\}`\}[\s\S]{0,600}?className="([^"]+)"/);
    expect(controls).toBeTruthy();
    expect(controls![1]).toContain("min-h-11");
  });

  it("CLINICAL FIREWALL — the observe row grades nothing", () => {
    const block = DEV_TAB.slice(
      DEV_TAB.indexOf('data-testid="growth-observe-row"'),
      DEV_TAB.indexOf('data-testid="growth-observe-row"') + 2600,
    );
    expect(block).toBeTruthy();
    expect(block).not.toMatch(/%|\bscore\b|\bpercentile\b|\bon[\s-]?track\b|\bbehind\b|\bdelay(ed)?\b/i);
    // "Not yet" must not be tinted as a failure: the only tone fork in the row
    // is selected-vs-unselected, identical for all three answers.
    expect(block).not.toMatch(/status === "not_yet" \?/);
  });
});
