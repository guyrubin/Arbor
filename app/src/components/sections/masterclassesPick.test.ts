/**
 * LC-04 mount guard — the Learn hub's ONE move runs the REAL ranking.
 *
 * The ranking itself is proven behaviourally in src/learn/todaysPick.test.ts.
 * This file proves it is actually MOUNTED on the hub (the finding was
 * "capability built, unmounted"), so a regression that reverts the hero CTA to
 * `catalog.find((m) => !done[m.id])` turns CI red.
 *
 * Scan discipline (this repo has been bitten twice by vacuous scans):
 *  · \r\n is normalised BEFORE any regex runs;
 *  · every extraction is asserted toBeTruthy() before it is used;
 *  · each assertion has a NEGATIVE CONTROL run against the pre-change source
 *    shape, so a scan that silently matches nothing cannot pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickMoment, todaysLearnPick } from "../../learn/todaysPick";
import { LEARN_CARDS } from "../../learn/learnCards";
import { learnCardScore } from "../../learn/learnLibrary";
import { translate as tr } from "../../lib/i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.join(__dirname, "Masterclasses.tsx");
const src = readFileSync(HUB, "utf8").replace(/\r\n/g, "\n");

/** The pre-change hero: first unfinished course in FILE ORDER, no signals. */
const PRE_CHANGE = `
  const nextCourse = catalog.find((m) => !done[m.id]);
  const heroStats = [
    { value: total, label: t("elev.hero.academy.stat.courses") },
    { value: doneCount, label: t("elev.hero.academy.stat.completed") },
    ...(nextCourse ? [{ value: nextCourse.durationMin, label: t("elev.hero.academy.stat.minNext") }] : []),
  ];
        <HubHero
          cta={nextCourse ? {
            label: t("elev.hero.academy.cta"),
            onClick: () => setOpenId(nextCourse.id),
            testId: "academy-hero-cta",
          } : undefined}
        />
`.replace(/\r\n/g, "\n");

