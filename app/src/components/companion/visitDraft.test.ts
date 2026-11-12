import { describe, expect, it, vi } from "vitest";

// The pure count only; the hook's collections are not read here.
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [] }) }));

import { visitDraftCount } from "./visitDraft";
import { VISIT_DRAFT_COPY } from "./nowV41Copy";
import type { Appointment } from "../../lib/careTrack";
import type { BehaviorLog } from "../../types";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const day = (d: number, h = 10) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
const moment = (id: string, iso: string) => ({ id, timestamp: iso, behaviorType: "Moment", trigger: "Synthetic words kept", contentSource: "parent" }) as unknown as BehaviorLog;
const appt = (id: string, iso: string, profession: Appointment["profession"]) => ({ id, whenIso: iso, when: iso, profession, title: "Visit", createdAt: iso }) as unknown as Appointment;

const base = {
  appointments: [] as Appointment[],
  followUps: [],
  lastSharedIso: () => null,
  logs: [] as BehaviorLog[],
  milestones: [],
  langObs: [],
  nowMs: NOW,
};

describe("v4.1 · the visit summary is drafted (Care's own since-anchor count)", () => {
  it("counts the moments kept since the last past visit with the same profession", () => {
    const upcoming = appt("next", day(14), "slp");
    const draft = visitDraftCount({
      ...base,
      visit: upcoming,
      appointments: [appt("past-slp", day(1), "slp"), appt("past-ped", day(8), "pediatrician"), upcoming],
      logs: [moment("a", day(1, 8)), moment("b", day(3)), moment("c", day(9)), moment("d", day(11))],
    });
    // Since the speech therapist on the 1st: three moments (the pediatrician visit is not this anchor).
    expect(draft).toEqual({ moments: 3, anchor: "visit" });
  });

  it("falls back to the last share with that audience, then to the whole record", () => {
    const upcoming = appt("next", day(14), "pediatrician");
    const logs = [moment("a", day(2)), moment("b", day(6)), moment("c", day(10))];
    expect(visitDraftCount({ ...base, visit: upcoming, logs, lastSharedIso: (a) => (a === "pediatrician" ? day(5) : null) }))
      .toEqual({ moments: 2, anchor: "share" });
    expect(visitDraftCount({ ...base, visit: upcoming, logs })).toEqual({ moments: 3, anchor: "start" });
  });

  it("is null with no profession, an empty record, or nothing kept since the anchor (Now keeps its plain line)", () => {
    expect(visitDraftCount({ ...base, visit: appt("next", day(14), undefined as never), logs: [moment("a", day(2))] })).toBeNull();
    expect(visitDraftCount({ ...base, visit: appt("next", day(14), "slp") })).toBeNull();
    expect(visitDraftCount({ ...base, visit: appt("next", day(14), "slp"), appointments: [appt("past", day(11), "slp")], logs: [moment("a", day(2))] })).toBeNull();
    expect(visitDraftCount({ ...base, visit: null, logs: [moment("a", day(2))] })).toBeNull();
  });

  it("says the design's words in English and Hebrew, singular and by anchor, and never a verdict", () => {
    expect(VISIT_DRAFT_COPY.en.head).toBe("A quiet two minutes: the visit summary is drafted.");
    expect(VISIT_DRAFT_COPY.en.sub(14, "visit")).toBe("Built from the 14 moments you kept since the last visit. Nothing is shared until you send it.");
    expect(VISIT_DRAFT_COPY.en.sub(1, "share")).toBe("Built from the one moment you kept since you last shared with them. Nothing is shared until you send it.");
    expect(VISIT_DRAFT_COPY.en.sub(3, "start")).toContain("since you started");
    expect(VISIT_DRAFT_COPY.en.cta).toBe("Look it over");
    expect(VISIT_DRAFT_COPY.en.glance("In 3 days")).toBe("In 3 days · summary drafted, two minutes to check");
    expect(VISIT_DRAFT_COPY.he.sub(14, "visit")).toBe("נבנתה מ-14 הרגעים ששמרתם מאז הביקור הקודם. שום דבר לא משותף עד שתשלחו.");
    expect(VISIT_DRAFT_COPY.he.sub(1, "visit")).toContain("נבנתה מהרגע ששמרתם");
    for (const lang of ["en", "he"] as const) {
      const lines = [VISIT_DRAFT_COPY[lang].head, VISIT_DRAFT_COPY[lang].sub(5, "visit"), VISIT_DRAFT_COPY[lang].glance("x")].join(" ");
      expect(lines).not.toMatch(/%|score|behind|delay|ahead|on track/i);
    }
  });
});
