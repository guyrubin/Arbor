import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-05 — the program page. Enrolled week-5 fixture (Talk Together,
   started 9 Sep, read on 10 Oct), EN + HE: the header names the program and
   the week, three count rows each carry the family's OWN first-week number in
   muted ink, no %, no colour verdict, exactly ONE primary move, the week list
   (done plain · current open · future titles only), Pause · Finish behind a
   confirm, and "What the professional sees" shows the packet line as plain
   text. Not enrolled: the quiet page with the two programs' Start (never a
   dead route). Zero model calls. */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  rows: {} as Record<string, unknown[]>,
  observations: [] as unknown[],
  actionLoop: [] as unknown[],
  gender: "boy" as string | null,
  dob: "2024-05-01",
}));

vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "child-1", name: "Alex Example", gender: state.gender, dateOfBirth: state.dob, dob: state.dob },
    actionLoop: state.actionLoop,
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_childId: string, name: string) => ({
    items: state.rows[name] ?? [],
    loaded: true,
    error: false,
    remote: false,
    upsert: async () => undefined,
    remove: async () => undefined,
    replaceAll: async () => undefined,
  }),
}));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => state.observations }));

import ProgramPage, { ProgramPageView } from "./ProgramPage";
import { programPacketLine, programPageModel, startablePrograms } from "../../lib/programPage";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { ProgramEnrolment } from "../../lib/programs/enrolment";
import type { ActionLoopEntry } from "../../actionLoop/model";

const NOW = new Date(2026, 9, 10, 12, 0, 0); // 10 Oct 2026, local noon → week 5 of a 9 Sep start
const ENROLMENT: ProgramEnrolment = {
  id: "talk-together.2026-09-09",
  programId: "talk-together",
  startedAt: "2026-09-09",
  enrolledAt: "2026-09-09T08:00:00.000Z",
  currentWeek: 5,
  status: "active",
  baseline: { childProxy: null, capturedAt: null },
  updatedAt: "2026-10-07T08:00:00.000Z",
};
const dose = (day: string, selfCount: number): ActionLoopEntry => ({
  id: `practice.child-1.${day}`,
  recommendation: "practice",
  source: "practice",
  capacity: "low",
  status: "completed",
  acceptedAt: `${day}T09:00:00.000Z`,
  outcome: "helped",
  selfCount,
  shelf: "words",
} as unknown as ActionLoopEntry);
// week 1: 2 days (1 + 1 turns) · week 4: 3 days · week 5: 4 days (2 + 3 + 2 + 5 = 12 turns)
const LOOPS: ActionLoopEntry[] = [
  dose("2026-09-09", 1), dose("2026-09-12", 1),
  dose("2026-10-01", 2), dose("2026-10-03", 2), dose("2026-10-05", 2),
  dose("2026-10-07", 2), dose("2026-10-08", 3), dose("2026-10-09", 2), dose("2026-10-10", 5),
];
const word = (day: string, phrase: string) => ({ at: new Date(`${day}T12:00:00`).toISOString(), shelf: "words", value: { type: "word", language: "en", phrase } });
// new words: week 1 one, week 5 two
const OBS = [word("2026-09-10", "ball"), word("2026-10-08", "more"), word("2026-10-09", "juice")];
const INPUTS = { childId: "child-1", actionLoops: LOOPS, observations: OBS as never, sleepLogs: [] };

const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const noop = () => undefined;

function renderView(lang: "en" | "he", enrolment: ProgramEnrolment | null = ENROLMENT) {
  state.lang = lang;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const model = enrolment ? programPageModel([enrolment], INPUTS, NOW, lang, "boy") : null;
  const html = renderToStaticMarkup(
    <ProgramPageView
      childName="Dylan"
      model={model}
      startable={startablePrograms(28, lang)}
      packetLine={model ? programPacketLine(model, t) : ""}
      onBack={noop}
      onDoToday={noop}
      onResume={noop}
      onPause={noop}
      onFinish={noop}
      onEnrol={noop}
    />,
  );
  return { html, model };
}

const countRows = (html: string) => html.split('data-testid="program-count"').slice(1);
const CHROMATIC = /--arbor-(?:green|amber|red|coral|danger|warn|success|yellow|peach|pink)/;

