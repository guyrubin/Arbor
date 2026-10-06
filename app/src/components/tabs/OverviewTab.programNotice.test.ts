import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDemoFamily } from "../../demo/demoFamily";
import { toObservations } from "../../lib/observations";
import { shelfCoverage, selectNextMilestonesByShelf } from "../../lib/milestones/selectByShelf";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { enrolInProgram, activeProgramWeek } from "../../lib/programs/enrolment";
import { selectNoticeWithProgram, type NoticeProgram } from "../../lib/programs/notice";

/* B-PROG-03 (seam): Today's Notice reads the program wrapper. With an ACTIVE
   enrolment the program's shelf is not offered by the thinnest-shelf rule and
   the week's watchFor rows are served; without one, the previous output. */
const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date("2026-10-06T07:00:00Z");
const DAY = 86_400_000;

function setup() {
  const fam = buildDemoFamily({ now: NOW.getTime(), lang: "en" });
  const c = fam.collections;
  const obs = toObservations({ behaviorLogs: c.behaviorLogs, milestones: c.milestones, langObs: c.langObs, actionLoops: c.actionLoops, practiceEvents: c.practiceEvents }, { id: fam.child.id, birthDate: fam.child.birthDate });
  return { milestones: c.milestones, months: comparisonMonthsOf(fam.child)!, coverage: shelfCoverage(obs, NOW) };
}

/** The OverviewTab mapping, one line: the active week → the wrapper's program. */
function noticeProgramOf(rows: unknown[]): NoticeProgram | null {
  const active = activeProgramWeek(rows, NOW);
  return active ? { shelf: active.program.shelf, watchFor: active.content.watchFor } : null;
}

describe("B-PROG-03 (seam) — Today's Notice reads the program wrapper", () => {
  it("enrolled in Talk Together (week 3): the Words shelf is not offered by the shelf rule; the week's watchFor is served first", () => {
    const { milestones, months, coverage } = setup();
    const r = enrolInProgram([], "talk-together", new Date(NOW.getTime() - 14 * DAY));
    expect("enrolment" in r).toBe(true);
    const rows = "enrolment" in r ? [r.enrolment] : [];
    const program = noticeProgramOf(rows)!;
    expect(program.shelf).toBe("words");
    expect(activeProgramWeek(rows, NOW)!.week).toBe(3);
    const picks = selectNoticeWithProgram(milestones, months, { perShelf: 1, total: 3, coverage, now: NOW, excludeShelves: ["food"] }, program);
    const served = picks.filter((p) => p.fromProgram).map((p) => p.milestone.id);
    expect(served.length).toBeGreaterThan(0);
    for (const id of served) expect(program.watchFor).toContain(id);
    // every non-program pick avoids the program's shelf (and the practice's)
    for (const p of picks.filter((x) => !x.fromProgram)) expect(["words", "food"]).not.toContain(p.shelf);
    expect(picks.length).toBeLessThanOrEqual(3);
  });

  it("NEGATIVE CONTROL — no enrolment: exactly the previous selection", () => {
    const { milestones, months, coverage } = setup();
    const opts = { perShelf: 1, total: 3, coverage, now: NOW, excludeShelves: ["food" as const] };
    expect(noticeProgramOf([])).toBeNull();
    expect(selectNoticeWithProgram(milestones, months, opts, noticeProgramOf([]))).toEqual(selectNextMilestonesByShelf(milestones, months, opts));
  });

  it("OverviewTab wires it: the programs collection → activeProgramWeek → selectNoticeWithProgram", () => {
    const src = readFileSync(path.join(here, "OverviewTab.tsx"), "utf8");
    expect(src).toContain('useChildCollection<unknown>(childProfile.id, "programs")');
    expect(src).toContain("return active ? { shelf: active.program.shelf, watchFor: active.content.watchFor } : null;");
    expect(src).toContain("selectNoticeWithProgram(milestones, comparisonMonths, {");
    expect(src).not.toContain("selectNextMilestonesByShelf(");
  });
});
