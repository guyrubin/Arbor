import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";
import { elevationEn, elevationHe } from "../../lib/i18nElevation/index";

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
    // B-TODAY-12: the focus hero and the grounded hard-moment step are ONE card.
    expect(overview).toMatch(/activeTodayAction\s*\?\s*\(\s*<TodayActionLoop\s*\/>\s*\)\s*:\s*todayChoice\.kind\s*===\s*"focus"\s*\|\|\s*\(todayChoice\.kind === "hardMoment" && hardMoment\)\s*\?\s*\(/);
    expect(count(overview, /<TodayActionLoop/g)).toBe(1);
    expect(count(overview, /<TodayRecommendation/g)).toBe(1);
    expect(count(overview, /<PromptCaptureCard/g)).toBe(1);
  });

  it("the hero owns the pre-accept state: capacity chips + accept row", () => {
    expect(hero).toMatch(/capacityMinutes/);
    expect(hero).toMatch(/accept\?:/);
  });

  it("TODAY-1 guard survives the merge: accept is offered ONLY from a real focus headline", () => {
    // B-TODAY-12: …or from a released pilot guide (re-checked at tap time).
    expect(overview).toMatch(/accept=\{stepIsHardMoment \|\| focusHeadline\s*\?/);
    expect(overview).toContain("if (focusHeadline) acceptTodayAction(focusHeadline, capacity);");
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

  it("section order: capture → day anchor → What changed → rail → noticed", () => {
    // W1 Rule A, as corrected by P1-A (2026-08-12): the primary-action anchor
    // comes FIRST so the one CTA clears the fold; the since-strip and the
    // first-steps rail follow it. The Daily Play section is a single JSX
    // instance (playSection const, placed by the budget logic) so it is
    // order-exempt.
    const order = [
      overview.indexOf("<QuickCaptureBar"),
      overview.indexOf("<TodayActionLoop"),
      // B-TODAY-21: since-strip + narrative + dev-map card → ONE card.
      overview.indexOf("<WhatChanged"),
      overview.indexOf("<FirstStepsRail"),
      overview.indexOf("<ArborNoticedCard"),
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


describe("W2 Today working density", () => {
  it("keeps every fixed capture door visibly labeled and the action illustration compact", () => {
    const capture = stripComments(read("components/overview/QuickCaptureBar.tsx"));
    const compactHero = stripComments(read("components/overview/TodayRecommendation.tsx"));
    // B-TODAY-10: four tiles share one visible-label class (LABEL), never hidden.
    expect(capture).toContain('<span className={LABEL}>{t("today.capture.text")}</span>');
    expect(capture).toContain('shortLabel: "elev.wave2Daily.capture.voice"');
    expect(capture).toContain('shortLabel: "elev.wave2Daily.capture.photo"');
    expect(capture).toContain('aria-label={t(label)}');
    expect(capture).toContain('{t("elev.capture.hard.tile")}</span>');
    expect(capture).toMatch(/const LABEL = "max-w-full truncate text-\[11\.5px\] sm:text-\[12px\] font-bold";/);
    expect(capture).not.toContain("hidden sm:inline");
    expect(capture).not.toContain("hidden lg:inline");
    expect(compactHero).toContain("HeroAvatar size={40}");
    expect(compactHero).not.toContain("min-h-[132px]");
    expect(compactHero).toContain("min-h-11 rounded-lg");
  });
});


describe("W2 Today supporting presentation", () => {
  it("keeps prompt capture, rhythm, and first steps compact without removing their working doors", () => {
    const prompt = stripComments(read("components/overview/PromptCaptureCard.tsx"));
    const cue = stripComments(read("components/coach/RhythmCue.tsx"));
    const rail = stripComments(read("components/onboarding/FirstStepsRail.tsx"));
    expect(prompt).toContain('{t("today.intent.captureTitle")}');
    expect(prompt).not.toContain('t("today.intent.doNow")');
    expect(prompt).toContain('promptKey ? t(promptKey) : t("elev.prompt.lead")');
    expect(cue).not.toContain('elev.evening.card.eyebrow');
    expect(cue).toContain('rounded-xl px-3 py-3');
    expect(cue).toContain('setActiveTab(visible.action)');
    expect(rail).toContain('min-h-11 w-full');
    expect(rail).not.toContain('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4');
    expect(rail).not.toContain('truncate');
    expect(rail).toContain('onClick={() => openStep(s.id, s.tab)}');
  });

  // B-TODAY-21: the dev-map count card ("{reached} of {total}") is deleted —
  // milestone counts stay in Growth. Today's door into Growth is now the
  // What-changed card's milestone / first / watch lines: real <button>s.
  it("keeps a genuine keyboard-operable door into Growth (the What-changed milestone lines)", () => {
    const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
    const card = stripComments(read("components/overview/WhatChanged.tsx"));
    expect(overview).toMatch(/line\.kind === "milestone"[^\n]*\n\s*setActiveTab\("development"\)/);
    expect(card).toMatch(/<button\s+type="button"\s+data-testid="what-changed-line"/);
    expect(overview).not.toMatch(/<section\s+onClick=\{\(\) => setActiveTab\("development"\)\}/);
    expect(overview).not.toContain("devscore.noticed");
  });
});

describe("B-TODAY-09 — no dead header button, no duplicate Ask row, no dead verdict plumbing", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const focusHook = stripComments(read("hooks/useTodaysFocus.ts"));
  // B-TODAY-21: ProgressNarrative is deleted; its successor is the card.
  const narrative = stripComments(read("components/overview/WhatChanged.tsx"));

  it("OverviewTab carries no setShowAiRail, no today-coach-row, no milestonesPercent, no weekAvg", () => {
    expect(overview.length).toBeGreaterThan(20_000);
    for (const tok of ["setShowAiRail", "today-coach-row", "milestonesPercent", "weekAvg", "momentsLastWeek"]) {
      expect(overview, tok).not.toContain(tok);
    }
  });

  it("the step card offers exactly one seeded ask, labelled 'Ask about this' (EN + HE)", () => {
    expect(count(overview, /t\("seed\.todayFocus"/g)).toBe(1);
    expect(overview).toContain('action={t("elev.today.askAbout")}');
    expect(overview).not.toContain('action={t("today.begin")}');
    expect(elevationEn["elev.today.askAbout"]).toBe("Ask about this");
    expect(elevationHe["elev.today.askAbout"]).toBe("לשאול על זה");
  });

  it("FocusSignals drops avg + milestonesPercent; the What-changed card carries no prior-window prop", () => {
    const type = focusHook.slice(focusHook.indexOf("export type FocusSignals"), focusHook.indexOf("};", focusHook.indexOf("export type FocusSignals")));
    expect(type).not.toMatch(/\bavg\s*:/);
    expect(type).not.toMatch(/milestonesPercent\s*:/);
    expect(narrative).not.toContain("momentsLastWeek");
  });

  it("negative control: the pre-fix header button is what the scan rejects", () => {
    expect('<button onClick={() => setShowAiRail(true)} className="hidden sm:inline-flex">').toContain("setShowAiRail");
  });
});

describe("B-TODAY-12 — one step card: the hard-moment offer folds into it as 'Say this'", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const hero = stripComments(read("components/overview/TodayRecommendation.tsx"));
  const slot = stripComments(read("components/overview/CompanionOfferSlot.tsx"));
  /** The day-anchor column: from its primary-move stamp to the end of the anchor module. */
  const anchor = overview.slice(overview.indexOf('data-primary-move="do-today-action"'), overview.indexOf("{showLifecycle &&"));

  it("the anchor tree holds ONE accept label and ONE gradient owner", () => {
    expect(anchor.length).toBeGreaterThan(1000);
    expect(count(anchor, /t\("today\.action\.make"\)/g)).toBe(1);
    expect(count(anchor, /<TodayRecommendation(?=[\s>])/g)).toBe(1);
    expect(count(anchor, /--arbor-gradient-primary/g)).toBe(0);
    expect(count(hero, /--arbor-gradient-primary/g)).toBe(1);
    expect(overview).not.toContain("HardMomentTodayOffer");
    expect(existsSync(path.join(SRC_ROOT, "components/overview/HardMomentTodayOffer.tsx"))).toBe(false);
  });

  it("Say-this renders through the shared SayThis, with the pilot label and an always-visible escalation", () => {
    expect(hero).toContain('import { SayThis } from "../ui/AiBlock";');
    expect(hero).toContain('data-testid="today-saythis"');
    expect(hero).toContain('data-testid="today-saythis-pilot"');
    expect(hero).toMatch(/role="note" data-testid="today-saythis-escalation"/);
    expect(hero).not.toMatch(/<details[\s\S]{0,200}today-saythis-escalation/);
    // B-TODAY-24: one Say-this line — the governed guide's, else the focus's own.
    expect(overview).toContain("sayThis={stepSayThis}");
    expect(overview).toMatch(/const stepSayThis: StepSayThis \| undefined = hardMomentSayThis\s*\?\? \(!stepIsHardMoment && focus\?\.sayThis/);
    expect(overview).toContain("text: locText(renderSayThis(hardMoment.card, firstName), hmLocale)");
    expect(overview).toContain("escalation: { title: t(\"hm.section.escalation\"), text: escalationText(hardMoment.card, hmLocale) }");
  });

  it("the SayThis controls reach 44 px (it now sits on Today's step)", () => {
    const ai = stripComments(read("components/ui/AiBlock.tsx"));
    expect(ai).toContain('className="text-[10px] min-h-11 px-1"');
    expect(ai).toContain("inline-flex min-h-11 items-center gap-1 px-1");
  });

  it("the coordinator's grounded step renders nothing extra on Today", () => {
    expect(slot).toMatch(/if \(offer\.kind === "grounded-step" && surface === "today"\) return null;/);
    expect(slot).not.toContain("HardMomentTodayOffer");
  });
});

describe("B-TODAY-17 — the drawer is gone: no feed, no check-in, no displaced play", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));

  it("no drawer toggle, no activity feed, no Live dot, no check-in mount", () => {
    for (const tok of ["showTools", "activityFeed", "hasRecentActivity", "ov.dailyTools", "today.live", "<DailyCheckinCard", "usePrideMoment"]) {
      expect(overview, tok).not.toContain(tok);
    }
    expect(existsSync(path.join(SRC_ROOT, "components/overview/DailyCheckinCard.tsx"))).toBe(false);
  });

  it("Today stamps at most four top-level modules in every state (budget 4 = contract)", () => {
    const stamps = [...overview.matchAll(/data-module="(today-[a-z]+)"/g)].map((m) => m[1]);
    expect(stamps.sort()).toEqual(["today-anchor", "today-changed", "today-lifecycle", "today-noticed", "today-rail"]);
    const budget = read("components/overview/todayModules.ts").match(/TODAY_MODULE_BUDGET = (\d+)/)?.[1];
    expect(Number(budget)).toBe(4);
    expect(read("lib/surfaceContract.ts")).toMatch(/route: "overview"[\s\S]{0,200}moduleBudget: 4/);
  });

  it("no wellness writer remains; export/erase still lists wellness", () => {
    const writers: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && /"wellness"/.test(fs.readFileSync(p, "utf8"))) writers.push(path.relative(SRC_ROOT, p).split(path.sep).join("/"));
      }
    };
    walk(SRC_ROOT);
    // lib/childData.ts is the export/erase list (CHILD_SUBCOLLECTIONS);
    // lib/childDataGroups.ts (B-CAREPRO-24) is its pure, import-free display
    // grouping for the trust center — it NAMES wellness under "moments" so the
    // parent sees everything Arbor keeps, and writes nothing.
    expect(writers.sort()).toEqual(["lib/childData.ts", "lib/childDataGroups.ts"]);
    const groups = read("lib/childDataGroups.ts");
    expect(groups).not.toMatch(/^import /m);
    expect(groups).not.toMatch(/\b(setDoc|addDoc|updateDoc|writeBatch|collection\()/);
  }, 60_000); // a whole-tree read; the default 5 s is too tight on a loaded machine

  it("#/daily-play stays reachable from Growth", () => {
    const nav = read("lib/navigation.ts");
    const growth = nav.slice(nav.indexOf('id: "growth"'));
    const next = growth.indexOf('id: "', 12);
    const growthBlock = next > 0 ? growth.slice(0, next) : growth;
    expect(growthBlock).toMatch(/tab: "daily-play"/);
  });
});
