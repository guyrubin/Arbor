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
    // B-LOOP-05: the per-row count is per SHELF now; the shelves add up to
    // recordCounts.noticed (lib/milestones/shelfMap.test.ts pins the sum).
    expect(MS).toContain("noticedByShelf(milestones)");
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
  // B-LOOP-05 re-pin: the move is notice-milestone, stamped on the FIRST
  // shelf's Notice card (three 44 px answers), never on the display:contents
  // spine; the answers write through observeMilestone (the one seam).
  it("data-primary-move=notice-milestone stamps the first shelf's Notice card, not the display:contents spine", () => {
    expect(MS).toContain('<div data-module="milestones-spine" style={{ display: "contents" }}>');
    expect(MS.match(/data-primary-move/g)?.length).toBe(1);
    // P5 critic r1: the stamp rides the first Notice card's answers group (answersAttrs).
    // P5 critic r2 (P1-4): the stamp rides the first UNANSWERED card's answers.
    expect(MS).toMatch(/<NoticeCard[\s\S]{0,400}answersAttrs=\{shelf === stampShelf \? \{ "data-primary-move": "notice-milestone" \} : undefined\}[\s\S]{0,300}observeMilestone\(card, status\)/);
    expect(MS).toContain("const stampShelf = mapShelves.find((id) => noticeFor(id) && !heldNotice[id]);");
    expect(MS).not.toMatch(/var\(--gradient-cta\)/);
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
    const card = MS.slice(MS.indexOf('data-testid="ms-map-count"') - 400, MS.indexOf("comparisonMonths < 24 && ("));
    expect(card).not.toContain('t("ms.developmentMap")');
    expect(card).not.toContain('t("ms.snapshotNotScore")');
    expect(card).not.toMatch(/\buppercase\b/);
    // B-LOOP-05: the domain map is gone (the professional view regroups by
    // domain, B-LOOP-12); the shelf map carries one title.
    expect(MS).not.toContain('t("ms.developmentMap")');
    expect(MS.match(/t\("elev\.loop\.shelfMap\.title"\)/g)?.length).toBe(1);
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
    expect(MS).toContain('<bdi dir="auto">{milestoneText(latestNoticed.milestone, "title", t, msGender)}</bdi>');
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

describe("P1-NEXTLEVEL critic r2 — the latest card names its area; the map is on the type scale", () => {
  it("under the latest title, one quiet t-sm line names the area it was counted in (EN + HE)", () => {
    // P5 critic r1: the latest sentence is the lede under the H1, the area one quiet t-sm span in it.
    expect(MS).toContain('data-testid="ms-latest-area" className="t-sm"');
    // B-LOOP-05: the area is the SHELF the item sits on, the same name the map prints.
    expect(MS).toContain('t("elev.ms.latest.area", { area: latestShelfName })');
    expect(MS).toContain("shelfLabel(latestShelf, t)");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.ms.latest.area", { area: "x" })).not.toBe("elev.ms.latest.area");
  });
  it("the count card and the Development Map carry no orphan px sizes; the map heading is a step above its rows", () => {
    // B-LOOP-05 re-pin: the shelf map — title t-lg, shelf names t-md, rows t-sm.
    const map = MS.slice(MS.indexOf('t("elev.loop.shelfMap.title")') - 300, MS.indexOf('t("ms.playIdeas"'));
    expect(map).not.toMatch(/text-\[(?:11|12|12\.5|13|13\.5|15|17|26)px\]/);
    expect(map).toContain('fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>\n                {t("elev.loop.shelfMap.title")}');
    expect(map).toContain('fontSize: "var(--t-md)", color: "var(--arbor-ink)" }}>\n                          {shelfLabel(shelf, t)}');
    expect(MS).not.toContain("text-[26px]");
  });
});
