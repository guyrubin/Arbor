import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { recommend } from "../practice/signals";
import { composeWeek } from "../practice/journey";
import type { DomainBand } from "../practice/signals";
import type { MissionRecord, PracticeDomain } from "../types";
import { en as dictEn, he as dictHe } from "./i18n";

/* OBJ-GROWTH-05 — law 1 bans weakest-domain pointers, and three surfaces
   printed one anyway at 7208d0db:
     · #/copilot   "This is currently the area with the least practice signal"
                   (signals.ts:633) — identical at day-0, where there was no
                   signal for anything to be least of.
     · #/journey   "Focus: Language" from recommend()'s lowest-band-wins, and
                   the aimed extras laid out weakest-first (journey.ts:57-58).
     · #/masterclasses  "A good place to explore next" / "A great area to
                   nurture this week: <lowest-share domain>", rendered against
                   0 noticed milestones and 0 logs.

   The ranking may still ORDER things internally. It may never be named, and it
   may no longer decide the pick. Guarded in two ways: a dictionary/source scan
   over the files this branch owns, and behaviour — recommend() and composeWeek()
   must return the same thing whatever the bands say. */

const SRC = path.resolve(__dirname, "..");
const POINTER = /least practice|weakest|lowest[ -](band|share|scoring)|explore next/i;

/** Files this item owns. B-PLAY-01: lib/i18n.ts is scanned too — the retired
 *  `foryou.header` ("A good place to explore next") is deleted, so the shipped
 *  dictionary itself is now held to the rule. */
function scanTargets(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const elevDir = path.join(SRC, "lib", "i18nElevation");
  for (const f of readdirSync(elevDir)) {
    if (f.endsWith(".ts") && !f.endsWith(".test.ts")) {
      out.push({ name: `i18nElevation/${f}`, text: readFileSync(path.join(elevDir, f), "utf8") });
    }
  }
  const practiceDir = path.join(SRC, "practice");
  for (const f of readdirSync(practiceDir)) {
    if (f.endsWith(".ts") && !f.endsWith(".test.ts")) {
      out.push({ name: `practice/${f}`, text: readFileSync(path.join(practiceDir, f), "utf8") });
    }
  }
  for (const rel of [
    ["components", "sections", "AcademyForYou.tsx"],
    ["components", "sections", "ScholarHubCard.tsx"],
    ["consult", "clinicianSummary.ts"],
    ["lib", "i18n.ts"],
  ]) {
    out.push({ name: rel.join("/"), text: readFileSync(path.join(SRC, ...rel), "utf8") });
  }
  return out;
}