describe("B-PROG-05 — the model reads the engine: three counts beside the family's own first week", () => {
  it("week 5 of 8; dose 4 (last week 3, first week 2); turns 12 from 4 days (first week 2); new words 2 (first week 1)", () => {
    const model = programPageModel([ENROLMENT], INPUTS, NOW, "en", "boy")!;
    expect(model.week).toBe(5);
    expect(model.weeks).toBe(8);
    const by = Object.fromEntries(model.counts.map((c) => [c.id, c]));
    expect(by.dose).toMatchObject({ value: 4, lastWeek: 3, baseline: 2 });
    expect(by.parent).toMatchObject({ measureId: "turns-waited", value: 12, from: 4, baseline: 2 });
    expect(by.child).toMatchObject({ measureId: "new-words", value: 2, baseline: 1 });
  });

  it("a captured first-week baseline wins over the recount; week 1 carries no baseline", () => {
    const captured = { ...ENROLMENT, baseline: { childProxy: 3, capturedAt: "2026-09-16T08:00:00.000Z" } };
    expect(programPageModel([captured], INPUTS, NOW, "en")!.counts.find((c) => c.id === "child")!.baseline).toBe(3);
    const wk1 = programPageModel([ENROLMENT], INPUTS, new Date(2026, 8, 11, 12), "en")!;
    expect(wk1.week).toBe(1);
    expect(wk1.counts.every((c) => c.baseline === null && c.lastWeek === null)).toBe(true);
  });

  it("the week list: weeks 1-4 done, 5 current, 6-8 future; titles are the skill up to its colon", () => {
    const model = programPageModel([ENROLMENT], INPUTS, NOW, "en")!;
    expect(model.weekRows.map((w) => w.state)).toEqual(["done", "done", "done", "done", "current", "future", "future", "future"]);
    expect(model.weekRows[4].title).toBe("Add one word");
  });

  it("the packet line: program, week, practice days of 7, both proxies as counts with their first week", () => {
    const model = programPageModel([ENROLMENT], INPUTS, NOW, "en")!;
    const line = programPacketLine(model, (k, v) => translate("en", k, v));
    expect(line).toBe(
      "Talk Together: week 5 of 8 · practice days 4/7 this week · Turns you waited for: 12 (from 4 practice days; first week 2) · New words this week: 2 (first week 1)",
    );
    expect(line).not.toMatch(/%/);
  });

  it("done enrolments never show; a paused one does", () => {
    expect(programPageModel([{ ...ENROLMENT, status: "done" }], INPUTS, NOW, "en")).toBeNull();
    expect(programPageModel([{ ...ENROLMENT, status: "paused", pausedAt: "2026-10-01" }], INPUTS, NOW, "en")!.status).toBe("paused");
  });
});

describe("B-PROG-05 — rendered week 5, EN + HE", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: header, skill band, three count rows with baseline numbers, one primary move, no % and no colour verdict`, () => {
      const { html } = renderView(lang);
      const plain = text(html);
      expect(plain).toContain(lang === "en" ? "Talk Together · week 5 of 8" : "מדברים ביחד · שבוע 5 מתוך 8");
      const rows = countRows(html);
      expect(rows).toHaveLength(3);
      for (const r of rows) {
        expect(r).toContain('data-testid="program-count-value"');
        expect(r).toContain('data-testid="program-count-baseline"');
        expect(r).toMatch(/data-testid="program-count-baseline"[^>]*style="color:var\(--arbor-muted\)"/);
        expect(CHROMATIC.test(r)).toBe(false);
      }
      expect(plain).toContain(lang === "en" ? "first week 2" : "שבוע ראשון: 2");
      expect(plain).toContain(lang === "en" ? "first week 1" : "שבוע ראשון: 1");
      expect(plain).not.toMatch(/%/);
      expect(loopFirewallHits(plain)).toEqual([]);
      expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
      expect(html).toContain('data-primary-move="do-this-week"');
      // no bar, no chart, no trend arrow
      expect(html).not.toMatch(/<svg|role="progressbar"|<progress|trending_|arrow_upward|arrow_downward/);
      // three modules
      expect((html.match(/data-module="/g) || []).length).toBe(3);
      // Hebrew slash forms resolved from the profile gender
      if (lang === "he") expect(plain).not.toMatch(/[֐-׿]\/[֐-׿]/);
    });

    it(`${lang}: the week list, Pause · Finish, and the professional's packet line as plain text`, () => {
      const { html } = renderView(lang);
      const rows = html.match(/data-testid="program-week-row"[^>]*data-state="(\w+)"/g) || [];
      expect(rows).toHaveLength(8);
      expect((html.match(/data-testid="program-week-open"/g) || []).length).toBe(1);
      expect(html).toContain('data-testid="program-pause"');
      expect(html).toContain('data-testid="program-finish"');
      expect(html).not.toContain('data-testid="program-confirm"'); // the confirm opens on tap only
      const pro = text(html.split('data-testid="program-packet-line"')[1].split("</p>")[0]);
      expect(pro).toContain(lang === "en" ? "practice days 4/7 this week" : "ימי תרגול 4/7 השבוע");
      expect(text(html)).toContain(translate(lang, "elev.program.pro.door"));
    });
  }

  it("paused: the primary move resumes the same week; no Pause control", () => {
    const { html } = renderView("en", { ...ENROLMENT, status: "paused", pausedAt: "2026-10-08" });
    expect(html).toContain('data-testid="program-resume"');
    expect(text(html)).toContain("Pick up week 5");
    expect(html).not.toContain('data-testid="program-pause"');
    expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
  });
});

