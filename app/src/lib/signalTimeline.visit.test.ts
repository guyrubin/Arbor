import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, signalDetail, signalTitle, weekMomentCount, SIGNAL_PROVENANCE } from "./signalTimeline";
import { visitRecords, makeFollowUp, type Appointment, type AppointmentFollowUp } from "./careTrack";
import { translate } from "./i18n";
import { TIMELINE_SOURCE_IDS } from "./signalTimeline";
import { SURFACE_CONTRACTS } from "./surfaceContract";

/* B-CAREPRO-37 — saving an after-visit note puts ONE dated visit row on the
   record: the profession the visit was with, the parent's words verbatim,
   dated by the visit. The note never becomes Arbor's own sentence: no
   why-line builder reads it. Removing the booking removes the row. */

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const appt = (over: Partial<Appointment> = {}): Appointment => ({ id: "a1", who: "", role: "Speech therapist", profession: "slp", when: "", whenIso: "2026-10-20T09:00:00.000Z", mode: "In person", status: "done", ...over });

describe("B-CAREPRO-37 · visitRecords (lib/careTrack)", () => {
  it("one record per note: dated by the visit, naming its profession, the parent's words trimmed; newest first", () => {
    const notes = [makeFollowUp("a1", "  She said to wait a beat.  ", NOW)!, makeFollowUp("a2", "Keep reading at night.", NOW - 1000)!];
    const out = visitRecords([appt(), appt({ id: "a2", profession: "pediatrician", role: "Pediatrician", whenIso: "2026-09-01T09:00:00.000Z" })], notes);
    expect(out.map((v) => [v.apptId, v.at, v.profession, v.note])).toEqual([
      ["a1", "2026-10-20T09:00:00.000Z", "slp", "She said to wait a beat."],
      ["a2", "2026-09-01T09:00:00.000Z", "pediatrician", "Keep reading at night."],
    ]);
  });
  it("an undated booking is dated by the note; a removed booking takes its notes with it; a blank note is no record", () => {
    const n1 = makeFollowUp("a1", "Undated visit note", NOW)!;
    expect(visitRecords([appt({ whenIso: undefined })], [n1])[0].at).toBe(new Date(NOW).toISOString());
    expect(visitRecords([], [n1])).toEqual([]);
    expect(visitRecords([appt()], [{ id: "f", apptId: "a1", note: "   ", createdAt: new Date(NOW).toISOString() } as AppointmentFollowUp])).toEqual([]);
  });
  it("a legacy booking without a profession keeps its typed role for the label", () => {
    const v = visitRecords([appt({ profession: undefined, role: "Dr. Levi's clinic" })], [makeFollowUp("a1", "note", NOW)!])[0];
    expect(v.profession).toBeUndefined();
    expect(v.role).toBe("Dr. Levi's clinic");
  });
});

describe("B-CAREPRO-37 · the Journal's visit row (buildTimeline)", () => {
  const notes = [makeFollowUp("a1", "She suggested we wait a beat before naming the toy.", NOW)!];
  const rows = buildTimeline({ appointments: [appt()], apptFollowUps: notes });
  it("one kind 'visit' row, the parent's provenance, the words as its detail", () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "visit", at: "2026-10-20T09:00:00.000Z", detail: notes[0].note });
    expect(SIGNAL_PROVENANCE.visit).toBe("manual");
  });
  it("EN + HE: the title names the profession; the detail is the note verbatim", () => {
    const en = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
    const he = (k: string, v?: Record<string, string | number>) => translate("he", k, v);
    expect(signalTitle(rows[0], en)).toBe("Visit · Speech therapist");
    expect(signalTitle(rows[0], he)).toMatch(/^ביקור · .*תקשורת/);
    expect(signalDetail(rows[0], en)).toBe(notes[0].note);
    expect(signalDetail(rows[0], he)).toBe(notes[0].note);
  });
  it("a visit is not a moment: the week's moment count does not change", () => {
    expect(weekMomentCount(rows, Date.parse("2026-10-21T12:00:00.000Z"))).toBe(0);
  });
  it("the #/appointments contract's threadWrite is the after-visit notes, a real buildTimeline source (SC-4)", () => {
    expect(SURFACE_CONTRACTS.find((c) => c.route === "appointments")?.threadWrite).toBe("apptFollowUps");
    expect(TIMELINE_SOURCE_IDS).toContain("apptFollowUps");
  });
});

describe("B-CAREPRO-37 · no why-line quotes a visit note (NL-9)", () => {
  // Every builder that writes Arbor's own "why"/"picked because"/"what changed" sentence.
  const WHY_BUILDERS = [
    "components/loop/PracticeCard.tsx",
    "components/companion/NowPlanBody.tsx",
    "components/companion/nowRecommendationModel.ts",
    "components/companion/useNowLoop.ts",
    "components/overview/whatChangedEvents.ts",
    "components/overview/sinceVisitEvents.ts",
    "lib/companionOffer.ts",
    "lib/today/dayCard.ts",
    "ai/journalContext.ts",
  ];
  it("none of them reads the notes, the visit records or a visit row", () => {
    for (const rel of WHY_BUILDERS) {
      const src = readFileSync(path.join(here, "..", rel), "utf8");
      expect(src, rel).not.toMatch(/apptFollowUps|visitRecords|kind === "visit"|followUpsFor/);
    }
  });
});
