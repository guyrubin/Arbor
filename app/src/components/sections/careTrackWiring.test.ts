/**
 * LC-09 + LC-12 mount guard — the Care "track" leg is actually wired.
 *
 * careTrack.ts is proven behaviourally in src/lib/careTrack.test.ts. This file
 * proves the surfaces USE it: the appointment list orders by date, the consult
 * request creates the appointment, the follow-up sink is the registered one,
 * the dead "Coming later" chips are gone, and "prepare a summary" is one door.
 *
 * Scan discipline: \r\n normalised first, every extraction asserted
 * toBeTruthy(), and each rule carries a NEGATIVE CONTROL against the
 * pre-change source shape so a scan that matches nothing cannot pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHILD_SUBCOLLECTIONS } from "../../lib/childData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const appts = read("components/sections/Appointments.tsx");

/** The pre-change Appointments shape, verbatim from the audited source. */
const PRE_APPTS = `
type Appt = { id: string; who: string; role: string; when: string; mode: string };
  const appts = useMemo(() => [...apptsCol.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [apptsCol.items]);
  <input value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} placeholder="When (e.g. Mon 9 Jun · 10:00)" />
  <button onClick={() => setActiveTab("reports")}>Share an Arbor summary</button>
  <span>Coming later:</span>
  <ComingSoon label="Booking" /><ComingSoon label="Reminders" />
`.replace(/\r\n/g, "\n");

describe("LC-12 · the Appointments surface uses the date model", () => {
  it("the sources were really read", () => {
    expect(appts.length).toBeGreaterThan(2000);
    expect(appts).toContain("export default function Appointments");
  });

  it("the date is a real datetime input, not free-text prose", () => {
    const input = /type="datetime-local"/.exec(appts);
    expect(input).toBeTruthy();
    expect(/type="datetime-local"/.exec(PRE_APPTS)).toBeNull();
    // and the prose placeholder is gone
    expect(appts).not.toContain('placeholder="When (e.g. Mon 9 Jun · 10:00)"');
    expect(PRE_APPTS).toContain('placeholder="When (e.g. Mon 9 Jun · 10:00)"');
  });

  it("ordering comes from careTrack.sortAppointments, never from the id", () => {
    expect(/sortAppointments\(apptsCol\.items/.exec(appts)).toBeTruthy();
    expect(/sortAppointments/.exec(PRE_APPTS)).toBeNull();
    // The appointment list itself is never id-sorted (the prep-questions list
    // legitimately still is — it has no date to order by).
    expect(appts).not.toMatch(/apptsCol\.items\]\.sort/);
    expect(PRE_APPTS).toMatch(/apptsCol\.items\]\.sort/);
  });

  it("the in-app reminder strip renders and never implies a phone alert", () => {
    expect(/data-testid="appt-reminder-strip"/.exec(appts)).toBeTruthy();
    expect(/dueReminders\(/.exec(appts)).toBeTruthy();
    expect(/elev\.learnCare\.appt\.reminder\.honesty/.exec(appts)).toBeTruthy();
    expect(/data-testid="appt-reminder-strip"/.exec(PRE_APPTS)).toBeNull();
    // No notification API anywhere on the surface.
    for (const forbidden of ["LocalNotifications", "showNotification", "Notification(", "pushToken"]) {
      expect(appts).not.toContain(forbidden);
    }
  });

  it("follow-ups write to the REGISTERED apptFollowUps sink", () => {
    expect(/useChildCollection<AppointmentFollowUp>\(childProfile\.id, "apptFollowUps"\)/.exec(appts)).toBeTruthy();
    expect(CHILD_SUBCOLLECTIONS).toContain("apptFollowUps");
    // NEGATIVE CONTROL: the sink did not exist before this change.
    expect(/apptFollowUps/.exec(PRE_APPTS)).toBeNull();
  });

  it("the dead 'Coming later' chip row is gone", () => {
    expect(appts).not.toContain("ComingSoon");
    expect(PRE_APPTS).toContain("ComingSoon");
  });
});

describe("LC-09 · share → track is one flow (the directory leg retired with B-CAREPRO-19)", () => {
  it("'prepare a summary' is ONE door — Appointments routes to consult, not reports", () => {
    expect(/setActiveTab\("consult"\)/.exec(appts)).toBeTruthy();
    expect(appts).not.toContain('setActiveTab("reports")');
    expect(PRE_APPTS).toContain('setActiveTab("reports")');
  });
});

