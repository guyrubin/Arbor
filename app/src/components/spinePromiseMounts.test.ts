/**
 * Masterplan 1.5 + 1.6 — spine mounts + first-run promise (SOURCE scan,
 * Screening.firewall.test.ts style; node env, no DOM).
 *
 * 1.5 — SpineRibbon is mounted on Journal (→ weekly story) and Academy/
 *       Masterclasses (→ Development Map), each with its registered
 *       elev.spine.* string, placed BELOW the header/hero region.
 *       Rule A: SpineRibbon never mounts on Today (OverviewTab).
 * 1.6 — the first-run promise renders as the FINAL card of OnboardingFlow's
 *       Ready step: promise strings via i18nElevation/promise, one-shot
 *       track("promise_shown"), no "AI-powered" language.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en as spineEn, he as spineHe } from "../lib/i18nElevation/spine";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");

const journal = read("tabs/JournalTab.tsx");
const academy = read("sections/Masterclasses.tsx");
const overview = read("tabs/OverviewTab.tsx");
const onboarding = read("auth/OnboardingFlow.tsx");

describe("masterplan 1.5 — SpineRibbon mounts", () => {
  it("the registered elev.spine.* strings cover both surfaces (en+he)", () => {
    for (const dict of [spineEn, spineHe]) {
      expect(dict["elev.spine.journal"]).toBeTruthy();
      expect(dict["elev.spine.academy"]).toBeTruthy();
    }
  });

  it("JournalTab imports and mounts SpineRibbon with the journal spine string", () => {
    expect(journal).toMatch(/import \{ SpineRibbon \} from "\.\.\/ui\/SpineRibbon"/);
    expect(journal).toMatch(/<SpineRibbon\b/);
    expect(journal).toContain('t("elev.spine.journal"');
    expect(journal).toContain('testId="journal-spine-ribbon"');
    // One-direction deep link → the story timeline the journal feeds.
    expect(journal).toMatch(/onFollow=\{\(\) => setActiveTab\("timeline"\)\}/);
  });

  it("Journal ribbon sits BELOW the header + compose region (never above)", () => {
    const mount = journal.indexOf("journal-spine-ribbon");
    expect(mount).toBeGreaterThan(journal.indexOf('t("journal.title")'));
    expect(mount).toBeGreaterThan(journal.indexOf('t("journal.compose.title")'));
  });

  it("Masterclasses imports and mounts SpineRibbon with the academy spine string", () => {
    expect(academy).toMatch(/import \{ SpineRibbon \} from "\.\.\/ui\/SpineRibbon"/);
    expect(academy).toMatch(/<SpineRibbon\b/);
    expect(academy).toContain('t("elev.spine.academy")');
    expect(academy).toContain('testId="academy-spine-ribbon"');
    // One-direction deep link → the Development Map that tunes the catalog.
    expect(academy).toMatch(/onFollow=\{\(\) => setActiveTab\("development"\)\}/);
  });

  it("Academy ribbon sits BELOW the hero + catalog header (never above)", () => {
    const mount = academy.indexOf("academy-spine-ribbon");
    expect(mount).toBeGreaterThan(academy.indexOf('testId="academy-hub-hero"'));
    expect(mount).toBeGreaterThan(academy.indexOf('t("sec.master.sub")'));
  });

  it("Rule A — SpineRibbon never mounts on Today (OverviewTab)", () => {
    expect(overview).not.toMatch(/SpineRibbon/);
  });
});

describe("masterplan 1.6 — first-run promise in the Ready step", () => {
  it("OnboardingFlow imports the promise module and analytics", () => {
    expect(onboarding).toMatch(/import \{ promiseText \} from "\.\.\/\.\.\/lib\/i18nElevation\/promise"/);
    expect(onboarding).toMatch(/import \{ track \} from "\.\.\/\.\.\/lib\/analytics"/);
  });

  it("the promise card renders inside StepReady, before the submit CTA", () => {
    const stepReady = onboarding.slice(
      onboarding.indexOf("function StepReady"),
      onboarding.indexOf("// ── Root component"),
    );
    expect(stepReady).toContain("<PromiseCard name={name} />");
    // FINAL card: after the summary rows, before the submit CTA.
    const mount = stepReady.indexOf("<PromiseCard");
    expect(mount).toBeGreaterThan(stepReady.indexOf("ob.step.ready.labelAvatar"));
    expect(mount).toBeLessThan(stepReady.indexOf("onClick={onSubmit}"));
  });

  it("renders the full screenful: headline, three rhythms, data-lock line", () => {
    for (const key of [
      "elev.promise.headline",
      "elev.promise.daily", "elev.promise.weekly", "elev.promise.months",
      "elev.promise.lock",
    ]) {
      expect(onboarding).toContain(key);
    }
  });

  it('fires track("promise_shown") once (ref-guarded effect)', () => {
    expect(onboarding).toContain('track("promise_shown")');
    const card = onboarding.slice(
      onboarding.indexOf("function PromiseCard"),
      onboarding.indexOf("function StepReady"),
    );
    expect(card).toMatch(/tracked\.current\s*=\s*true/);
  });

  it('no "AI-powered" language anywhere in the onboarding flow', () => {
    expect(onboarding).not.toMatch(/AI-powered|artificial intelligence|בינה מלאכותית/i);
  });

  it("zero-regression guard: submit still stamps completion + queues the wow", () => {
    expect(onboarding).toContain("onboardingComplete: true");
    expect(onboarding).toContain("markWowPending()");
  });
});
