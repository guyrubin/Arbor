import { describe, expect, it } from "vitest";
import { askAdult, createDate, markDone, takeIt, type FamilyPlanAdult } from "./model";
import { datesInWindow, lanes, openRequests, planCounts, planWindow, reminders, standing } from "./week";
import { matchDraft, nameOverlap } from "./match";
import { familyPlanToIcs } from "./ics";

const NOW = new Date(2026, 10, 16, 8, 0); // Mon 16 Nov 2026, 08:00 local
const ISO = NOW.toISOString();
const owner: FamilyPlanAdult = { uid: "owner-1", role: "owner", email: "parent.one@example.test" };
const co: FamilyPlanAdult = { uid: "co-1", role: "co_parent", email: "parent.two@example.test", grantId: "g1" };
const mk = (id: string, date: string, time?: string, title = `Date ${id}`) => createDate({ id, kind: "event", title, date, time, origin: "manual" }, owner.uid, ISO);

describe("this week's family plan", () => {
  const form = takeIt(mk("form", "2026-11-18", undefined, "Return the visit form"), owner, ISO);
  const visit = askAdult(mk("visit", "2026-11-19", "10:00", "Group visit"), owner.uid, co, "", ISO);
  const later = takeIt(mk("speech", "2026-11-25", "10:00", "Speech therapist"), owner, ISO);
  const outside = mk("far", "2026-12-20");
  const all = [later, outside, visit, form];

  it("the window is seven ribbon days and fourteen days ahead", () => {
    const w = planWindow(NOW);
    expect(w.days).toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(w.until).toBe("2026-11-29");
    expect(datesInWindow(all, w).map((d) => d.id)).toEqual(["form", "visit", "speech"]);
  });

  it("counts dates; an unanswered request is nobody yet", () => {
    const inWin = datesInWindow(all, planWindow(NOW));
    expect(planCounts(inWin)).toEqual({ dates: 3, withAdult: 2, nobodyYet: 1 });
  });

  it("lanes: one per adult, then nobody yet; an asked date is open in the asked lane and in nobody yet", () => {
    const ls = lanes(datesInWindow(all, planWindow(NOW)), [owner, co]);
    expect(ls.map((l) => l.key)).toEqual(["owner-1", "co-1", "nobody"]);
    expect(ls[0].dates.map((d) => d.item.id)).toEqual(["form", "speech"]);
    expect(ls[1].dates).toEqual([{ item: visit, state: "asked" }]);
    expect(ls[2].dates).toEqual([{ item: visit, state: "none" }]);
  });

  it("in-app reminders: the evening before at 19:00, queued until then; done dates have none", () => {
    const rs = reminders([form, visit, markDone(later, owner.uid, ISO)], NOW);
    expect(rs.map((r) => r.dateId)).toEqual(["form", "visit"]);
    expect(new Date(rs[0].atMs)).toEqual(new Date(2026, 10, 17, 19, 0));
    expect(rs[0].status).toBe("queued");
    expect(rs[0].forUid).toBe(owner.uid);
    expect(rs[1].forUid).toBeNull();
  });

  it("open requests and where each thing stands", () => {
    expect(openRequests(all).map((d) => d.id)).toEqual(["visit"]);
    const s = standing([form, visit, markDone(later, owner.uid, ISO)]);
    expect(s.asked.map((d) => d.id)).toEqual(["visit"]);
    expect(s.accepted.map((d) => d.id)).toEqual(["form"]);
    expect(s.done.map((d) => d.id)).toEqual(["speech"]);
  });
});

describe("the duplicate check", () => {
  const visit = mk("visit", "2026-11-19", "10:00", "Group visit to the science garden");
  it("the same thing at the same time is a duplicate", () => {
    expect(matchDraft({ title: "Science garden group visit", date: "2026-11-19", time: "10:00" }, [visit]).kind).toBe("duplicate");
  });
  it("the same thing at another time is a change", () => {
    const m = matchDraft({ title: "Group visit, science garden", date: "2026-11-19", time: "11:30" }, [visit]);
    expect(m.kind).toBe("change");
  });
  it("another thing is new", () => {
    expect(matchDraft({ title: "Return the visit form", date: "2026-11-18" }, [visit]).kind).toBe("new");
    expect(nameOverlap("", "x")).toBe(0);
  });
  it("Hebrew names match on shared words", () => {
    const he = mk("he", "2026-11-19", "10:00", "סיור קבוצתי בגן המדע");
    expect(matchDraft({ title: "סיור קבוצתי בגן המדע", date: "2026-11-19", time: "11:30" }, [he]).kind).toBe("change");
  });
});

describe("add to my calendar", () => {
  it("writes the date's own name and time, never more", () => {
    const file = familyPlanToIcs([mk("visit", "2026-11-19", "10:00", "Group visit"), mk("form", "2026-11-18", undefined, "Form due")], NOW.getTime());
    expect(file?.filename).toBe("arbor-family-plan.ics");
    expect(file?.content).toContain("SUMMARY:Group visit");
    expect(file?.content).toContain("DTSTART;VALUE=DATE:20261118");
    expect(file?.content).toContain("DTEND;VALUE=DATE:20261119");
    expect(file?.content).not.toMatch(/DESCRIPTION|ATTENDEE/);
    expect(familyPlanToIcs([], NOW.getTime())).toBeNull();
  });
});
