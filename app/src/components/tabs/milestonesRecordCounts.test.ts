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
    // P5-LOOP c2 r1: the spine is a REAL box now (the root's gap reaches Born early)
    expect(MS).toContain('<div data-module="milestones-spine" className="min-w-0">');
    expect(MS).not.toContain('<div data-module="milestones-spine" style={{ display: "contents" }}>');
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

describe("P5-LOOP c2 r1 — no scoreboard at zero, one column at 1280, no watch-points panel", () => {
  it("the count renders ONLY at 1 or more, always t-sm muted body font; never t-2xl / display", () => {
    // B-DESIGN-03 (critic c2.r3 P2-12): the count rides the ONE muted t-sm line (ms-latest), tabular numerals.
    expect(MS).toMatch(/\{recordCounts\.noticed > 0 && \(\s*<span data-testid="ms-map-count" className="arbor-num whitespace-nowrap">/);
    const line = MS.slice(MS.indexOf('<p data-testid="ms-latest"'), MS.indexOf("</p>", MS.indexOf('<p data-testid="ms-latest"')));
    expect(line).toContain('className="mt-2 min-w-0 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}');
    expect(line).toContain('data-testid="ms-map-count"');
    expect(MS).not.toMatch(/t-2xl font-extrabold leading-tight/);
    expect(MS.match(/data-testid="ms-map-count"/g)?.length).toBe(1);
  });

  it("first open: ONE editorial line naming the child (no number, no chip) + a lede naming the first card (EN + HE)", async () => {
    const { translate } = await import("../../lib/i18n");
    for (const lang of ["en", "he"] as const) {
      const first = translate(lang, "elev.loop.ms.firstLine", { name: "Dylan" });
      expect(first).toContain("Dylan");
      expect(first).not.toMatch(/\d/);
      const lede = translate(lang, "elev.loop.ms.ledeFirst", { title: "Draws a circle" });
      expect(lede).toContain("Draws a circle");
      expect(lede).not.toBe(translate(lang, "elev.loop.shelfMap.title"));
    }
    expect(translate("en", "elev.loop.ms.firstLine", { name: "Dylan" })).toBe("Dylan's shelves are ready — start with whatever you saw this week.");
    expect(translate("he", "elev.loop.ms.firstLine", { name: "Dylan" }).replace(/[\u2068\u2069]/g, "")).toBe("המדפים של Dylan מוכנים — התחילו ממה שראיתם השבוע.");
    expect(MS).toMatch(/data-testid="ms-first-line" dir="auto"[^>]*fontFamily: "var\(--font-editorial\)", fontSize: "var\(--t-lg\)", color: "var\(--arbor-ink\)"/);
    // c2 r2 (B-LOOP-NEW-2e): with a first card, ONE sentence names the child and the card — no second line, no imperative
    expect(MS).toContain('t("elev.loop.ms.firstCard", { name: firstName || t("ms.watch.childFallback"), title: milestoneText(firstCard, "title", t, msGender) })');
    expect(MS).toMatch(/\{!firstCard && \(\s*<p data-testid="ms-lede"/);
    for (const lang of ["en", "he"] as const) {
      const one = translate(lang, "elev.loop.ms.firstCard", { name: "Dylan", title: "Draws a circle" }).replace(/[\u2068\u2069]/g, "");
      expect(one).toContain("Dylan");
      expect(one).toContain("Draws a circle");
      expect(one).not.toMatch(/\bstart\b|\btry\b|התחילו|נסו|\d/i);
      expect(one.match(/[.!?]/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("the Split renders only with its rail (under 2); otherwise ONE start-aligned 760 px column shared by the header, the map and the cards", () => {
    expect(MS).toContain("const hasRail = comparisonMonths < 24;");
    expect(MS).toMatch(/\{hasRail \? \(\s*<Split[\s\S]*right=\{shelfMap\}\s*\/>\s*\) : shelfMap\}/);
    expect(MS).toContain('flex w-full min-w-0 flex-col gap-5 sm:gap-6 ${hasRail ? "mx-auto max-w-[1180px]" : "me-auto max-w-[760px]"}');
    expect(MS).not.toMatch(/max-w-\[1180px\] space-y-5 sm:space-y-6/);
  });

  it("the Gentle watch points panel is gone; the corrected-age note is one muted line in the map foot", () => {
    expect(MS).not.toContain('data-testid="ms-watch-points"');
    expect(MS).not.toMatch(/watchPointsSummary|useMonitoring\(|t\("ms\.watch\.close"\)|t\("ms\.watchPoints"\)|t\("ms\.watch\.none"\)/);
    expect(MS).toMatch(/\{corrected\.applied && \(\s*<p data-testid="ms-corrected-note" className="mt-1 t-sm" style=\{\{ color: "var\(--arbor-muted\)" \}\}>/);
    expect(MS.indexOf('data-testid="ms-footer"')).toBeLessThan(MS.indexOf('data-testid="ms-corrected-note"'));
  });
});

describe("B-LOOP-NEW-1e — the map remembers in the parent's words", () => {
  it("each shelf header carries its latest kept line: verbatim, editorial t-sm, 2 px --arbor-ink start rule, dated — and no count, no comparison", () => {
    // c2 r2 (B-LOOP-NEW-2e): notes + the child's kept quotes; the header quote's entry is excluded from its shelf's epigraph
    expect(MS).toContain("const ownWords = useMemo(() => ownWordsByShelf(observations, behaviorLogs ?? [], keptQuotes, SHELF_IDS), [observations, behaviorLogs, keptQuotes]);");
    expect(MS).toContain("const shelfWords = useMemo(() => tileWordsExcept(ownWords, headerQuote?.id), [ownWords, headerQuote]);");
    expect(MS).toMatch(/data-testid="ms-shelf-epigraph" className="mt-2 truncate border-s-2 ps-3 t-sm leading-snug" style=\{\{ borderColor: "var\(--arbor-ink\)", fontFamily: "var\(--font-editorial\)", color: "var\(--arbor-ink-soft\)" \}\}/);
    const epi = MS.slice(MS.indexOf('data-testid="ms-shelf-epigraph"'), MS.indexOf("</p>", MS.indexOf('data-testid="ms-shelf-epigraph"')));
    expect(epi).toContain("shelfDayLabel(");
    expect(epi).not.toMatch(/noticed|count|\bn\b/);
  });

  it("after an answer the receipt names the next row on the SAME shelf — a title only (EN + HE)", async () => {
    const { translate } = await import("../../lib/i18n");
    expect(MS).toMatch(/\{heldNotice\[shelf\] === card\.id && \(\(\) => \{\s*const next = nextOnShelf\(shelf, card\.id\);/);
    expect(MS).toContain(".find((m) => m.id !== answeredId && shelfOfMilestone(m) === shelf);");
    const strip = (v: string) => v.replace(/[\u2068\u2069]/g, "");
    expect(strip(translate("en", "elev.loop.ms.nextOn", { shelf: "Words", title: "Tells a short story" }))).toBe("Next on Words: Tells a short story.");
    expect(strip(translate("he", "elev.loop.ms.nextOn", { shelf: "מילים", title: "מספר סיפור קצר" }))).toBe("הבא במדף מילים: מספר סיפור קצר");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.loop.ms.nextOn", { shelf: "x", title: "y" })).not.toMatch(/\d|tomorrow|מחר|soon/i);
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
    expect(MS).toContain('<bdi dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{milestoneText(latestNoticed.milestone, "title", t, msGender)}</bdi>');
    // B-DESIGN-03 (critic c2.r3 stronger target): the date is plain muted text in a <time>, the green chip is gone.
    expect(MS).toContain('<time data-testid="ms-latest-date" dateTime={latestNoticed.at} className="whitespace-nowrap">');
    expect(MS).not.toMatch(/data-testid="ms-latest-date"[^>]*(?:green-soft|green-ink|rounded-full)/);
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
    // B-DESIGN-03: the area is a span INSIDE the one t-sm muted line (no own size).
    expect(MS).toContain('<span data-testid="ms-latest-area"> · {t("elev.ms.latest.area", { area: latestShelfName })} · </span>');
    // B-LOOP-05: the area is the SHELF the item sits on, the same name the map prints.
    expect(MS).toContain('t("elev.ms.latest.area", { area: latestShelfName })');
    expect(MS).toContain("shelfLabel(latestShelf, t)");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.ms.latest.area", { area: "x" })).not.toBe("elev.ms.latest.area");
  });
  it("the count card and the Development Map carry no orphan px sizes; the map heading is a step above its rows", () => {
    // B-LOOP-05 re-pin: the shelf map — title t-lg, shelf names t-md, rows t-sm.
    const map = MS.slice(MS.indexOf('t("elev.loop.shelfMap.title")') - 300, MS.indexOf('t("ms.playIdeas"'));
    expect(map).not.toMatch(/text-\[(?:11|12|12\.5|13|13\.5|15|17|26)px\]/);
    // B-DESIGN-03: the map title is the title step (22 px), the shelf heads the section step (t-lg).
    expect(MS).toContain('<h2 id="ms-map-title" className="arbor-type-title sr-only sm:not-sr-only" style={{ color: "var(--arbor-ink)" }}>');
    expect(map).toContain('<SectionHead as="h3" id={`ms-shelf-${shelf}`} title={shelfLabel(shelf, t)} className="min-w-0 flex-1" />');
    expect(read("components/ui/SectionHead.tsx")).toContain('className="m-0 min-w-0 t-lg"');
    expect(MS).not.toContain("text-[26px]");
  });
});

describe("P5-LOOP c2 r2 (B-LOOP-NEW-2e) — the map opens on the family's own words", () => {
  it("a line kept in the last 7 days sits under the H1: editorial t-lg, 2 px ink start rule, dir=auto quote, shelf + day in <bdi>; no count", () => {
    expect(MS).toContain("const since = noticeNow.getTime() - 7 * 86_400_000;");
    const at = MS.indexOf('data-testid="ms-header-quote"');
    expect(at).toBeGreaterThan(-1);
    const quote = MS.slice(at, MS.indexOf("</figure>", at));
    // B-DESIGN-03 (P7-DESIGN one warm accent; critic c2.r3 P2-13): the 2 px ink rule (.arbor-accent-rule),
    // the words in the editorial face, the shelf and the day on their own t-sm line (no stranded separator).
    expect(quote).toContain('className="arbor-accent-rule mt-3 min-w-0"');
    expect(quote).toContain('<blockquote dir="auto" className="leading-snug" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)"');
    expect(quote).toContain("{quoted(headerQuote.text)}");
    expect(quote).toContain('<figcaption className="mt-1 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>');
    expect(quote.slice(quote.indexOf("<figcaption"))).not.toMatch(/^\s*·/);
    expect(quote).toContain("<bdi>{shelfLabel(headerQuote.shelf, t)}</bdi>");
    expect(quote).toContain("shelfDayLabel(headerQuote.at, noticeNow");
    expect(quote).not.toMatch(/recordCounts|noticed|count/);
    // the quote opens the map BEFORE the ONE muted line (latest · count · Change at its end)
    expect(at).toBeLessThan(MS.indexOf("{latestLine}"));
    expect(MS).toMatch(/\{latestNoticed && !changingLatest && \(\s*<>\s*\{" · "\}\s*\{changeButton\}/);
    expect(MS).not.toContain('data-testid="ms-change-row"');
    // the quote's own entry never repeats as its shelf's epigraph
    expect(MS).toContain("tileWordsExcept(ownWords, headerQuote?.id)");
  });
});
