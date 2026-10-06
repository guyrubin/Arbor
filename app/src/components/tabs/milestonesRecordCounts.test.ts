/**
 * NEXTLEVEL critic round 1 — #/milestones counts from the record, a real
 * primary-move control, and a quiet "Born early?" for older children.
 *
 *  · P0 (B-GROWTH-35): the headline said "0 noticed" (an age-window count)
 *    while Growth said "5 noticed" and Care "3 since 19 Sep" from the same
 *    seed. The headline and the domain rows now read lib/pulse
 *    noticedMilestoneCounts — the helper Growth, Profile and the Development
 *    picture card read — unwindowed.
 *  · P1: data-primary-move sat on a display:contents wrapper 921 px tall.
 *    It now stamps "Seen any of these?" — three open items, each a 44 px Yes.
 *  · P1: "Born early?" took the fold for a 3-year-old; it leads only under
 *    24 months or with a gestation set, else it waits in a disclosure.
 *  · P1: one title — no "DEVELOPMENT MAP" eyebrow, no second disclaimer;
 *    no raw #fff / off-token green border.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { noticedMilestoneCounts } from "../../lib/pulse";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MS = strip(read("components/tabs/MilestonesTab.tsx"));

describe("NEXTLEVEL r1 — one noticed count across Milestones, Growth and Profile", () => {
  it("the headline and the domain rows read noticedMilestoneCounts, never the age window", () => {
    expect(MS).toContain("noticedMilestoneCounts(milestones)");
    expect(MS).toContain('{recordCounts.noticed} {t("ms.domainOf")}');
    expect(MS).toContain("recordCounts.byDomain[dom.id]");
    expect(MS).not.toMatch(/windowChecked/);
    expect(MS).not.toMatch(/\{s\.checked\}/);
    // Growth and Profile read the same helper.
    expect(strip(read("components/sections/ChildProfile.tsx"))).toContain("noticedMilestoneCounts(milestones)");
    expect(strip(read("components/sections/DevScoreCard.tsx"))).toContain("noticedMilestoneCounts(milestones)");
  });

  it("one fixture, one number: 24-month items the parent ticked count for a 38-month child", () => {
    const seed = [
      { checked: true, domain: "language_communication", ageMonths: 24 },
      { checked: true, domain: "language_communication", ageMonths: 24 },
      { checked: true, domain: "social_emotional", ageMonths: 30 },
      { checked: true, domain: "movement_physical", ageMonths: 18 },
      { checked: true, domain: "cognitive", ageMonths: 36 },
      { checked: false, domain: "cognitive", ageMonths: 36 },
    ];
    const c = noticedMilestoneCounts(seed);
    expect(c.noticed).toBe(5);
    expect(c.areas).toBe(4);
    expect(c.byDomain.language_communication).toBe(2);
  });
});

describe("NEXTLEVEL r1 — the primary move is a control", () => {
  it("data-primary-move=mark-milestone stamps the 'Seen any of these?' section, not the display:contents spine", () => {
    expect(MS).toContain('<div data-module="milestones-spine" style={{ display: "contents" }}>');
    expect(MS.match(/data-primary-move="mark-milestone"/g)?.length).toBe(1);
    const sec = MS.slice(MS.indexOf('data-primary-move="mark-milestone"'), MS.indexOf("</section>", MS.indexOf('data-primary-move="mark-milestone"')));
    expect(MS).toContain("selectNextMilestones(milestones, comparisonMonths, 3)");
    expect(sec).toContain('onClick={() => observeMilestone(m, "yes")}');
    expect(sec).toContain("min-h-11");
    expect(sec.match(/var\(--gradient-cta\)/g)?.length).toBe(1);
  });

  it("EN + HE strings exist for the move, its empty state and the domain next-item line", () => {
    for (const lang of ["en", "he"] as const) {
      for (const k of ["elev.ms.seenAny.title", "elev.ms.seenAny.yes", "elev.ms.domainNext"]) {
        expect(translate(lang, k)).not.toBe(k);
      }
      expect(translate(lang, "elev.ms.seenAny.empty", { name: "Dylan" })).toContain("Dylan");
    }
  });
});

describe("NEXTLEVEL r1 — a quiet page", () => {
  it("'Born early?' leads only under 24 months or with a gestation set; otherwise a disclosure", () => {
    expect(MS).toContain("<BornEarlyFrame inline={comparisonMonths < 24 || !!gestationalWeeks}");
    expect(MS).toContain('data-testid="ms-born-early-disclosure"');
  });

  it("no DEVELOPMENT MAP eyebrow and no second disclaimer in the summary card", () => {
    const card = MS.slice(MS.indexOf('data-testid="ms-map-count"') - 400, MS.indexOf('data-primary-move="mark-milestone"'));
    expect(card).not.toContain('t("ms.developmentMap")');
    expect(card).not.toContain('t("ms.snapshotNotScore")');
    expect(card).not.toMatch(/\buppercase\b/);
    expect(MS.match(/t\("ms\.developmentMap"\)/g)?.length).toBe(1);
  });

  it("no raw #fff and no off-token rgba green border", () => {
    expect(MS).not.toMatch(/#fff\b/i);
    expect(MS).not.toMatch(/rgba\(52,\s*178,\s*119/);
  });
});

describe("NEXTLEVEL r1 (B-NEXTLEVEL-NEW-1i/1j) — the parent's last first leads the summary", () => {
  it("latestNoticedMilestone picks the newest dated 'yes'; an undated or open item never leads", async () => {
    const { latestNoticedMilestone } = await import("./MilestonesTab");
    const ms = [
      { id: "a", checked: true, observationUpdatedAt: "2026-10-01T09:00:00Z" },
      { id: "b", checked: true, observationUpdatedAt: "2026-10-03T09:00:00Z" },
      { id: "c", checked: false, observationUpdatedAt: "2026-10-05T09:00:00Z" },
      { id: "d", checked: true },
    ];
    expect(latestNoticedMilestone(ms)?.milestone.id).toBe("b");
    expect(latestNoticedMilestone([{ id: "x", checked: true }])).toBeNull();
    expect(latestNoticedMilestone([])).toBeNull();
  });
  it("the summary card leads with the sentence; the count stays the shared reader, one quiet line; no ratio", async () => {
    const at = MS.indexOf('data-testid="ms-latest"');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(MS.indexOf('{recordCounts.noticed} {t("ms.domainOf")}'));
    expect(MS).toContain('t("elev.ms.latest.lead", { name: firstName || t("ms.watch.childFallback") })');
    expect(MS).toContain('<bdi dir="auto">{milestoneText(latestNoticed.milestone, "title", t)}</bdi>');
    expect(MS).toMatch(/data-testid="ms-latest-date"[^>]*background: "var\(--arbor-green-soft\)", color: "var\(--arbor-green-ink\)"/);
    const { translate } = await import("../../lib/i18n");
    for (const lang of ["en", "he"] as const) {
      for (const k of ["elev.ms.latest.lead", "elev.ms.latest.when", "elev.ms.latest.areas", "elev.ms.latest.areas.one"]) {
        expect(translate(lang, k, { name: "Dylan", n: 3 }), `${lang} ${k}`).toBeTruthy();
        expect(translate(lang, k, { name: "Dylan", n: 3 })).not.toMatch(/%| of |מתוך/);
      }
    }
  });
});
