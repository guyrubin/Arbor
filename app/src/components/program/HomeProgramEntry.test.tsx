import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-09 (assignment in) — "They gave us a home program" in the after-visit
   flow (Care › Consult). Two exercises → one enrolment, two practices on the
   shelves the parent chose, two goals proposed by the profession — and nothing
   is saved before the parent confirms, each goal accepted in their words. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import HomeProgramEntry, {
  HomeProgramDays,
  allGoalsDecided,
  checkAcceptance,
  entryReducer,
  entryWrites,
  homeProfessionForAppointment,
  initialEntryState,
  nextVisitDayFor,
  type HomeEntryAction,
  type HomeEntryState,
} from "./HomeProgramEntry";
import { toggleExerciseDay, type HomeProgramEnrolment } from "../../content/programs/homeProgram";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { Appointment } from "../../lib/careTrack";

const NOW = new Date(2026, 9, 8, 10, 0, 0);
const SCALE = { "-2": "Not at all", "-1": "Once or twice", "0": "Some mornings", "1": "Most mornings", "2": "Every morning" };
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const run = (s: HomeEntryState, actions: HomeEntryAction[]) => actions.reduce(entryReducer, s);
const ctx = { rows: [] as unknown[], existingGoals: [], nextVisit: "2026-11-05", now: NOW };

/** The parent's entry: two exercises on two shelves, two goals the OT suggested. */
const entered = (): HomeEntryState =>
  run(initialEntryState("ot"), [
    { type: "exerciseText", i: 0, text: "Thread five big beads after breakfast" },
    { type: "exerciseShelf", i: 0, shelf: "hands" },
    { type: "addExercise" },
    { type: "exerciseText", i: 1, text: "Crawl through the cushion tunnel twice" },
    { type: "exerciseShelf", i: 1, shelf: "moving" },
    { type: "addGoal" },
    { type: "goalText", i: 0, text: "Dresses the top half alone" },
    { type: "addGoal" },
    { type: "goalText", i: 1, text: "Holds the spoon without help" },
    { type: "review" },
  ]);

const render = (lang: "en" | "he", s: HomeEntryState, onConfirm = vi.fn()) => {
  state.lang = lang;
  return renderToStaticMarkup(
    <HomeProgramEntry profession="ot" nextVisit="2026-11-05" rows={[]} existingGoals={[]} onConfirm={onConfirm} onCancel={() => undefined} now={() => NOW} initialState={s} />,
  );
};

