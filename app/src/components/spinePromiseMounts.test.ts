/**
 * Masterplan 1.5 + 1.6 — spine mounts + first-run promise (SOURCE scan,
 * Screening.firewall.test.ts style; node env, no DOM).
 *
 * 1.5 — SpineRibbon is mounted on Journal (→ weekly story) and Academy/
 *       Masterclasses (→ Development Map) — B-PLAY-18 removed the Masterclasses
 *       mount (unverified claim, FU#23), each with its registered
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

import { todayLiveSource } from "../testTodaySource";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");

const journal = read("tabs/JournalTab.tsx");
const academy = read("sections/Masterclasses.tsx");
const overview = todayLiveSource();
const onboarding = read("auth/OnboardingFlow.tsx");

describe("masterplan 1.5 — SpineRibbon mounts", () => {
  it("the registered elev.spine.* strings: journal kept, academy deleted with its mount (B-PLAY-18)", () => {
    for (const dict of [spineEn, spineHe]) {
      expect(dict["elev.spine.journal"]).toBeTruthy();
      expect(dict["elev.spine.academy"]).toBeUndefined();
    }
  });

  it("B-ASKJB-16: JournalTab no longer mounts or imports SpineRibbon (the density toggle is the door to Story)", () => {
    expect(journal).not.toMatch(/import \{ SpineRibbon \}/);
    expect(journal).not.toMatch(/<SpineRibbon\b/);
    expect(journal).not.toContain("journal-spine-ribbon");
    // The door it duplicated is still there: TimelineTab's density toggle.
    const timeline = read("tabs/TimelineTab.tsx");
    // Critic r2: stamped as a module on #/timeline; on #/journal it rides in
    // journal-header (still rendered — the door to Story never goes away).
    expect(timeline).toContain('data-module={story ? "timeline-density" : undefined}');
    expect(timeline).toContain("densityToggle={densityToggle}");
    expect(journal).toContain("{densityToggle}");
    expect(timeline).toContain("onClick={() => setActiveTab(d.tab)}");
  });

  it("B-PLAY-18: Masterclasses no longer imports or mounts SpineRibbon (no academy-spine module)", () => {
    expect(academy.length).toBeGreaterThan(1000);
    expect(academy).not.toMatch(/import \{ SpineRibbon \}/);
    expect(academy).not.toMatch(/<SpineRibbon\b/);
    expect(academy).not.toContain("academy-spine");
    expect(academy).not.toContain("{spineRibbon}");
    expect(academy).not.toContain('t("elev.spine.academy")');
  });

  it("Rule A — SpineRibbon never mounts on Today (OverviewTab)", () => {
    expect(overview).not.toMatch(/SpineRibbon/);
  });
});

describe("B-SHELL-36 supersedes the first-run promise tour", () => {
  it("Ready is the authored card with one accept; the summary and promise modules are retired", () => {
    expect(onboarding).toContain("export function StepReady");
    expect(onboarding).toContain('t("ob.first.try")');
    expect(onboarding).not.toMatch(/PromiseCard|promiseText|promise_shown|ob.step.ready.labelDomains/);
  });
  it("no AI-powered claim is introduced", () => {
    expect(onboarding).not.toMatch(/AI-powered|artificial intelligence|בינה מלאכותית/i);
  });
});