/** Comments explain the retired defect by name; only what ships counts. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const band = (domain: PracticeDomain, signal: number): DomainBand => ({
  domain,
  signal,
  band: signal < 40 ? "emerging" : "strong",
  basis: [],
});
const ALL_BANDS = (weakest: PracticeDomain): DomainBand[] =>
  (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[]).map((d) =>
    band(d, d === weakest ? 1 : 90),
  );
const mission = (domain: PracticeDomain, n: number): MissionRecord[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m-${domain}-${i}`,
    missionId: "x",
    domain,
    date: "2026-09-01",
    timestamp: "2026-09-01T10:00:00.000Z",
    completed: true,
  })) as unknown as MissionRecord[];

describe("OBJ-GROWTH-05 (a) — no pointer word ships", () => {
  it("no owned source file names a ranking of the child's areas", () => {
    const offenders = scanTargets()
      .map(({ name, text }) => ({ name, hits: stripComments(text).match(new RegExp(POINTER, "gi")) ?? [] }))
      .filter((f) => f.hits.length > 0);
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL — the pre-fix strings all trip the same scan", () => {
    const preFix = [
      "This is currently the area with the least practice signal. Small daily reps move it fastest.",
      '"foryou.header": "A good place to explore next",',
      "// Day-domain layout: focus on Mon/Wed/Sat; others fill the rest, weakest first.",
      "picks the lowest-scoring domain via focusDomain",
    ];
    for (const line of preFix) expect(POINTER.test(line)).toBe(true);
  });
});

describe("OBJ-GROWTH-05 (b) — the pick no longer follows the band", () => {
  it("recommend() returns the same domain whichever domain is weakest", () => {
    const picks = (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[]).map(
      (weakest) => recommend(ALL_BANDS(weakest), []).domain,
    );
    expect(new Set(picks).size).toBe(1);
  });

  it("the charter aim the caller passes wins, and practice breaks the tie", () => {
    expect(recommend(ALL_BANDS("language"), [], ["social"]).domain).toBe("social");
    expect(recommend(ALL_BANDS("language"), mission("emotional", 3)).domain).toBe("emotional");
  });

  it("the why-line is an i18n key, and day-0 gets its own", () => {
    expect(recommend(ALL_BANDS("language"), []).whyKey).toBe("elev.growthTruth.focus.why.day0");
    expect(recommend(ALL_BANDS("language"), mission("social", 1)).whyKey).toBe(
      "elev.growthTruth.focus.why.practised",
    );
  });

  it("composeWeek lays the aimed extras out identically whatever the bands say", () => {
    const rec = recommend(ALL_BANDS("language"), []);
    const a = composeWeek(ALL_BANDS("social"), rec, "2026-09-07");
    const b = composeWeek(ALL_BANDS("emotional"), rec, "2026-09-07");
    expect(a.map((d) => d.extra.title)).toEqual(b.map((d) => d.extra.title));
  });

  it("NEGATIVE CONTROL — the pre-fix selectors are band-driven", () => {
    const preFixRecommend = (bands: DomainBand[]) => [...bands].sort((x, y) => x.signal - y.signal)[0].domain;
    expect(preFixRecommend(ALL_BANDS("social"))).toBe("social");
    expect(preFixRecommend(ALL_BANDS("emotional"))).toBe("emotional");
    const preFixOthers = (bands: DomainBand[], focus: PracticeDomain) =>
      (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[])
        .filter((d) => d !== focus)
        .sort((x, y) => (bands.find((b) => b.domain === x)?.signal ?? 50) - (bands.find((b) => b.domain === y)?.signal ?? 50));
    expect(preFixOthers(ALL_BANDS("social"), "language")[0]).toBe("social");
  });
});

/* B-PLAY-01 — Learn never names the weakest domain. `focusDomain` is the
   lowest-scoring domain (growth/devScore.ts); the For You card printed it as
   its chip, in "Arbor suggests starting with {domain}" and in "Courses to
   explore for {domain}". The ranking may order the courses; it is never named. */