describe("B-PROG-09 assignment in · two exercises, two proposed goals", () => {
  it("the check step lists both exercises on the chosen shelves and both goals, undecided, with the save held", () => {
    const s = entered();
    expect(s.step).toBe("review");
    const onConfirm = vi.fn();
    const html = render("en", s, onConfirm);
    expect(html).toContain('data-step="review"');
    expect([...html.matchAll(/data-testid="home-review-exercise" data-shelf="(\w+)"/g)].map((m) => m[1])).toEqual(["hands", "moving"]);
    expect((html.match(/data-testid="home-review-goal" data-decided="no"/g) || []).length).toBe(2);
    expect(text(html)).toContain("Proposed by the occupational therapist");
    expect(html).toMatch(/data-testid="home-program-save" disabled=""/);
    // NOTHING saved before confirm: rendering every step never calls the writer
    render("en", initialEntryState("ot"), onConfirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(entryWrites(s, ctx)).toEqual({ ok: false, reason: "undecided" });
  });

  it("confirm creates ONE enrolment with two practices on the chosen shelves and two goals proposed by the OT, in the parent's words", () => {
    let s = entered();
    for (const [i, words] of ["Puts on the top half alone", "Holds the spoon by himself"].entries()) {
      expect(checkAcceptance(s, i, words, SCALE, ctx)).toBe("ok");
      s = entryReducer(s, { type: "accept", i, text: words, scale: SCALE });
    }
    expect(allGoalsDecided(s)).toBe(true);
    expect(render("en", s)).not.toMatch(/data-testid="home-program-save" disabled/);
    const w = entryWrites(s, ctx);
    expect("enrolment" in w).toBe(true);
    if (!("enrolment" in w)) return;
    expect(w.enrolment.programId).toBe("home-ot");
    expect(w.enrolment.home.exercises.map((e) => [e.text, e.shelf])).toEqual([
      ["Thread five big beads after breakfast", "hands"],
      ["Crawl through the cushion tunnel twice", "moving"],
    ]);
    expect(w.enrolment.home.weeks).toBe(4);
    expect(w.goals).toHaveLength(2);
    expect(w.goals.map((g) => [g.text, g.proposedBy, g.programId])).toEqual([
      ["Puts on the top half alone", "ot", "home-ot"],
      ["Holds the spoon by himself", "ot", "home-ot"],
    ]);
    expect(new Set(w.goals.map((g) => g.id)).size).toBe(2);
  });

  it("a goal left out is not written; an acceptance without the five words is refused", () => {
    let s = entered();
    expect(checkAcceptance(s, 0, "Dresses alone", { ...SCALE, "2": " " }, ctx)).toBe("incomplete_scale");
    s = run(s, [{ type: "accept", i: 0, text: "Dresses alone", scale: SCALE }, { type: "leaveOut", i: 1 }]);
    const w = entryWrites(s, ctx);
    expect("goals" in w && w.goals.map((g) => g.text)).toEqual(["Dresses alone"]);
    expect(text(render("en", s))).toContain("left out");
  });

  it("refuses to go on without an exercise", () => {
    const s = run(initialEntryState("slp"), [{ type: "review" }]);
    expect(s.step).toBe("enter");
    expect(s.error).toBe("no_exercises");
    expect(render("en", s)).toContain('data-testid="home-program-error"');
  });

  it("HE: the check step reads in Hebrew with the provenance line, no number on the goal rows", () => {
    const html = render("he", entered());
    const plain = text(html);
    expect(plain).toContain(translate("he", "elev.homeProgram.review.title"));
    expect(plain).toContain(translate("he", "elev.homeProgram.goal.proposedBy", { profession: translate("he", "elev.carehonesty.consult.audience.ot") }));
    expect(loopFirewallHits(plain)).toEqual([]);
  });

  it("EN enter step: the shelf chooser per exercise, the weeks until the next visit", () => {
    const html = render("en", initialEntryState("ot"));
    expect(html).toContain('data-testid="home-ex-shelf"');
    expect(html).toMatch(/<option value="hands" selected="">/);
    expect(text(html)).toMatch(/Until the next visit on .+: 4 weeks/);
    expect(loopFirewallHits(text(html))).toEqual([]);
  });
});

describe("B-PROG-09 · the family's practice days (counts, never a rate)", () => {
  it("each exercise shows the days it was done; Done today is pressed after marking", () => {
    let s = entered();
    s = run(s, [{ type: "leaveOut", i: 0 }, { type: "leaveOut", i: 1 }]);
    const w = entryWrites(s, ctx);
    if (!("enrolment" in w)) throw new Error("no enrolment");
    let e: HomeProgramEnrolment = toggleExerciseDay(w.enrolment, "ex-1", NOW);
    e = toggleExerciseDay(e, "ex-1", new Date(2026, 9, 9, 9));
    state.lang = "en";
    const html = renderToStaticMarkup(<HomeProgramDays enrolment={e} onSave={() => undefined} now={() => new Date(2026, 9, 9, 18)} />);
    const plain = text(html);
    expect(plain).toContain("Week 1 of 4");
    expect(plain).toContain("Done on 2 days");
    expect(plain).toContain("Not marked yet");
    expect(html).toMatch(/aria-pressed="true"/);
    expect(plain).not.toMatch(/%|rate|streak/i);
    expect(loopFirewallHits(plain)).toEqual([]);
  });
});

describe("B-PROG-09 · the visit seams", () => {
  it("the visit's profession and the next booked visit with the same professional", () => {
    expect(homeProfessionForAppointment("psychologist")).toBe("psychology");
    expect(homeProfessionForAppointment("ot")).toBe("ot");
    expect(homeProfessionForAppointment("teacher")).toBeNull();
    expect(homeProfessionForAppointment(undefined)).toBeNull();
    const past: Appointment = { id: "a0", who: "", role: "", profession: "ot", when: "", mode: "", whenIso: new Date(2026, 9, 5, 9).toISOString() };
    const next: Appointment = { id: "a1", who: "", role: "", profession: "ot", when: "", mode: "", whenIso: new Date(2026, 10, 5, 9).toISOString() };
    const other: Appointment = { id: "a2", who: "", role: "", profession: "slp", when: "", mode: "", whenIso: new Date(2026, 9, 20, 9).toISOString() };
    expect(nextVisitDayFor([past, next, other], past, NOW.getTime())).toBe("2026-11-05");
    expect(nextVisitDayFor([past, other], past, NOW.getTime())).toBeNull();
  });

  it("ConsultTab writes the home program ONLY in the confirm handler (and the day mark), never on its own", () => {
    const src = readFileSync(path.resolve(__dirname, "../tabs/ConsultTab.tsx"), "utf8");
    expect(src).toContain('data-testid="consult-home-program-choice"');
    expect(src).toContain("onConfirm={saveHomeProgram}");
    const body = src.slice(src.indexOf("const saveHomeProgram"), src.indexOf("const activeHome"));
    const outside = src.replace(body, "");
    expect((outside.match(/familyGoalsCol\.upsert/g) || []).length).toBe(0);
    expect((outside.match(/programsCol\.upsert/g) || []).length).toBe(1); // the day mark (toggleExerciseDay)
    expect(outside).toMatch(/programsCol\.upsert\(toggleExerciseDay\(/);
  });
});