const RANKED_PICK = /todaysLearnPick\(\s*LEARN_CARDS/;
const SEEDED_DAY = /dayKey:\s*pickDayKey\(/;
// v3 F-FORYOU-1 (re-pin): the CTA still opens today's read — in a sheet over
// this page now (openRead), not by routing to #/learn.
const CTA_OPENS_PICK = /onClick=\{\(\) => todaysRead \? openRead\(todaysRead\.card\.id/;
// B-PLAY-18: the stat trio is gone; the pick's reading minutes ride its own line.
const PICK_MINUTES = /const pickMinutes = todaysRead \? todaysRead\.card\.minutes/;
const WHY_LINE = /data-testid="academy-pick-why"/;

describe("LC-04 · the hub hero runs the real ranking", () => {
  it("the source was actually read (guard against a vacuous scan)", () => {
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toContain("export default function Masterclasses");
  });

  it("today's read comes from rankLearnCards' scorer over the Learn catalogue", () => {
    expect(RANKED_PICK.exec(src)).toBeTruthy();
    expect(RANKED_PICK.exec(PRE_CHANGE)).toBeNull(); // negative control
  });

  it("the pick is seeded per day, so it is stable today and rotates tomorrow", () => {
    expect(SEEDED_DAY.exec(src)).toBeTruthy();
    expect(SEEDED_DAY.exec(PRE_CHANGE)).toBeNull();
  });

  it("the hero CTA opens today's read, not the first unfinished course", () => {
    expect(CTA_OPENS_PICK.exec(src)).toBeTruthy();
    expect(CTA_OPENS_PICK.exec(PRE_CHANGE)).toBeNull();
  });

  it("the pick line shows the pick's own reading minutes (no stat trio)", () => {
    expect(src).not.toMatch(/const heroStats = \[/);
    expect(PICK_MINUTES.exec(src)).toBeTruthy();
    expect(PICK_MINUTES.exec(PRE_CHANGE)).toBeNull();
  });

  it("an honest why-line renders beside the hero", () => {
    expect(WHY_LINE.exec(src)).toBeTruthy();
    expect(WHY_LINE.exec(PRE_CHANGE)).toBeNull();
  });

  it("the ranking signals are the parent's own inputs, never a child score", () => {
    const block = /const learnSignals: LearnRankSignals = \{([\s\S]*?)\};/.exec(src);
    expect(block).toBeTruthy();
    const body = block![1];
    for (const signal of ["ageYears", "focusDomain", "recentConcerns", "helpfulness", "savedIds"]) {
      expect(body).toContain(signal);
    }
    // FIREWALL: no readiness/risk/percentage figure reaches the hub hero.
    expect(body).not.toMatch(/riskLevel|milestonesPercent|percent/i);
  });
});

describe("W2-SHELLPLAY r1 · the pick reads first; the rail never stacks two empty states", () => {
  it("the pick CTA is the page's --gradient-cta with on-accent ink (never the success green as a fill)", () => {
    const cta = src.slice(src.indexOf('data-testid="academy-hero-cta"'), src.indexOf("</button>", src.indexOf('data-testid="academy-hero-cta"')));
    expect(cta).toContain('style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}');
    expect(cta).not.toContain('background: "var(--arbor-green-ink)"');
  });

  // v3 F-FORYOU-1 (re-pin): "All courses" is retired; the library is titled
  // "Courses by area" under a "Library" kicker. The pick title stays an h2.
  it("the pick title is an h2; the library is 'Courses by area' ('All courses' retired)", () => {
    expect(src).toMatch(/<h2 className="text-xl font-bold leading-snug" dir="auto" style=\{\{ color: "var\(--arbor-ink\)", fontFamily: "var\(--font-display\)" \}\}>\{todaysRead/);
    expect(src).toMatch(/<h2 id="academy-library-title"[^>]*>\{t\("elev\.learnCare\.library\.title"\)\}<\/h2>/);
    expect(src).toContain('{t("elev.learnCare.library.kicker")}');
    expect(src).not.toContain('t("academy.courses.title")');
  });

  // v3 F-FORYOU-1 (re-pin): the rail is removed — For You, Scholar Hub, the
  // charter strip, the phone <details> and the no-signal line all go; their
  // signals rank the pick and the catalogue instead.
  it("no rail: no For You / Scholar Hub cards, no no-signal line, no phone disclosure", () => {
    const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const gone of ["<AcademyForYou", "<ScholarHubCard", 'data-testid="academy-rail"', 'data-testid="academy-rail-nosignal"', "elev.growthTruth.learn.rail.noSignal", "<details", "<summary"]) {
      expect(code, gone).not.toContain(gone);
    }
    // NEGATIVE CONTROL: the r1 shape this replaced is caught by the same scan.
    expect('{devMapHasSignal(devScore) ? (<><AcademyForYou /><ScholarHubCard /></>) : (').toContain("<AcademyForYou");
    // The focus domain still ranks (it is a learnSignals input), so the rail's
    // one signal is not lost.
    expect(/const learnSignals: LearnRankSignals = \{[\s\S]*?focusDomain: devScore\.focusDomain,[\s\S]*?\};/.test(src)).toBe(true);
  });
});

/* ── W2-SHELLPLAY r2 · B-SHELL-NEW-2j — the pick's why quotes the parent's own note ── */

describe("B-SHELL-NEW-2j — today's pick quotes the note that moved it, never a domain, score or count", () => {
  const now = new Date(2026, 9, 5, 19, 0);
  const signals = { ageYears: 3, focusDomain: null, recentConcerns: [] as never[] };
  const card = LEARN_CARDS.find((c) => learnCardScore(c, { ...signals, recentConcerns: ["transitions"] }) > learnCardScore(c, signals));

  it("pickMoment returns the NEWEST in-window note whose own concern moves the card, with its own words", () => {
    expect(card, "a transitions card exists in the catalogue").toBeTruthy();
    const logs = [
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 1, 8).toISOString(), trigger: "Fell apart leaving the park" },
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 4, 8).toISOString(), trigger: "Cried at the daycare door" },
      { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 5, 9).toISOString(), trigger: "   " },
    ];
    expect(pickMoment(card!, signals, logs, now)).toEqual({ text: "Cried at the daycare door", at: new Date(2026, 9, 4, 8) });
    // NEGATIVE CONTROLS: out of window, in the future, or a log whose concern does not move this card
    expect(pickMoment(card!, signals, [{ behaviorType: "Transition Refusal", timestamp: new Date(2026, 8, 1).toISOString(), trigger: "old" }], now)).toBeNull();
    expect(pickMoment(card!, signals, [{ behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 6).toISOString(), trigger: "future" }], now)).toBeNull();
    expect(pickMoment(card!, signals, [{ behaviorType: "Moment", timestamp: new Date(2026, 9, 5, 8).toISOString(), trigger: "Sang the bath song" }], now)).toBeNull();
    // Provenance: the newest row is skipped when the parent did not write it.
    for (const notParent of [{ contentSource: "ai_draft" }, { conversationProposalId: "proposal" }, { captureSource: "co_parent" }]) {
      const newest = { behaviorType: "Transition Refusal", timestamp: new Date(2026, 9, 5, 8).toISOString(), trigger: "Drafted by Arbor", ...notParent };
      expect(pickMoment(card!, signals, [...logs, newest], now)).toEqual({ text: "Cried at the daycare door", at: new Date(2026, 9, 4, 8) });
    }
  });

  it("todaysLearnPick carries fromMoment only when concerns exist; null without logs", () => {
    const pick = todaysLearnPick(LEARN_CARDS, { ...signals, recentConcerns: [] }, { childId: "c", dayKey: "2026-10-05" });
    expect(pick?.fromMoment).toBeNull();
  });

  it("the hub renders the quote on the logs branch only, in the editorial face, with a peach-ink inline-start rule", () => {
    expect(src).toContain("const pickMoment = todaysRead && !todaysRead.fromSaved && todaysRead.fromConcerns ? todaysRead.fromMoment : null;");
    expect(src).toContain('borderInlineStart: "3px solid var(--arbor-peach-ink)", paddingInlineStart: 12');
    expect(src).toContain('fontFamily: "var(--font-editorial)" }}>“<bdi>{pickMoment.text}</bdi>”');
    expect(src).toContain("logs: behaviorLogs,");
    for (const k of ["today", "yesterday", "weekday", "date", "tail"]) {
      const key = `elev.learnCare.pick.moment.${k}`;
      expect(tr("en", key), key).not.toBe(key);
      expect(tr("he", key, { day: "x" }).replace("x", ""), key).not.toMatch(/[A-Za-z]/);
      expect(tr("en", key, { day: "Tuesday" })).not.toMatch(/\d+%|score|weakest|domain/i);
    }
  });
});