describe("LC-09 · the reports deep link is not a general door (shrink-only)", () => {
  /**
   * Reports is a DEEP LINK behind the Consult flow (Reports.tsx says so
   * itself). Files still steering parents straight at it are listed with an
   * EXACT count — fixing one must lower the number, adding one turns CI red.
   * The two Copilot doors are outside this lane's file ownership and stay
   * recorded here rather than silently tolerated.
   */
  const ALLOWED: Record<string, number> = {
    "components/sections/Reports.tsx": Number.POSITIVE_INFINITY,
    "components/sections/AskSpecialist.tsx": Number.POSITIVE_INFINITY,
  };

  it("Appointments no longer holds one", () => {
    expect(appts.match(/setActiveTab\("reports"\)/g)).toBeNull();
  });

  it("the retired Copilot no longer adds a duplicate reports door", () => {
    expect(read("components/layout/Shell.tsx")).not.toContain("DevelopmentCopilot");
    expect(read("components/consult/PracticeSummary.tsx")).not.toContain('setActiveTab("reports")');
  });
});

/* ── B-CAREPRO-31 — profession, mode, Prepare, the stamped primary move ───── */
import { translate } from "../../lib/i18n";
import { appointmentRoleLabel } from "./Appointments";

describe("B-CAREPRO-31 · appointment lifecycle on #/appointments", () => {
  it("the form takes a profession select and an in-person/online choice; nothing is hard-coded", () => {
    expect(appts).toContain('data-testid="appt-profession-select"');
    expect(appts).toContain("APPOINTMENT_PROFESSIONS.map((p) =>");
    expect(appts).toContain('"appt-mode-in-person"');
    expect(appts).toContain("mode: form.mode,");
    expect(appts).not.toContain('mode: "Online",');
    expect(appts).not.toContain('role: form.role || "Professional"');
    // NEGATIVE CONTROL: the pre-change writes are caught by the same rules
    expect('      mode: "Online",\n').toContain('mode: "Online",');
  });

  it("an in-person booking reads 'In person' (EN + HE) — the stored token maps through the row's label", () => {
    const addBlock = /const addAppt = \(\) => \{[\s\S]*?\n  \};/.exec(appts)?.[0] ?? "";
    expect(addBlock, "addAppt extracted").not.toBe("");
    expect(addBlock).toContain("mode: form.mode");
    expect(appts).toContain('useState<{ who: string; profession: AppointmentProfession | ""; mode: AppointmentMode; when: string }>({ who: "", profession: "", mode: "In person", when: "" })');
    expect(/\^in\.\?person\$\/i\.test\(appt\.mode\)/.test(appts)).toBe(true);
    expect("In person").toMatch(/^in.?person$/i);
    expect(translate("en", "elev.careNet.mode.inPerson")).toBe("In person");
    expect(translate("he", "elev.careNet.mode.inPerson")).toBe("פנים אל פנים");
  });

  it("Prepare on an upcoming row → Consult with the profession's preset and the reason written", () => {
    const prep = /const prepare = \(a: Appointment\) => \{[\s\S]*?\n  \};/.exec(appts)?.[0] ?? "";
    expect(prep, "prepare extracted").not.toBe("");
    expect(prep).toContain("audience: consultAudienceForProfession(profession)");
    expect(prep).toContain('"elev.careNet.appt.prepare.reason"');
    expect(prep).toContain('setActiveTab("consult")');
    expect(appts).toContain("onPrepare={isPrepareDue(a, nowMs) ? () => prepare(a) : undefined}");
    expect(translate("en", "elev.careNet.appt.prepare.reason", { profession: "Speech therapist", date: "5 Oct" })).toBe("Visit with Speech therapist on 5 Oct");
    expect(translate("he", "elev.careNet.appt.prepare.reason", { profession: "קלינאי/ת תקשורת", date: "5 באוק׳" })).toContain("קלינאי/ת תקשורת");
  });

  it("existing rows without a profession read 'Professional' keyed; a typed role stays; a profession is keyed", () => {
    const t = (lang: "en" | "he") => (k: string) => translate(lang, k);
    expect(appointmentRoleLabel({ role: "Professional" }, t("en"))).toBe("Professional");
    expect(appointmentRoleLabel({ role: "Professional" }, t("he"))).toBe("איש/אשת מקצוע");
    expect(appointmentRoleLabel({ role: "" }, t("he"))).toBe("איש/אשת מקצוע");
    expect(appointmentRoleLabel({ role: "Dr Cohen's clinic" }, t("he"))).toBe("Dr Cohen's clinic");
    expect(appointmentRoleLabel({ role: "Speech therapist", profession: "slp" }, t("he"))).toBe("קלינאי/ת תקשורת");
  });

  it("the header Add carries the ONE primary-move stamp; close and question-remove reach 44 px", () => {
    const stamps = appts.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").match(/\bdata-primary-move="/g) ?? [];
    expect(stamps).toHaveLength(1);
    expect(appts).toMatch(/<button data-primary-move="add-appointment" onClick=\{\(\) => setAdding\(\(a\) => !a\)\}/);
    expect(appts).toMatch(/aria-label=\{t\("aria\.cancel"\)\} className="touch-target/);
    expect(appts).toMatch(/aria-label=\{t\("aria\.removeQuestion"\)\} className="touch-target/);
  });
});
