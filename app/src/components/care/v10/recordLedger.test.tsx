/**
 * Design V77 (N-Records-D/M) — the record by kind. Synthetic data only.
 * Counts only: each row is the parent's own records of one kind, its latest
 * date and the place those records live; nothing grades the child.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RecordLedger, { LEDGER_MAX_MARKS, recordLedgerRows } from "./RecordLedger";
import { careCopy } from "./careV10Copy";
import { fmtDayV10 } from "../../../lib/formatDate";
import type { ActionPlan, BehaviorLog, MemoryReviewItem, Milestone } from "../../../types";
import type { Appointment } from "../../../lib/careTrack";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-16T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const log = (id: string, daysAgo: number, hard = false) => ({ id, timestamp: iso(NOW - daysAgo * DAY), behaviorType: "Moment", durationMinutes: 0, trigger: "", ...(hard ? { intensity: 3 } : {}) }) as BehaviorLog;
const ms = (id: string, domain: string, checked: boolean, daysAgo: number) => ({ id, domain, checked, observedAt: iso(NOW - daysAgo * DAY), title: id, description: "", ageGroup: "" }) as unknown as Milestone;
const plan = (done: number, total: number) => ({ id: "p", title: "", issue: "", phases: [{ name: "", description: "", steps: Array.from({ length: total }, (_, i) => ({ text: `s${i}`, completed: i < done })) }], scripts: [], successIndicators: [] }) as ActionPlan;
const note = (id: string, status: "approved" | "pending", daysAgo: number) => ({ memoryId: id, childId: "c", status, fact: "", source: "", retention: "", createdAt: iso(NOW - daysAgo * DAY), latestEventId: "" }) as MemoryReviewItem;
const visit = (id: string, daysFromNow: number) => ({ id, whenIso: iso(NOW + daysFromNow * DAY), status: "confirmed", profession: "slp" }) as unknown as Appointment;

function rows(locale: "en" | "he" = "en", over: Partial<Parameters<typeof recordLedgerRows>[0]> = {}) {
  return recordLedgerRows({
    logs: [log("a", 20), log("b", 5, true), log("c", 1)],
    milestones: [ms("m1", "language", true, 30), ms("m2", "motor", true, 2), ms("m3", "motor", false, 1)],
    plans: [plan(3, 7)],
    remembered: [note("n1", "approved", 4)],
    waiting: [note("n2", "pending", 1), note("n3", "pending", 1)],
    appointments: [visit("v1", -16), visit("v2", 9)],
    nowMs: NOW,
    copy: careCopy(locale).records,
    ...over,
  });
}

describe("V77 · the record by kind", () => {
  it("one row per kind, in the board's order, each with its real count and the route its records live on", () => {
    const r = rows();
    expect(r.map((x) => [x.kind, x.count, x.route])).toEqual([
      ["moments", 3, "journal"],
      ["milestones", 2, "milestones"],
      ["plan", 3, "plans"],
      ["notebook", 1, "memory"],
      ["visits", 2, "appointments"],
    ]);
  });

  it("each kind's latest date: the newest moment, milestone seen and note; visits read the next one ahead", () => {
    const [moments, milestones, planRow, notebook, visits] = rows();
    expect(moments.latestIso).toBe(iso(NOW - DAY));
    expect(milestones.latestIso).toBe(iso(NOW - 2 * DAY)); // m3 is not seen: never the latest
    expect(planRow.latestIso).toBeNull();
    expect(notebook.latestIso).toBe(iso(NOW - 4 * DAY)); // a waiting note is not a remembered one
    expect(visits.latestIso).toBe(iso(NOW + 9 * DAY));
    expect(visits.latestIsNext).toBe(true);
    // NEGATIVE CONTROL: with nothing ahead, the last visit is the anchor, read as "latest".
    const [, , , , pastOnly] = rows("en", { appointments: [visit("v1", -16), visit("v0", -40)] });
    expect(pastOnly.latestIso).toBe(iso(NOW - 16 * DAY));
    expect(pastOnly.latestIsNext).toBe(false);
  });

  it("marks: hard moments are their own kind, the latest is ringed; plan steps done, here, open; notes waiting are pencilled", () => {
    const [moments, , planRow, notebook, visits] = rows();
    expect(moments.marks.map((m) => m.kind)).toEqual(["moment", "hard", "moment"]);
    expect(moments.marks.map((m) => !!m.isNew)).toEqual([false, false, true]);
    expect(planRow.marks.map((m) => m.state)).toEqual(["solid", "solid", "solid", "here", "open", "open", "open"]);
    expect(notebook.marks.map((m) => m.state)).toEqual(["solid", "ai", "ai"]);
    expect(visits.marks.map((m) => [m.state, m.day])).toEqual([["solid", new Date(NOW - 16 * DAY).getDate()], ["open", new Date(NOW + 9 * DAY).getDate()]]);
  });

  it(`never more than ${LEDGER_MAX_MARKS} marks; the figure always carries the whole count`, () => {
    const many = Array.from({ length: 40 }, (_, i) => log(`l${i}`, 40 - i));
    const [moments] = rows("en", { logs: many });
    expect(moments.count).toBe(40);
    expect(moments.marks.length).toBe(LEDGER_MAX_MARKS);
    expect(moments.marks[moments.marks.length - 1].isNew).toBe(true);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: clauses are counts only — no %, no "x of y", no verdict words`, () => {
      const c = careCopy(locale).records;
      const subs = rows(locale).map((x) => x.sub);
      expect(subs).toEqual([c.ledgerHard(1), c.ledgerBranches(2), c.ledgerStillOpen(4), c.ledgerNotebookSub(2), c.ledgerVisitsSub(1, 1)]);
      for (const s of subs) expect(s).not.toMatch(/%|\/\s*\d|\bof\b|מתוך|behind|delay|on track|עיכוב/i);
      if (locale === "he") for (const s of subs) expect(s).not.toMatch(/[A-Za-z]/);
    });

    it(`${locale}: rendered, each row is one 44 px way to its place, named in words; the marks are hidden from assistive tech`, () => {
      const c = careCopy(locale).records;
      for (const composition of ["desk", "phone"] as const) {
        const html = renderToStaticMarkup(<div className={`ds ds-${composition} care-records`}><RecordLedger composition={composition} rows={rows(locale)} copy={c} uiLang={locale} labelledBy="t" onOpen={() => {}} /></div>);
        const buttons = html.match(/<button[^>]*class="care-ledger-open"[^>]*>/g) ?? [];
        expect(buttons.length).toBe(5);
        expect(buttons[0]).toContain(`aria-label="${c.ledgerName.moments}: 3`);
        expect(html).toContain(c.ledgerLatest(fmtDayV10(iso(NOW - DAY), locale)));
        expect(html).toContain(c.ledgerNext(fmtDayV10(iso(NOW + 9 * DAY), locale)));
        // every mark sits inside an aria-hidden group
        const firstMark = html.indexOf('class="tok');
        expect(html.lastIndexOf('aria-hidden="true"', firstMark)).toBeGreaterThan(html.lastIndexOf("<button", firstMark));
      }
    });
  }
});