/* ── v3 EXTRA-FORYOU · For you, the parent ─────────────────────────────────
 * The hub answers the parent's open family question: the pick says when the
 * question moved it (and quotes it, bidi-isolated), a short-reads row follows,
 * "Courses by area" chips filter the grid with plain counts, and a door opens
 * the family-ritual page. The hero CTA still opens today's read (LC-04 above);
 * no course progress of any shape (B-PLAY-18). */

describe("v3 EXTRA-FORYOU — For you, the parent", () => {
  /** Comment-free code, the way check:framework counts attributes. */
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  /** `base` from `from` up to the next `to`, asserted non-empty. */
  const between = (from: string, to: string, base = src): string => {
    const a = base.indexOf(from);
    expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
    const b = base.indexOf(to, a + from.length);
    expect(b, `end marker not found after ${from}: ${to}`).toBeGreaterThan(a);
    return base.slice(a, b);
  };
  const reader = src.slice(src.indexOf("export function MasterclassReader("));

  it("the comment strip is real (NEGATIVE CONTROL: the raw source carries the attribute names in comments)", () => {
    expect(code.length).toBeGreaterThan(1000);
    expect((src.match(/\bdata-module\b(?!-)/g) ?? []).length).toBeGreaterThan((code.match(/\bdata-module\b(?!-)/g) ?? []).length);
    expect((src.match(/data-primary-move/g) ?? []).length).toBeGreaterThan((code.match(/data-primary-move/g) ?? []).length);
    expect(reader.length).toBeGreaterThan(1000);
  });

  it("the open family question joins the ranking as the parent's own words", () => {
    // v3 F-FORYOU-1 (re-pin): requestLearnRead left the hub (reads open in a sheet here).
    expect(src).toContain("const { childProfile, behaviorLogs, savedLearnIds, setActiveTab, activeFamilyTopic } = useArbor();");
    const block = /const learnSignals: LearnRankSignals = \{([\s\S]*?)\};/.exec(src);
    expect(block).toBeTruthy();
    expect(block![1]).toContain("topicText: activeFamilyTopic?.title ?? null,");
    expect(PRE_CHANGE).not.toContain("topicText"); // negative control
  });

  it("the tag and the quoting why-line show only when the question MOVED the pick", () => {
    expect(src).toContain("const pickTopic = todaysRead?.fromTopic && activeFamilyTopic ? activeFamilyTopic.title : null;");
    // NEGATIVE CONTROL: a question merely existing is not a reason.
    expect(code).not.toMatch(/\{activeFamilyTopic && \(/);
    const tag = between("{pickTopic && (", "</span>");
    expect(tag).toContain('data-testid="academy-pick-topic"');
    expect(tag).toContain('<Icon name="auto_awesome"');
    expect(tag).toContain('t("elev.learnCare.pick.topicTag")');
    const why = between('data-why="family-question"', "</p>");
    expect(why).toContain("<FreeText text={pickTopic}");
    expect(why).toContain("{topicLead}");
    expect(why).toContain("{topicTail}");
    expect(why).toContain('borderInlineStart: "3px solid var(--arbor-lav-ink)", paddingInlineStart: 12');
    // The question outranks the note: its branch is the first of the why-line.
    expect(src.indexOf('data-why="family-question"')).toBeLessThan(src.indexOf('data-why="moment"'));
    expect(src.indexOf("{pickTopic && (")).toBeLessThan(src.indexOf('data-testid="academy-hero-cta"'));
  });

  it("the quote is cut from ONE translated template on a mark that never shows (EN and HE)", () => {
    expect(src).toContain('const TOPIC_SLOT = "\\uE000";');
    expect(src).toContain('const [topicLead, topicTail = ""] = t("elev.learnCare.pick.why.topic", { title: TOPIC_SLOT }).split(TOPIC_SLOT);');
    for (const lang of ["en", "he"] as const) {
      const parts = tr(lang, "elev.learnCare.pick.why.topic", { title: "" }).split("");
      expect(parts, lang).toHaveLength(2);
      expect(parts[0].trim().length, lang).toBeGreaterThan(0);
    }
    // NEGATIVE CONTROL: a template without the placeholder would not split.
    expect("Because you are asking".split("")).toHaveLength(1);
  });

  it("the hero CTA still opens today's read; one primary move and at most 3 modules", () => {
    expect(CTA_OPENS_PICK.exec(src)).toBeTruthy();
    expect((code.match(/\bdata-primary-move="/g) ?? []).length).toBe(1);
    expect(code).toContain('data-primary-move="open-todays-pick"');
    const modules = code.match(/\bdata-module="[^"]+"/g) ?? [];
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules.length).toBeLessThanOrEqual(3);
    expect(modules).toEqual(['data-module="academy-short-reads"', 'data-module="academy-catalogue"']);
  });

  it("short reads: one tap into a Learn read, a registry area and minutes only, never a score", () => {
    const row = between('data-testid="academy-short-reads"', "</section>");
    // v3 F-FORYOU-1 (re-pin): a read opens in a sheet over this page.
    expect(row).toContain('onClick={() => openRead(c.id, "learn-hub-short-read")}');
    expect(row).toContain('data-testid="academy-short-read"');
    // v3 F-FORYOU-1: "Three minutes, one idea"; the hook in the say voice with the accent rule.
    expect(row).toContain('{t("elev.learnCare.reads.title")}</h2>');
    expect(row).toContain('className="arbor-type-say arbor-accent-rule line-clamp-3 block"');
    expect(row).not.toMatch(/\bby\b|author|expert/i);
    expect(row).toContain("min-h-11");
    // The area chip is the ONE domain registry: DOMAIN_ICONS glyph + registry name.
    expect(row).toContain("const area = readArea(c.category);");
    expect(row).toContain("<Icon name={DOMAIN_ICONS[area]} size={14} /><span>{domainName(area, t)}</span>");
    expect(row).not.toContain("learnCategoryById"); // NEGATIVE CONTROL: no shelf vocabulary on the chip
    expect(row).toContain('<Icon name="schedule" size={13} />{t("learn.minutes", { n: c.minutes })}');
    for (const banned of ["ProgressBar", "progressbar", "of {", "/ total", "done["]) {
      expect(row, banned).not.toContain(banned);
    }
    // No percentage beside an expression (the card's CSS width `w-[78%]` is layout, not a figure).
    expect(row).not.toMatch(/\}\s*%|%\s*\{/);
    expect("{pct}%").toMatch(/\}\s*%|%\s*\{/); // negative control
    expect(src).toContain(".filter((c) => c.id !== todaysRead?.card.id);");
    // Reviewer r1: the row is filled to three (learn/shortReads); the title and
    // the per-read mark come from the same pick, so neither can overclaim.
    // v3 F-FORYOU-1 r2 (re-pin): the week's concept is passed in for the last slot.
    expect(src).toContain("const shortReadRow = pickShortReads(readShelf, activeFamilyTopic?.title, weeklyConcept);");
    expect(row).toContain("{shortReadRow.reads.map((c) => {");
    expect(row).toContain('{t(shortReadRow.forTopic ? "elev.learnCare.shortReads.title" : "elev.learnCare.shortReads.titleAll")}');
    expect(row).toContain("{shortReadRow.markMatched && shortReadRow.matched.has(c.id) && (");
    expect(src).toContain("{shortReadRow.show && (");
    // NEGATIVE CONTROL: the r1 shape that showed only the question's reads (one card) is gone.
    expect(code).not.toContain("(readsForTopic ? topicReads : readShelf).slice(0, 3)");
  });

  it("courses by area: labelled chips with aria-pressed filter the grid; the counts are plain integers", () => {
    // v3 F-FORYOU-1 (re-pin): the grid is two columns from sm, three at xl.
    // v3 F-FORYOU-1 r2 (re-pin): the row also shows when only saved reads exist.
    const chips = between("{(areaCounts.length > 1 || savedReads.length > 0) && (", '<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">');
    expect(chips).toContain('role="group" aria-labelledby="academy-by-area-label" data-testid="academy-by-area"');
    expect(chips).toContain('id="academy-by-area-label"');
    expect(chips).toContain("aria-pressed={selectedArea === null}");
    expect(chips).toContain("aria-pressed={selectedArea === area}");
    // v3 F-FORYOU-1 r2 (re-pin): choosing an area also leaves the Saved view.
    expect(chips).toContain("onClick={() => chooseArea(selectedArea === area ? null : area)}");
    expect(src).toContain("const chooseArea = (area: DomainId | null) => { setSavedShelf(false); setActiveArea(area); };");
    // Reviewer r1: the areas are the registry domains (glyph + name), not the Learn shelves.
    expect(chips).toContain("<Icon name={DOMAIN_ICONS[area]} size={15} />");
    expect(chips).toContain("<span>{domainName(area, t)}</span>");
    expect(chips).not.toContain("msIcon"); // NEGATIVE CONTROL: no shelf glyph
    expect(src).toContain("const [activeArea, setActiveArea] = useState<DomainId | null>(null);");
    expect(chips).toContain('<span className="tabular-nums" style={{ opacity: 0.75 }}>{count}</span>');
    for (const banned of ["%", "total", "ProgressBar", "done["]) expect(chips, banned).not.toContain(banned);
    expect(src).toMatch(/const AREA_CHIP = "[^"]*\bmin-h-11\b[^"]*";/);
    // v3 F-FORYOU-1 (re-pin): the readiness courses count in their areas too.
    expect(src).toContain("const areaCounts = courseAreaCounts([...catalog, ...readiness]);");
    expect(src).toContain("if (selectedArea && courseArea(c.id) !== selectedArea) return null;");
    // The filter sits inside the grid's own map, ahead of every card.
    expect(src.indexOf("catalog.map((c) => {")).toBeLessThan(src.indexOf("if (selectedArea && courseArea(c.id)"));
  });

  it("family formation: one door to #/family inside the catalogue, not a module and not a second CTA", () => {
    const door = between('data-testid="academy-family-door"', "</button>");
    expect(door).toContain('onClick={() => setActiveTab("family")}');
    expect(door).toContain("min-h-11");
    // v3 F-FORYOU-1 (re-pin): the family area's own picture (DOMAIN_ART.family),
    // and a mirrored chevron_right after the CTA text.
    expect(door).toContain("src={DOMAIN_ART.family.src}");
    expect(door).not.toContain("TOGETHER_ART");
    expect(door).toContain('alt=""');
    expect(door).toContain('t("elev.learnCare.family.cta")');
    expect(door).toContain('t("elev.learnCare.family.headline")');
    // Reviewer r1: the eyebrow is the brief's own key, not the Family page's title.
    expect(door).toContain('{t("elev.learnCare.family.title")}');
    expect(door).not.toContain('t("sec.family.title")');
    expect(door).toContain('<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />');
    for (const banned of ["--gradient-cta", "data-module", "data-primary-move"]) expect(door, banned).not.toContain(banned);
    const at = src.indexOf('data-testid="academy-family-door"');
    expect(at).toBeGreaterThan(src.indexOf('data-testid="academy-courses"'));
    expect(at).toBeGreaterThan(src.indexOf("catalog.map((c) => {"));
    expect(at).toBeLessThan(src.indexOf("{readId && ("));
  });

  it("no course progress anywhere on the hub (no bar, no %, no 'n of m')", () => {
    for (const banned of ["<ProgressBar", "lessonOf", "}%", "of {total}", 'role="progressbar"', "doneCount / total"]) {
      expect(code, banned).not.toContain(banned);
    }
    // NEGATIVE CONTROL: the comment that records the removed bar is in the raw source only.
    expect(src).toContain("of {total}");
  });

  it("the header: a kicker, a title that names no child, and one line of sub", () => {
    expect(src).toContain('{t("elev.hero.academy.kicker")}');
    expect(src).toContain('{t("elev.hero.academy.title")}</h1>');
    expect(src).toContain('{t("elev.hero.academy.sub")}');
    expect(src).not.toContain('t("elev.hero.academy.title", { name: childName })');
    for (const lang of ["en", "he"] as const) expect(tr(lang, "elev.hero.academy.title"), lang).not.toContain("{name}");
  });

  it("the card's read link carries a mirrored glyph, not a text arrow", () => {
    expect(src).toContain('<>{t("master.read")}<Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" /></>');
    expect(code).not.toMatch(/t\("master\.read"\)\} ?→/);
    expect('<>{t("master.read")} →</>').toMatch(/t\("master\.read"\)\} ?→/); // negative control
  });

  it("the reader says 'Added' only after the write resolved; a failed write says so", () => {
    expect(reader).toContain('const [addState, setAddState] = useState<"idle" | "saving" | "saved" | "failed">("idle");');
    expect(reader).toContain('const addedShown = addState === "saved" || (addState === "idle" && todayTaken && actionLoopConfirmed === true);');
    // Reviewer r1: a row the ledger has not confirmed reads the neutral "On today's list",
    // never "Added" and never a live-looking "Add" on a disabled button.
    expect(reader).toContain('const addListed = !addedShown && addState === "idle" && todayTaken;');
    const add = between("const addToday = () => {", "};", reader);
    expect(add.indexOf("if (todayTaken) return;")).toBeGreaterThan(-1);
    expect(add.indexOf('setAddState("saving");')).toBeLessThan(add.indexOf('acceptTodayAction(tryTonight, "tiny", "learn-read")'));
    expect(add).toContain("write.then(");
    expect(add).toContain('setAddState("saved")');
    expect(add).toContain('setAddState("failed")');
    const label = between('{addState === "saving"', "</button>", reader).replace(/\s+/g, " ");
    expect(label).toContain('{addState === "saving" ? t("elev.learnCare.addToday.saving") : addedShown ? t("learn.addedToday") : addListed ? t("elev.learnCare.addToday.listed") : t("learn.addToday")}');
    const style = between('data-testid="course-add-today"', "</button>", reader);
    expect(style).toContain('<Icon name={addedShown ? "check_circle" : addListed ? "event_available" : "add_task"}');
    expect(style).toContain('{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }');
    expect(reader).toContain('<p role="alert" data-testid="course-add-today-failed"');
    // NEGATIVE CONTROL: the pre-change label flipped on the optimistic row alone.
    expect(reader).not.toContain('{todayTaken ? t("learn.addedToday") : t("learn.addToday")}');
  });

  it("every new string exists in EN and HE; HE is Hebrew; EN carries no verdict word", () => {
    const keys = [
      "elev.hero.academy.kicker", "elev.hero.academy.title", "elev.hero.academy.sub",
      "elev.learnCare.pick.topicTag", "elev.learnCare.pick.why.topic",
      "elev.learnCare.shortReads.title", "elev.learnCare.shortReads.titleAll", "elev.learnCare.shortReads.sub",
      "elev.learnCare.byArea", "elev.learnCare.byArea.all",
      "elev.learnCare.family.headline", "elev.learnCare.family.sub", "elev.learnCare.family.cta",
      "elev.learnCare.addToday.saving", "elev.learnCare.addToday.failed",
      "elev.learnCare.shortReads.matched", "elev.learnCare.family.title", "elev.learnCare.addToday.listed",
    ];
    for (const key of keys) {
      const enV = tr("en", key);
      const heV = tr("he", key);
      expect(enV, key).not.toBe(key);
      expect(heV, key).not.toBe(key);
      expect(heV, key).not.toBe(enV);
      expect(heV.replace("{title}", ""), key).not.toMatch(/[A-Za-z]/);
      expect(heV, key).toMatch(/[א-ת]/);
      expect(enV, key).not.toMatch(/\d\s*%|score|percentile|on track|behind|at risk|delayed|weakest/i);
    }
  });
});

/* ── v3 F-FORYOU-1 · For you, the parent: the landing as the mock, plus 390 px ──
 * The pick is one card (tag, title, why, length, the read, "Try it today",
 * how Arbor decides; the lessons or the read's key points beside it). Reads
 * open in a sheet over this page. The library is "Courses by area" with the
 * readiness courses in it and the family door after it. Phone: kicker and
 * title only, one scrolling chip row without counts, compact course rows. */

describe("v3 F-FORYOU-1 — the pick card, the sheet, the library, 390 px", () => {
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const hub = src.slice(0, src.indexOf("export function MasterclassReader("));
  const slice = (from: string, to: string): string => {
    const a = src.indexOf(from);
    expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
    const b = src.indexOf(to, a + from.length);
    expect(b, `end marker not found after ${from}: ${to}`).toBeGreaterThan(a);
    return src.slice(a, b);
  };

  it("the pick is one card: CTA, 'Try it today' (write-resolved) and how Arbor decides; no expert line", () => {
    const card = slice('data-testid="academy-pick"', "</section>}");
    expect(card).toContain('data-testid="academy-hero-cta"');
    expect(card).toContain('{pickTry && <TryTodayButton recommendation={pickTry} testId="academy-pick-try-today" />}');
    expect(card).toContain('<TrustLink surface="foryou-pick" />');
    expect(card).toContain('<Icon name="menu_book" size={14} />');
    expect(card).not.toMatch(/expert|author|\bby\b/i);
    // The evidence chip moved into the reader (LearnReadHost), off the hub.
    expect(code).not.toContain("EvidenceChip");
    // The same text and source the reader's own Add-to-today writes.
    expect(src).toContain("? (he ? todaysRead.card.tryToday.he : todaysRead.card.tryToday.en).trim()");
    expect(src).toContain("? (he ? nextCourse.tryTonightHe : nextCourse.tryTonight).trim()");
  });

  it("the second column lists plain lines: the course's lessons or the read's key points, no state", () => {
    const col = slice("{pickLessons.length > 0 && (", "</ol>");
    expect(col).toContain('t(todaysRead ? "elev.learnCare.pick.inThisRead" : "elev.learnCare.pick.lessons")');
    expect(col).toContain('<ol data-testid="academy-pick-lessons"');
    // v3 F-FORYOU-1 r2 (re-pin): a course's lesson line carries its minutes
    // (the course's own duration shared out, learn/lessonMinutes); a read's
    // key points carry none. Reading time only: still no state.
    expect(col).toContain('{pickLessons.map((line, i) => <li key={i}>{line}{pickLessonMinutes && <span data-testid="academy-pick-lesson-minutes" className="ms-2 whitespace-nowrap text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("learn.minutes", { n: pickLessonMinutes[i] })}</span>}</li>)}');
    expect(src).toContain("const pickLessonMinutes: number[] | null = !todaysRead && nextCourse");
    expect(src).toContain("? lessonMinutes(nextCourse.durationMin, nextCourse.sections.map((s) => s.body))");
    for (const banned of ["done", "check_circle", "of {", "%", "progress"]) expect(col, banned).not.toContain(banned);
    expect(src).toContain("? nextCourse.sections.map((s) => (he ? s.headingHe : s.heading))");
  });

  it("'Try it today' says Added only after the write resolved, and never adds twice", () => {
    const tt = readFileSync(path.join(__dirname, "useTryToday.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(tt).toContain('if (!text || taken || state === "saving") return;');
    expect(tt).toContain('acceptTodayAction(text, "tiny", source).then(');
    expect(tt).toContain('() => { if (mounted.current) setState("saved"); },');
    expect(tt).toContain('() => { if (mounted.current) setState("failed"); },');
    expect(tt).toContain('const added = state === "saved" || (state === "idle" && taken && actionLoopConfirmed === true);');
    expect(tt).toContain('role="alert" data-testid={`${testId}-failed`}');
    expect(tt).toMatch(/className="inline-flex min-h-11 /);
    // NEGATIVE CONTROL: an optimistic label would flip on the tap alone.
    expect(tt).not.toContain('setState("saved");\n    acceptTodayAction');
  });

  it("a read opens in a sheet over #/masterclasses (lazy, mounted only while open)", () => {
    expect(src).toContain('const ForYouReadSheet = lazy(() => import("./ForYouReadSheet"));');
    expect(src).toContain("<ForYouReadSheet cardId={readId} onClose={() => setReadId(null)} />");
    expect(code).not.toContain("requestLearnRead");
    expect(code).not.toContain('setActiveTab("learn")');
    const sheet = readFileSync(path.join(__dirname, "ForYouReadSheet.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(sheet).toContain("const close = useSheetHistory(true, onClose);");
    expect(sheet).toContain("<LearnReadHost cardId={cardId} />");
    expect(sheet).not.toMatch(/data-module|data-primary-move/);
  });

  it("the readiness courses are read here, with no progress of any shape", () => {
    expect(src).toContain('data-testid="academy-readiness-course" onClick={() => setReadinessId(r.id)}');
    expect(src).toContain('if (openReadiness) return <ReadinessReader course={openReadiness} onBack={() => setReadinessId(null)} />;');
    const reader = readFileSync(path.join(__dirname, "ReadinessReader.tsx"), "utf8").replace(/\r\n/g, "\n");
    const readerCode = reader.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of ["ProgressBar", "progressbar", "of {", "%", "done", "streak", "day {"]) expect(readerCode, banned).not.toContain(banned);
    expect(reader).toContain('<TryTodayButton recommendation={a.title} testId="readiness-try-today" />');
    expect(reader).toContain('<Icon name="arrow_back" size={16} className="rtl:-scale-x-100" /> {t("companion.door.learn")}');
  });

  it("390 px: kicker and title only, one scrolling chip row with no counts, compact course rows", () => {
    expect(hub).toMatch(/data-testid="academy-hero-sub" className="[^"]*\bhidden\b[^"]*\bsm:block\b/);
    expect(hub).toContain('data-testid="academy-by-area" className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap"');
    expect(hub).toContain('<span className="hidden sm:inline"><span className="tabular-nums" style={{ opacity: 0.75 }}>{count}</span></span>');
    expect(hub).toMatch(/const COURSE_CARD = `\$\{cardCls\} flex min-h-11 min-w-0 items-center gap-3 p-3 [^`]*sm:flex-col/);
    // The family row: a 56 px picture on a phone, the CTA text and a mirrored chevron.
    const door = slice('data-testid="academy-family-door"', "</button>");
    expect(door).toMatch(/className="h-14 w-14 /);
    expect(door).toContain('<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />');
  });

  it("the age switch is a quiet 44 px text switch under the chips", () => {
    const sw = slice("{ageSwitchShown && (", "</button>");
    expect(sw).toContain('role="switch"');
    expect(sw).toContain("aria-checked={showAllAges}");
    expect(sw).toContain('data-testid="agefilter-toggle-masterclasses"');
    expect(sw).toContain("min-h-11");
    expect(sw).not.toContain("--gradient-cta");
    // v3 F-FORYOU-1 r2 (re-pin): the chip row's opening marker (saved reads join it).
    expect(src.indexOf("{(areaCounts.length > 1 || savedReads.length > 0) && (")).toBeGreaterThan(-1);
    expect(src.indexOf("{(areaCounts.length > 1 || savedReads.length > 0) && (")).toBeLessThan(src.indexOf("{ageSwitchShown && ("));
  });

  it("every F-FORYOU-1 string exists in EN and HE; HE is Hebrew; EN carries no verdict word", () => {
    const keys = [
      "elev.learnCare.pick.tryToday", "elev.learnCare.pick.lessons", "elev.learnCare.pick.inThisRead",
      "elev.learnCare.reads.title", "elev.learnCare.library.kicker", "elev.learnCare.library.title",
      "elev.learnCare.readiness.activities", "elev.learnCare.readiness.inThis",
    ];
    for (const key of keys) {
      const enV = tr("en", key, { n: 3 });
      const heV = tr("he", key, { n: 3 });
      expect(enV, key).not.toBe(key);
      expect(heV, key).not.toBe(key);
      expect(heV, key).not.toBe(enV);
      expect(heV, key).not.toMatch(/[A-Za-z]/);
      expect(heV, key).toMatch(/[א-ת]/);
      expect(enV, key).not.toMatch(/\d\s*%|score|percentile|on track|behind|at risk|delayed|weakest|\bof\b/i);
    }
  });
});

/* ── v3 F-FORYOU-1 r2 · reviewer r1 ─────────────────────────────────────────
 * The week's concept is one of the three short reads (the old Scholar hub
 * card's piece, opened in a sheet of its own); the parent's saved reads are
 * one chip away in the library, every one of them; a course's lesson lines
 * carry their minutes. */

describe("v3 F-FORYOU-1 r2 — the week's concept, the Saved chip, lesson minutes", () => {
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const slice = (from: string, to: string, base = src): string => {
    const a = base.indexOf(from);
    expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
    const b = base.indexOf(to, a + from.length);
    expect(b, `end marker not found after ${from}: ${to}`).toBeGreaterThan(a);
    return base.slice(a, b);
  };

  it("the week's concept: chosen only once the map has a real signal, never the no-signal default", () => {
    expect(src).toContain("const weekly = devMapHasSignal(devScore) ? selectWeeklyArticle(devScore.focusDomain) : null;");
    expect(src).toContain("const weeklyConcept = weekly && !weekly.isDefault ? weekly.article : null;");
    expect(src).toContain("const concept = shortReadRow.concept;");
    // NEGATIVE CONTROL: an ungated pick would show everyone the same default piece.
    expect("const weekly = selectWeeklyArticle(devScore.focusDomain);").not.toContain("devMapHasSignal(devScore)");
  });

  it("the concept card sits in the short reads row, in the same card shape, and opens its own sheet", () => {
    const row = slice('data-testid="academy-short-reads"', "</section>");
    const card = slice('data-testid="academy-short-read-concept"', "</button>", row);
    expect(row.indexOf("{shortReadRow.reads.map((c) => {")).toBeLessThan(row.indexOf("{concept && ("));
    expect(card).toContain("onClick={() => openConcept(concept.id)}");
    expect(card).toContain("min-h-11");
    expect(card).toContain('data-testid="academy-short-read-area" data-area={conceptArea}');
    expect(card).toContain("<Icon name={DOMAIN_ICONS[conceptArea]} size={14} /><span>{domainName(conceptArea, t)}</span>");
    expect(card).toContain('<Icon name="schedule" size={13} />{t("learn.minutes", { n: concept.readingMinutes })}');
    expect(card).toContain('<Icon name="lightbulb" size={13} />{t("elev.learnCare.weekly.mark")}');
    expect(card).toContain('className="arbor-type-say arbor-accent-rule line-clamp-3 block"');
    expect(src).toContain('const conceptArea = concept ? primaryDomain("developmental", concept.domain) : null;');
    expect(src).toContain('const ForYouConceptSheet = lazy(() => import("./ForYouConceptSheet"));');
    expect(src).toContain("<ForYouConceptSheet articleId={conceptId} onClose={() => setConceptId(null)} />");
    for (const banned of ["ProgressBar", "progressbar", "of {", "/ total", "done[", "riskLevel", "percent"]) {
      expect(card, banned).not.toContain(banned);
    }
    expect(card).not.toMatch(/\}\s*%|%\s*\{/);
  });

  it("the concept sheet: one history entry, the provenance hedge and the Trust Center chain, no module or move", () => {
    const sheet = readFileSync(path.join(__dirname, "ForYouConceptSheet.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(sheet).toContain("const close = useSheetHistory(true, onClose);");
    expect(sheet).toContain("<SheetBreadcrumb label={title} close={close} />");
    expect(sheet).toContain('{t("hub.scholar.provenance")}');
    expect(sheet).toContain('<TrustLink surface="foryou-weekly" />');
    expect(sheet).toContain('const area = primaryDomain("developmental", article.domain);');
    expect(sheet).not.toMatch(/data-module|data-primary-move/);
    const sheetCode = sheet.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of ["ProgressBar", "progressbar", "of {", "%", "score", "riskLevel"]) {
      expect(sheetCode, banned).not.toContain(banned);
    }
  });

  it("the Saved chip: the parent's saved reads, last in the row, with a plain number", () => {
    const chips = slice("{(areaCounts.length > 1 || savedReads.length > 0) && (", "{ageSwitchShown && (");
    const chip = slice('data-testid="academy-saved-chip"', "</button>", chips);
    expect(chips.indexOf("{areaCounts.map(({ area, count }) => (")).toBeLessThan(chips.indexOf("{savedReads.length > 0 && ("));
    expect(chip).toContain("aria-pressed={showSaved}");
    expect(chip).toContain("onClick={() => (showSaved ? chooseArea(null) : setSavedShelf(true))}");
    expect(chip).toContain("className={AREA_CHIP}");
    expect(chip).toContain('<Icon name="bookmark" size={15} fill={showSaved ? 1 : 0} />');
    expect(chip).toContain('<span>{t("learn.saved")}</span>');
    // A count of the parent's own bookmarks, shown on a phone too (no "hidden").
    expect(chip).toContain('<span data-testid="academy-saved-count" className="tabular-nums" style={{ opacity: 0.75 }}>{savedReads.length}</span>');
    expect(chip).not.toContain("hidden");
    for (const banned of ["%", "total", "ProgressBar", "done[", "of {"]) expect(chip, banned).not.toContain(banned);
    expect(src).toContain("const savedReads = savedLearnIds.map((id) => learnCardById(id)).filter((c): c is LearnCard => c !== undefined);");
    expect(src).toContain("const showSaved = savedShelf && savedReads.length > 0;");
  });

  it("law 6: chosen, the grid lists EVERY saved read (uncapped), each opening in the read sheet", () => {
    const grid = slice('<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">', "{catalog.map((c) => {");
    expect(grid).toContain("{showSaved && savedReads.map((c) => (");
    expect(grid).toContain('data-testid="academy-saved-read" onClick={() => openRead(c.id, "learn-hub-saved")} className={COURSE_CARD}');
    expect(code).not.toMatch(/savedReads\.slice\(/);
    expect(code).not.toMatch(/savedLearnIds\.slice\(/);
    // The courses and the readiness courses step aside while Saved is chosen,
    // and so does the age switch (a parent's own saves are never age-filtered).
    expect(src).toContain('const selectedArea: DomainId | "saved" | null = showSaved');
    expect(src).toContain("const ageSwitchShown = !showSaved && ((ageHidden.length > 0 || showAllAges) || readinessHidden.length > 0);");
    // NEGATIVE CONTROL: a capped list would trip the same scan.
    expect("savedReads.slice(0, 6).map((c) => (").toMatch(/savedReads\.slice\(/);
  });

  it("a request for the saved reads lands on the Saved chip (peeked on mount, taken once in the scroll frame)", () => {
    expect(src).toContain('const [savedShelf, setSavedShelf] = useState<boolean>(() => peekLibraryScroll() === "saved");');
    expect(src).toContain("if (typeof window === \"undefined\" || !peekLibraryScroll()) return;");
    expect(src).toContain("if (takeLibraryScroll()) libraryRef.current?.scrollIntoView({ block: \"start\" });");
    // The r1 shape TOOK the flag in a state initialiser, which StrictMode runs
    // twice (the second run read null and the scroll was lost).
    expect(code).not.toContain("useState(() => takeLibraryScroll())");
    expect(code.match(/takeLibraryScroll\(\)/g) ?? []).toHaveLength(1);
    // NEGATIVE CONTROL: the r1 line trips the same scan.
    expect("const [scrollToLibrary] = useState(() => takeLibraryScroll());").toContain("useState(() => takeLibraryScroll())");
  });

  it("the new string exists in EN and HE; HE is Hebrew; EN carries no verdict word", () => {
    for (const key of ["elev.learnCare.weekly.mark", "learn.saved", "learn.minutes"]) {
      const enV = tr("en", key, { n: 3 });
      const heV = tr("he", key, { n: 3 });
      expect(enV, key).not.toBe(key);
      expect(heV, key).not.toBe(key);
      expect(heV, key).not.toBe(enV);
      expect(heV, key).not.toMatch(/[A-Za-z]/);
      expect(heV, key).toMatch(/[\u05d0-\u05ea]/);
      expect(enV, key).not.toMatch(/\d\s*%|score|percentile|on track|behind|at risk|delayed|weakest/i);
    }
  });
});