describe("B-PLAY-01 — the For You card names no domain", () => {
  const dict = stripComments(readFileSync(path.join(SRC, "lib", "i18n.ts"), "utf8"));
  const foryouValues = [...dict.matchAll(/"(foryou\.[^"]+)":\s*"([^"]*)"/g)].map((m) => ({ key: m[1], value: m[2] }));

  it("scans a non-empty foryou.* set in both languages", () => {
    expect(foryouValues.length).toBeGreaterThan(10);
  });

  it("no foryou.* value carries a {domain} placeholder (EN + HE)", () => {
    const offenders = foryouValues.filter((v) => v.value.includes("{domain}")).map((v) => v.key);
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL — the pre-fix values trip the same check", () => {
    for (const pre of ["Arbor suggests starting with {domain} — here's a gentle place", "Courses to explore for {domain}"]) {
      expect(pre.includes("{domain}")).toBe(true);
    }
  });

  it("AcademyForYou renders no labelFor() output and no ring/bar inside academy-foryou-*", () => {
    const src = stripComments(readFileSync(path.join(SRC, "components", "sections", "AcademyForYou.tsx"), "utf8"));
    // labelFor survives only as the no-data gate (focusLabel is never rendered).
    expect(src).not.toMatch(/\{focusLabel\}/);
    expect(src).not.toMatch(/domain:\s*focusLabel/);
    expect(src).not.toMatch(/\{labelFor\(/);
    expect(src).not.toMatch(/academy-foryou-domain-(chip|row)/);
    expect(src).not.toMatch(/<RadialProgress|<ProgressBar/);
    expect(src).toContain('t("foryou.title", { name: firstName })');
  });
});

/* B-TODAY-05 — Arbor Noticed carried a norm-comparison pointer ("a skill
   that's typically seen by now hasn't been noted yet"), adjectives about the
   child ("intense, unsettled") and caution colour (peach). Today's card now
   counts only what the parent marked hard (4–5). */
describe("B-TODAY-05 — the noticed card: no norm pointer, no adjectives, no peach", () => {
  const NOTICED_BANNED = [/typically/i, /by now/i, /not yet/i, /intense/i, /unsettled/i, /עדיין לא/, /עצימים/, /סוערים/];
  const dict = stripComments(readFileSync(path.join(SRC, "lib", "i18n.ts"), "utf8"));
  const noticed = [...dict.matchAll(/"(noticed\.monitor\.[^"]+)":\s*"([^"]*)"/g)].map((m) => ({ key: m[1], value: m[2] }));

  it("scans the noticed.monitor.* values in both languages", () => {
    expect(noticed.filter((n) => n.key === "noticed.monitor.body.pattern")).toHaveLength(2);
  });

  it("no noticed.monitor.* value carries a banned word (EN + HE)", () => {
    const offenders = noticed.filter((n) => NOTICED_BANNED.some((re) => re.test(n.value))).map((n) => `${n.key}: ${n.value}`);
    expect(offenders).toEqual([]);
  });

  it("the milestone and both branches are deleted; the escalation sentence stays", () => {
    expect(noticed.some((n) => n.key === "noticed.monitor.body.milestone" || n.key === "noticed.monitor.body.both")).toBe(false);
    expect(noticed.filter((n) => n.key === "noticed.monitor.cta")).toHaveLength(2);
    const card = stripComments(readFileSync(path.join(SRC, "components", "sections", "ArborNoticedCard.tsx"), "utf8"));
    expect(card).toContain('t("noticed.monitor.cta")');
    expect(card).not.toMatch(/noticed\.monitor\.body\.(milestone|both)/);
  });

  it("NEGATIVE CONTROL — the pre-fix values trip the scan", () => {
    for (const pre of [
      "One {area} skill that's typically seen by now hasn't been noted yet for {name}.",
      "You've logged {n} intense, unsettled {area} moments recently.",
      "תיעדתם {n} רגעים עצימים וסוערים בתחום {area} לאחרונה.",
    ]) expect(NOTICED_BANNED.some((re) => re.test(pre)), pre).toBe(true);
  });

  // B-TODAY-21: the folded watch line lives in the What-changed card now.
  it("no --arbor-peach-* token in ArborNoticedCard or the What-changed card", () => {
    for (const rel of [["components", "sections", "ArborNoticedCard.tsx"], ["components", "overview", "WhatChanged.tsx"]]) {
      expect(readFileSync(path.join(SRC, ...rel), "utf8"), rel.join("/")).not.toMatch(/--arbor-peach-/);
    }
  });

  it("Today's gate is pattern-only: a milestone-only monitor signal renders nothing", async () => {
    const { todayNoticedSignal } = await import("../components/sections/ArborNoticedCard");
    const sig = (domain: string, reasons: string[], patternMoments = 0) => ({
      domain, level: "monitor", reasons, overdueMilestones: reasons.includes("milestone_overdue") ? [{}] : [], patternMoments,
    });
    const result = (domains: unknown[]) => ({ generatedAt: "", ageMonths: 48, domains, watchAreas: [], elevated: true } as never);
    expect(todayNoticedSignal(result([sig("language_communication", ["milestone_overdue"])]))).toBeNull();
    const picked = todayNoticedSignal(result([
      sig("language_communication", ["milestone_overdue"]),
      sig("attachment_regulation", ["behavior_pattern"], 4),
    ]));
    expect(picked?.domain).toBe("attachment_regulation");
  });
});

/* B-GROWTH-33 / FU#1 — the shipped dictionary (lib/i18n.ts) is held to the
   verdict vocabulary too, value by value: a parent-visible string may not say
   a child or an area is "flagged", "on track", "behind", or the "weakest" /
   "lowest". Every key of lib/i18n.ts is parent-visible (it is the UI
   dictionary); the internal `status: "on_track"` in stored screenings is a
   data value, never a dictionary string (lib/screening.ts), so it is out of
   scope by construction. */
describe("B-GROWTH-33 — no verdict word in any lib/i18n.ts value (FU#1)", () => {
  const VERDICT = /\b(flagged|on[\s-]track|behind|weakest|lowest)\b/i;

  it("EN: 0 values carry a verdict word", () => {
    const hits = Object.entries(dictEn).filter(([, v]) => VERDICT.test(String(v))).map(([k]) => k);
    expect(hits).toEqual([]);
  });

  it("HE: 0 values carry a Latin verdict word", () => {
    const hits = Object.entries(dictHe).filter(([, v]) => VERDICT.test(String(v))).map(([k]) => k);
    expect(hits).toEqual([]);
  });

  it("the unrendered verdict keys are deleted from both dictionaries", () => {
    for (const key of ["screen.last.flagged", "ov.attention.title"]) {
      expect(key in dictEn, key).toBe(false);
      expect(key in dictHe, key).toBe(false);
    }
  });

  it("POSITIVE CONTROL — the pre-fix strings trip the scan", () => {
    for (const pre of ["{n} area(s) flagged", "no areas flagged", "{n} flagged for professional input", "the weakest area", "on track"]) {
      expect(VERDICT.test(pre), pre).toBe(true);
    }
  });
});


/* Law 1 — child-record denominators on parent surfaces. A count of what the
   parent noticed is allowed; "{n} of {total}" and "{n}/{total}" are not.
   Scoped to the keys and sources these residues own (W1-CAREPRO extras):
   · B-ASKJB-19 — lib/childStory.ts "tracking {observed} of {total} milestones" */
const DENOMINATOR = /\{\w+\}\s*(of|\/|מתוך)\s*\{\w+\}|\d+\s*(of|\/|מתוך)\s*\d+/;
const SRC_ROOT = path.resolve(__dirname, "..");

describe("law 1 — no denominators on the Story card (B-ASKJB-19 residue)", () => {
  const storyKeys = ["story.milestones.one", "story.milestones.other", "story.wins.one", "story.wins.other"];

  it("the story count sentences exist in EN and HE and carry no denominator", () => {
    for (const k of storyKeys) {
      expect(dictEn[k], `en ${k}`).toBeTruthy();
      expect(dictHe[k], `he ${k}`).toBeTruthy();
      expect(DENOMINATOR.test(dictEn[k]), `en ${k}`).toBe(false);
      expect(DENOMINATOR.test(dictHe[k]), `he ${k}`).toBe(false);
      expect(/[A-Za-z]/.test(dictHe[k].replace(/\{\w+\}/g, "")), `he ${k} is Hebrew`).toBe(false);
    }
  });

  it("childStory.ts builds no 'of ${total}' sentence and takes no total", () => {
    const src = readFileSync(path.join(SRC_ROOT, "lib", "childStory.ts"), "utf8");
    expect(src.length).toBeGreaterThan(2000);
    expect(src).not.toMatch(/\} of \$\{/);
    expect(src).not.toMatch(/^\s*milestonesTotal\s*:/m);
  });

  it("POSITIVE CONTROL — the pre-fix sentence and template trip the scan", () => {
    expect(DENOMINATOR.test("Together you're tracking 4 of 10 milestones")).toBe(true);
    expect(DENOMINATOR.test("{observed} of {total} milestones")).toBe(true);
    expect(/\} of \$\{/.test("closers.push(`Together you're tracking ${i.milestonesObserved} of ${i.milestonesTotal} milestones`);")).toBe(true);
  });
});

import { translate as translateKey } from "./i18n";

/* · B-ASKJB-22 — PatternInsights "Resolved {resolved}/{total}" + "{count} of {total} moments" */
describe("law 1 — no denominators on the Behaviors patterns card (B-ASKJB-22 residue)", () => {
  const keys = ["elev.closeloop.pattern.resolvedSub.one", "elev.closeloop.pattern.resolvedSub.many"];

  it("the resolved sub-lines are counts in EN and HE (no {total}, no 'of'/'מתוך')", () => {
    for (const k of keys) {
      for (const lang of ["en", "he"] as const) {
        // elevation keys live in the merged dictionaries — read them through translate()
        const v = translateKey(lang, k);
        expect(v, `${lang} ${k} resolves`).not.toBe(k);
        expect(v, `${lang} ${k}`).toBeTruthy();
        expect(v, `${lang} ${k}`).not.toContain("{total}");
        expect(DENOMINATOR.test(v), `${lang} ${k}`).toBe(false);
        expect(/\b(of)\b|מתוך/.test(v), `${lang} ${k}`).toBe(false);
      }
    }
  });

  it("PatternInsights renders the resolved count alone — no '/', no total", () => {
    const src = readFileSync(path.join(SRC_ROOT, "components", "behaviors", "PatternInsights.tsx"), "utf8");
    expect(src).toContain('label={t("beh.pattern.resolved")} value={String(insights.resolved)}');
    expect(src).not.toMatch(/insights\.total|total: logs\.length/);
    expect(src).not.toMatch(/\$\{insights\.resolved\}\/\$\{/);
  });

  it("POSITIVE CONTROL — the pre-fix value and sub-lines trip the scan", () => {
    expect(/\$\{insights\.resolved\}\/\$\{/.test("value={`${insights.resolved}/${insights.total}`}")).toBe(true);
    expect(DENOMINATOR.test("{count} of {total} moments")).toBe(true);
    expect(DENOMINATOR.test("{count} מתוך {total} רגעים")).toBe(true);
  });
});

/* W2-CAREPRO c2 r1 (sharing P0) — the same DENOMINATOR scan over the consult
 * packet's dictionary keys and the week share a co-parent/viewer receives. */
describe("law 1 — no denominators in the packet keys or a viewer's week share (W2-CAREPRO c2 r1)", () => {
  it("every elev.packet.* key (EN + HE) is denominator-free", async () => {
    const care = await import("./i18nElevation/careHonesty");
    const keys = Object.keys(care.en).filter((k) => k.startsWith("elev.packet."));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      expect(DENOMINATOR.test(care.en[k]), `en ${k}`).toBe(false);
      expect(DENOMINATOR.test(care.he[k] ?? ""), `he ${k}`).toBe(false);
    }
  });

  it("resolveSharedPacket for a viewer week grant renders no '{n} of {total}' in EN or HE", async () => {
    const { buildGrant, LocalShareStore } = await import("../sharing/shares");
    const { resolveSharedPacket } = await import("../server/sharedPacket");
    const { itemText, sectionTitle } = await import("../consult/packet");
    const { WEEK_SHARE_SCOPES, WEEK_SHARE_DURATION } = await import("./shareScopes");
    const NOW = Date.parse("2026-10-05T09:00:00.000Z");
    const store = new LocalShareStore();
    const g = await store.create(buildGrant({ ownerUid: "u1", ownerEmail: "me@x.io", childId: "c1", childName: "Dylan", recipientEmail: "dana@x.io", role: "viewer", scopes: [...WEEK_SHARE_SCOPES], duration: WEEK_SHARE_DURATION }, NOW));
    const record = {
      profile: { name: "Dylan", age: 3, languages: ["English"] },
      logs: [{ behaviorType: "Moment", intensity: 1, timestamp: new Date(NOW - 86_400_000).toISOString(), trigger: "Sang the bath song" }],
      milestones: [
        { domain: "language_communication", title: "Says two words together", checked: true, observationStatus: "yes", observationUpdatedAt: new Date(NOW - 2 * 86_400_000).toISOString(), ageMonths: 24 },
        { domain: "language_communication", title: "Talks in conversation", checked: false, ageMonths: 36 },
      ],
      plans: [],
      memory: [],
    };
    const r = await resolveSharedPacket({ grantId: g.id, recipientEmail: "dana@x.io", shareStore: store, source: { load: async () => record } as never, now: NOW });
    if (r.status !== 200) throw new Error("unreachable");
    for (const lang of ["en", "he"] as const) {
      const text = r.view.sections.flatMap((s) => [sectionTitle(s as never, lang), ...s.items.map((i) => itemText(i as never, lang))]).join("\n");
      expect(text.length).toBeGreaterThan(20);
      expect(DENOMINATOR.test(text), text).toBe(false);
    }
    // NEGATIVE CONTROL: the pre-fix lines trip the scan.
    expect(DENOMINATOR.test("0 of 21 milestones on the 3 years checklists noticed so far")).toBe(true);
    expect(DENOMINATOR.test("{done} מתוך {total} אבני דרך")).toBe(true);
  });
});
