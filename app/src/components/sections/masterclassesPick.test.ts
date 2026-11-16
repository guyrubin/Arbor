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
const library = readFileSync(path.join(__dirname, "LearnLibrary.tsx"), "utf8").replace(/\r\n/g, "\n");
const ds = readFileSync(path.join(__dirname, "..", "..", "design", "ds.css"), "utf8");
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
const CTA_OPENS_PICK = /onClick=\{\(\) => todaysRead \? requestLearnRead\(\{ cardId: todaysRead\.card\.id/;
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
  it("v10: the pick CTA is the page's one primary (the sapphire btn primary), never the success green as a fill", () => {
    const cta = src.slice(src.indexOf('data-testid="academy-hero-cta"'), src.indexOf("</button>", src.indexOf('data-testid="academy-hero-cta"')));
    expect(cta).toContain('className="btn primary"');
    expect(cta).not.toContain('background: "var(--arbor-green-ink)"');
    expect(cta).not.toContain("--gradient-cta");
  });
  it("v10: the pick's title is the page's one h1 (display hero), above the courses' rail heading", () => {
    expect(src).toContain('<h1 className="hero" id="fy-pick-title" dir="auto">{pickTitle ?? t("elev.hero.academy.title")}</h1>');
    expect(src.indexOf("const pickScene = (")).toBeLessThan(src.indexOf("const coursesBlock = ("));
    expect(src).toContain('<h2 className="h3" id="fy-courses-title">{t("elev.learnCare.byArea")}</h2>');
    // The age switch belongs to the courses list: it sits in the rail's own head.
    const head = src.slice(src.indexOf('<div className="rh fy-railhead">'), src.indexOf("{coursesBlock}", src.indexOf('<div className="rh fy-railhead">')));
    expect(head).toContain("{ageSwitch}");
  });
  it("with no map signal, ONE muted line with a 44 px door stands in for For You + Scholar Hub", () => {
    expect(src).toMatch(/\{devMapHasSignal\(devScore\) \? \(\s*<>[\s\S]*<AcademyForYou \/>[\s\S]*<ScholarHubCard \/>[\s\S]*<\/>\s*\) : \(/);
    const at = src.indexOf('data-testid="academy-rail-nosignal"');
    const line = src.slice(src.lastIndexOf("<MoreLink", at), src.indexOf("</MoreLink>", at));
    // MoreLink is the .ds-link: a 44 px text door with a mirrored chevron.
    expect(line).toContain('onClick={() => setActiveTab("milestones")}');
    expect(line).toContain('t("elev.growthTruth.learn.rail.noSignal", { name: childName })');
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

  it("the hub quotes the note on the logs branch only, in the parent's ink knot (the editorial face)", () => {
    expect(src).toContain("const pickMoment = todaysRead && !todaysRead.fromSaved && todaysRead.fromConcerns ? todaysRead.fromMoment : null;");
    expect(src).toContain('<div className="knot you">');
    expect(src).toContain('<span className="q" dir="auto">“<bdi>{pickTopic ?? pickMoment!.text}</bdi>”</span>');
    expect(ds).toMatch(/\.ds \.ds-said, \.ds \.knot q, \.ds \.knot \.q \{ font-family: var\(--font-editorial/);
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

  it("the comment strip is real (NEGATIVE CONTROL: a comment naming an attribute is not counted)", () => {
    expect(code.length).toBeGreaterThan(1000);
    const sample = '{/* data-module="x" */}<div data-module="y" />';
    expect(sample.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").match(/\bdata-module\b(?!-)/g)).toHaveLength(1);
    expect(reader.length).toBeGreaterThan(1000);
  });
  it("the open family question joins the ranking as the parent's own words", () => {
    expect(src).toContain("const { childProfile, behaviorLogs, savedLearnIds, requestLearnRead, setActiveTab, activeFamilyTopic } = useArbor();");
    const block = /const learnSignals: LearnRankSignals = \{([\s\S]*?)\};/.exec(src);
    expect(block).toBeTruthy();
    expect(block![1]).toContain("topicText: activeFamilyTopic?.title ?? null,");
    expect(PRE_CHANGE).not.toContain("topicText"); // negative control
  });

  it("the tag and the quoted question show only when the question MOVED the pick", () => {
    expect(src).toContain("const pickTopic = todaysRead?.fromTopic && activeFamilyTopic ? activeFamilyTopic.title : null;");
    // NEGATIVE CONTROL: a question merely existing is not a reason.
    expect(code).not.toMatch(/\{activeFamilyTopic && \(/);
    expect(src).toContain('const youKnot = todaysRead && (pickTopic || pickMoment) ? (');
    const ai = between("const aiKnot = todaysRead ? (", ") : null;");
    expect(ai).toContain('<b data-testid="academy-pick-topic">{t("elev.learnCare.pick.topicTag")}</b>');
    expect(ai).toContain("{copy.arborSuggests}");
    // The question outranks the note in the parent's knot and in Arbor's.
    expect(src).toContain('{pickTopic ? t("elev.learnCare.shortReads.matched") : pickMomentLead}');
    expect(ai.indexOf("academy-pick-topic")).toBeLessThan(ai.indexOf('data-why={pickMoment ? "moment" : undefined}'));
    expect(src.indexOf("const aiKnot")).toBeLessThan(src.indexOf('data-testid="academy-hero-cta"'));
  });
  it("the question is quoted whole and bidi-isolated, never spliced into a translated sentence", () => {
    expect(src).toContain("“<bdi>{pickTopic ?? pickMoment!.text}</bdi>”");
    expect(code).not.toContain("TOPIC_SLOT");
    for (const lang of ["en", "he"] as const) {
      const tag = tr(lang, "elev.learnCare.pick.topicTag");
      expect(tag, lang).not.toBe("elev.learnCare.pick.topicTag");
      expect(tag, lang).not.toContain("{");
    }
  });
  it("the hero CTA still opens today's read; one primary move and at most 3 top-level modules", () => {
    expect(CTA_OPENS_PICK.exec(src)).toBeTruthy();
    expect((code.match(/\bdata-primary-move="/g) ?? []).length).toBe(1);
    expect(code).toContain('data-primary-move="open-todays-pick"');
    const modules = code.match(/\bdata-module="[^"]+"/g) ?? [];
    expect(modules).toEqual(['data-module="academy-today"', 'data-module="academy-catalogue"', 'data-module="academy-programs"', 'data-module="academy-more"']);
    // The More to read tail is demoted: top-level = stamped − demoted ≤ 3.
    expect(code).toContain('data-module="academy-more" data-module-demoted');
    expect(modules.length - (code.match(/\bdata-module-demoted\b/g) ?? []).length).toBeLessThanOrEqual(3);
  });
  it("short reads moved to the Library ('Linked from your week'), still filled from the same pick and the open question", () => {
    expect(code).not.toContain("academy-short-read");
    expect(library).toContain("pickShortReads(");
    expect(library).toContain("activeFamilyTopic?.title");
    expect(library).toContain('data-testid="learn-linked"');
  });
  it("courses by area: labelled controls with aria-pressed filter the list; the counts are plain integers", () => {
    const chips = between("{areaCounts.length > 1 && (", "{shownCourses.map((c) => {");
    expect(chips).toContain('role="group" aria-label={t("elev.learnCare.byArea")} data-testid="academy-by-area"');
    expect(chips).toContain("aria-pressed={selectedArea === area}");
    expect(chips).toContain("onClick={() => setActiveArea(selectedArea === area ? null : area)}");
    expect(chips).toContain("<b>{count}</b><span>{domainName(area, t)}</span>");
    expect(chips).toContain('{t("elev.learnCare.byArea.all")}');
    expect(chips).not.toContain("msIcon"); // NEGATIVE CONTROL: no shelf glyph
    for (const banned of ["%", "total", "ProgressBar", "done["]) expect(chips, banned).not.toContain(banned);
    expect(src).toContain("const [activeArea, setActiveArea] = useState<DomainId | null>(null);");
    expect(src).toContain("const areaCounts = courseAreaCounts(catalog);");
    expect(src).toContain("const courseList = catalog.filter((c) => !selectedArea || courseArea(c.id) === selectedArea);");
  });
  it("family formation: one door to #/family under More to read, not a module of its own and not a second CTA", () => {
    const at = src.indexOf('data-testid="academy-family-door"');
    const door = src.slice(src.lastIndexOf("<Tile", at), src.indexOf("</Tile>", at));
    expect(door).toContain('<MoreLink onClick={() => setActiveTab("family")}>');
    expect(door).toContain("art={TOGETHER_ART}");
    expect(door).toContain('t("elev.learnCare.family.cta")');
    expect(door).toContain('t("elev.learnCare.family.title")');
    expect(door).not.toContain('t("sec.family.title")');
    for (const banned of ["--gradient-cta", "data-module", "data-primary-move"]) expect(door, banned).not.toContain(banned);
    expect(at).toBeGreaterThan(src.indexOf('data-testid="academy-courses"'));
    expect(at).toBeLessThan(src.indexOf('data-testid="academy-rail"'));
  });
  it("no course progress anywhere on the hub (no bar, no %, no 'n of m')", () => {
    for (const banned of ["<ProgressBar", "lessonOf", "}%", "of {total}", 'role="progressbar"', "doneCount / total"]) {
      expect(code, banned).not.toContain(banned);
    }
    // A finished course fills its marks; nothing finer is recorded or drawn.
    expect(code).toContain('className={`pip${isCardDone ? " on" : ""}`}');
    expect("{done} of {total}").toContain("of {total}"); // negative control
  });
  it("v10: the h1 is the pick; with nothing to pick, the hub's title (naming no child) and its one line", () => {
    expect(src).toContain('{pickTitle ?? t("elev.hero.academy.title")}');
    expect(src).toContain('{!pickTitle && <p className="fy-pick-hook">{t("elev.hero.academy.sub")}</p>}');
    expect(src).not.toContain('t("elev.hero.academy.title", { name: childName })');
    for (const lang of ["en", "he"] as const) expect(tr(lang, "elev.hero.academy.title"), lang).not.toContain("{name}");
  });
  it("the course row's read link carries a mirrored glyph, not a text arrow", () => {
    expect(src).toContain('<>{t("master.read")}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" /></>');
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
