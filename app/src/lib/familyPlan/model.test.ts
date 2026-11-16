import { describe, expect, it } from "vitest";
import {
  addPrep, answerRequest, applyChange, askAdult, cancelDate, createDate, editDate, isDay, markDone, stateOf, takeIt, togglePrep,
  type FamilyPlanAdult,
} from "./model";

const T0 = "2026-11-16T08:00:00.000Z";
const T1 = "2026-11-16T09:00:00.000Z";
const owner: FamilyPlanAdult = { uid: "owner-1", role: "owner", email: "parent.one@example.test" };
const co: FamilyPlanAdult = { uid: "co-1", role: "co_parent", email: "parent.two@example.test", grantId: "g1" };

const visit = () => createDate({ id: "d1", kind: "join", title: "  Group visit  ", date: "2026-11-19", time: "10:00", origin: "message", sourceLine: "We ask one parent to join", messageId: "m1" }, owner.uid, T0);

describe("family plan model", () => {
  it("creates a date nobody has yet, with one history line", () => {
    const d = visit();
    expect(d).toMatchObject({ title: "Group visit", version: 1, status: "open", holder: null, request: null, origin: "message" });
    expect(stateOf(d)).toBe("none");
    expect(d.history).toEqual([{ at: T0, kind: "added", by: owner.uid, version: 1 }]);
  });

  it("refuses an empty name, a non-day and a bad time", () => {
    expect(() => createDate({ id: "x", kind: "event", title: " ", date: "2026-11-19", origin: "manual" }, "u", T0)).toThrow("invalid_title");
    expect(() => createDate({ id: "x", kind: "event", title: "A", date: "2026-02-31", origin: "manual" }, "u", T0)).toThrow("invalid_date");
    expect(() => createDate({ id: "x", kind: "event", title: "A", date: "2026-11-19", time: "25:00", origin: "manual" }, "u", T0)).toThrow("invalid_time");
    expect(isDay("2028-02-29")).toBe(true);
  });

  it("sent is not accepted: an asked date is asked, not covered", () => {
    const asked = askAdult(visit(), owner.uid, co, "Can you take it?", T1);
    expect(stateOf(asked)).toBe("asked");
    expect(asked.holder).toBeNull();
    expect(asked.request).toMatchObject({ toUid: co.uid, status: "asked", forVersion: 1, note: "Can you take it?" });
  });

  it("the asked adult answers yes and has it; a retried yes changes nothing", () => {
    const asked = askAdult(visit(), owner.uid, co, "", T1);
    const yes = answerRequest(asked, co, "yes", 1, T1);
    expect(yes.ok && yes.changed).toBe(true);
    if (!yes.ok) return;
    expect(stateOf(yes.item)).toBe("has");
    expect(yes.item.holder?.uid).toBe(co.uid);
    const again = answerRequest(yes.item, co, "yes", 1, T1);
    expect(again.ok && !again.changed).toBe(true);
  });

  it("only the asked adult can answer, and only for the version asked", () => {
    const asked = askAdult(visit(), owner.uid, co, "", T1);
    expect(answerRequest(asked, owner, "yes", 1, T1)).toEqual({ ok: false, error: "not_for_you" });
    expect(answerRequest(asked, co, "yes", 2, T1)).toEqual({ ok: false, error: "date_changed" });
    expect(answerRequest(visit(), co, "yes", 1, T1)).toEqual({ ok: false, error: "not_asked" });
  });

  it("a no leaves nobody and keeps the line in history", () => {
    const asked = askAdult(visit(), owner.uid, co, "", T1);
    const no = answerRequest(asked, co, "no", 1, T1);
    expect(no.ok).toBe(true);
    if (!no.ok) return;
    expect(stateOf(no.item)).toBe("none");
    expect(no.item.history.at(-1)?.kind).toBe("declined");
  });

  it("applying a change keeps the old version, stops the old reminder and asks the adult again", () => {
    const asked = askAdult(visit(), owner.uid, co, "", T1);
    const yes = answerRequest(asked, co, "yes", 1, T1);
    if (!yes.ok) throw new Error("expected yes");
    const moved = applyChange(yes.item, { date: "2026-11-19", time: "11:30", sourceLine: "We now start at 11:30" }, owner.uid, T1, "Can you still take it at 11:30?");
    expect(moved.version).toBe(2);
    expect(moved.time).toBe("11:30");
    expect(moved.previous).toEqual([{ version: 1, date: "2026-11-19", time: "10:00", sourceLine: "We ask one parent to join", replacedAt: T1 }]);
    expect(moved.holder).toBeNull();
    expect(moved.request).toMatchObject({ toUid: co.uid, status: "asked", forVersion: 2 });
    const kinds = moved.history.map((h) => h.kind);
    expect(kinds).toContain("changed");
    expect(kinds).toContain("reminder_stopped");
    // The yes to version 1 does not count for version 2.
    expect(answerRequest(moved, co, "yes", 1, T1)).toEqual({ ok: false, error: "date_changed" });
  });

  it("the applier keeps a date that was theirs", () => {
    const mine = takeIt(visit(), owner, T1);
    const moved = applyChange(mine, { date: "2026-11-20" }, owner.uid, T1, "");
    expect(moved.holder?.uid).toBe(owner.uid);
    expect(moved.request).toBeNull();
    expect(moved.time).toBeUndefined();
    expect("time" in moved).toBe(false);
  });

  it("taking it yourself closes an open request", () => {
    const took = takeIt(askAdult(visit(), owner.uid, co, "", T0), owner, T1);
    expect(took.holder?.uid).toBe(owner.uid);
    expect(took.request?.status).toBe("closed");
  });

  it("prep, done and cancel", () => {
    let d = addPrep(visit(), "Bring a hat", "p1", owner.uid, T1);
    d = togglePrep(d, "p1", T1);
    expect(d.prep).toEqual([{ id: "p1", text: "Bring a hat", done: true }]);
    expect(markDone(d, owner.uid, T1).status).toBe("done");
    const cancelled = cancelDate(askAdult(d, owner.uid, co, "", T1), owner.uid, T1);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.request?.status).toBe("closed");
  });

  it("a hand edit of the time is a change; a rename is an edit", () => {
    const renamed = editDate(visit(), { title: "Science garden visit" }, owner.uid, T1, "");
    expect(renamed.version).toBe(1);
    expect(renamed.history.at(-1)?.kind).toBe("edited");
    const moved = editDate(visit(), { time: "12:00" }, owner.uid, T1, "");
    expect(moved.version).toBe(2);
  });
});