describe("B-PROG-05 — not enrolled: the quiet page, never a dead route", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: "No program running" with Talk Together and Steady Nights to start, one primary move`, () => {
      const { html } = renderView(lang, null);
      const plain = text(html);
      expect(plain).toContain(translate(lang, "elev.program.none.title"));
      expect((html.match(/data-testid="program-choice"/g) || []).length).toBe(2);
      expect(html).toContain('data-program-id="talk-together"');
      expect(html).toContain('data-program-id="steady-nights"');
      expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
      expect(loopFirewallHits(plain)).toEqual([]);
    });
  }

  it("under 12 months Steady Nights is not offered to start (it opens from 12 months)", () => {
    const sn = startablePrograms(8, "en").find((p) => p.id === "steady-nights")!;
    expect(sn.canEnrol).toBe(false);
    expect(startablePrograms(8, "en").find((p) => p.id === "talk-together")!.canEnrol).toBe(true);
  });
});

describe("B-PROG-05 — the container and the door", () => {
  it("the container renders the enrolled page from the programs collection, and the quiet page without one", () => {
    state.lang = "en";
    state.observations = OBS;
    state.actionLoop = LOOPS;
    state.rows = { programs: [{ ...ENROLMENT, startedAt: "2020-01-01", id: "talk-together.2020-01-01" }] };
    expect(renderToStaticMarkup(<ProgramPage />)).toContain('data-state="active"');
    state.rows = {};
    expect(renderToStaticMarkup(<ProgramPage />)).toContain('data-state="none"');
  });

  const src = (rel: string) => readFileSync(path.resolve(__dirname, rel), "utf8");
  it("the container writes only what the engine returns (enrol · pause · resume · finish · baseline)", () => {
    const s = src("./ProgramPage.tsx");
    for (const fn of ["enrolInProgram(", "pauseEnrolment(", "resumeEnrolment(", "finishEnrolment(", "captureBaseline("]) expect(s).toContain(fn);
    expect(s).toContain('useChildCollection<ProgramEnrolment>(childId, "programs")');
    // ONE stamp literal on the page
    expect((s.match(/"data-primary-move"/g) || []).length).toBe(1);
    // no model call anywhere on the page
    expect(s).not.toMatch(/\bapi\.|fetch\(|generate|gemini/i);
  });

  it("the Growth leaf mounts the page at ?view=program; My child keeps exactly one primary move", () => {
    // Parity 9 Oct: Shell mounts it on #/development?view=program.
    expect(src("../layout/Shell.tsx")).toContain('query.get("view") === "program" ? <ProgramPage/>');
    // v3 F-CHILD-1 RE-PIN: the program door sat in the portrait's record tools,
    // which the v3 brief removes from My child (programs move to Care in
    // F-CARE-1; the route above stays live). The page's one primary move is
    // now handed to the 5-minute check as a spread prop, so it is counted by
    // name rather than by the attribute literal. Was: the door + one literal.
    const s = src("../companion/ChildPortrait.tsx");
    expect(s).not.toContain('window.location.hash = "#/development?view=program"');
    expect((s.match(/\bdata-primary-move\b(?!-)/g) || []).length).toBe(1);
  });
});

import { PROGRAM_PILOT_FLAG_KEY, PROGRAM_PILOT_LINE_EXPOSED, programPilotCount, programPilotLine } from "../../lib/programPage";
import { programById } from "../../content/programs";
import { programPilotText, hardMomentPilotText } from "../../content/hardMomentPilotText";
import { PilotNote } from "../ui/PilotNote";

/* B-PROG-15 — a draft program says it is a pilot, in the hard-moment guide's
   own PilotNote, while its reviewStatus is "draft"; signed, the line goes.
   Shown by default (Guy's decided default, 11 Oct); the house device flag is
   a per-device review switch ("0" off, "1" on). The chooser above two draft
   programs speaks in the plural. */
describe("B-PROG-15 — the pilot line on a draft program", () => {
  const flagged = (value: string | null) => ({ getItem: (key: string) => (key === PROGRAM_PILOT_FLAG_KEY ? value : null) });

  it("shown by default on every draft; the device switch turns it off or on; a broken store falls back to the default", () => {
    expect(PROGRAM_PILOT_LINE_EXPOSED).toBe(true);
    for (const id of ["talk-together", "steady-nights"]) {
      expect(programById(id)?.reviewStatus).toBe("draft");
      expect(programPilotLine(id, { storage: null })).toBe(true);
      expect(programPilotLine(id, { storage: flagged(null) })).toBe(true);
      expect(programPilotLine(id, { storage: flagged("0") })).toBe(false);
      expect(programPilotLine(id, { storage: flagged("1"), exposed: false })).toBe(true);
      expect(programPilotLine(id, { storage: null, exposed: false })).toBe(false);
      expect(programPilotLine(id, { storage: { getItem: () => { throw new Error("blocked"); } } })).toBe(true);
    }
    expect(programPilotLine("not-a-program")).toBe(false);
  });

  it("signed (approved) or retired: the line disappears whatever the switch says", () => {
    const program = programById("talk-together")!;
    const was = program.reviewStatus;
    try {
      for (const status of ["approved", "retired"] as const) {
        (program as { reviewStatus: string }).reviewStatus = status;
        expect(programPilotLine("talk-together", { storage: null })).toBe(false);
        expect(programPilotLine("talk-together", { storage: flagged("1") })).toBe(false);
      }
      // One signed, one draft: the chooser speaks of ONE pilot program.
      (program as { reviewStatus: string }).reviewStatus = "approved";
      expect(programPilotCount(["talk-together", "steady-nights"], { storage: null })).toBe("one");
    } finally {
      (program as { reviewStatus: string }).reviewStatus = was;
    }
    expect(programPilotCount(["talk-together", "steady-nights"], { storage: null })).toBe("many");
    expect(programPilotCount(["talk-together"], { storage: null })).toBe("one");
    expect(programPilotCount(["talk-together", "steady-nights"], { storage: flagged("0") })).toBeNull();
  });

  it.each(["en", "he"] as const)("by default the page shows it in the header module: singular on the program, plural on the chooser (%s)", (lang) => {
    state.lang = lang;
    vi.stubGlobal("localStorage", flagged(null));
    try {
      const one = programPilotText(lang, "one");
      const many = programPilotText(lang, "many");
      state.rows = { programs: [ENROLMENT] };
      const enrolled = renderToStaticMarkup(<ProgramPage />);
      expect(enrolled).toContain('data-testid="program-pilot"');
      expect(text(enrolled)).toContain(one.status);
      expect(text(enrolled)).toContain(one.explanation);
      // Inside the existing header module: no new module, the budget is unchanged.
      const header = enrolled.slice(enrolled.indexOf('data-module="program-week"'), enrolled.indexOf('data-testid="program-week-band"'));
      expect(header).toContain('data-testid="program-pilot"');
      state.rows = {};
      const quiet = renderToStaticMarkup(<ProgramPage />);
      expect(quiet.match(/data-testid="program-pilot"/g)).toHaveLength(1);
      expect(text(quiet)).toContain(many.status);
      expect(text(quiet)).toContain(many.explanation);
      expect(text(quiet)).not.toContain(one.explanation);
    } finally {
      vi.unstubAllGlobals();
      state.rows = {};
    }
  });

  it("the device review switch hides it on that device", () => {
    state.lang = "en";
    vi.stubGlobal("localStorage", flagged("0"));
    try {
      state.rows = { programs: [ENROLMENT] };
      expect(renderToStaticMarkup(<ProgramPage />)).not.toContain('data-testid="program-pilot"');
    } finally {
      vi.unstubAllGlobals();
      state.rows = {};
    }
  });

  it("the same component and tone as the hard-moment guide's pilot label; EN says 'not yet had clinical review', HE the same in Hebrew, singular and plural", () => {
    const guide = renderToStaticMarkup(<PilotNote {...hardMomentPilotText("en")} />);
    const shape = (html: string) => html.replace(/>[^<]*</g, "><");
    for (const count of ["one", "many"] as const) expect(shape(renderToStaticMarkup(<PilotNote {...programPilotText("en", count)} />))).toBe(shape(guide));
    expect(guide).toContain('role="note"');
    expect(programPilotText("en").explanation).toMatch(/This pilot program has not yet had clinical review/);
    expect(programPilotText("en", "many").explanation).toMatch(/These pilot programs have not yet had clinical review/);
    expect(programPilotText("he").explanation).toMatch(/תוכנית הפיילוט הזאת עדיין לא עברה בדיקה קלינית/);
    expect(programPilotText("he", "many").explanation).toMatch(/תוכניות הפיילוט האלה עדיין לא עברו בדיקה קלינית/);
    expect(programPilotText("he", "many").status).toBe("תוכניות בפיילוט");
  });
});
