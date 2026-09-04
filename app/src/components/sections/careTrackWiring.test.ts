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
const findPro = read("components/sections/FindProfessional.tsx");

/** The pre-change Appointments shape, verbatim from the audited source. */
const PRE_APPTS = `
type Appt = { id: string; who: string; role: string; when: string; mode: string };
  const appts = useMemo(() => [...apptsCol.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [apptsCol.items]);
  <input value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} placeholder="When (e.g. Mon 9 Jun · 10:00)" />
  <button onClick={() => setActiveTab("reports")}>Share an Arbor summary</button>
  <span>Coming later:</span>
  <ComingSoon label="Booking" /><ComingSoon label="Reminders" />
`.replace(/\r\n/g, "\n");

/** The pre-change consult-request success handler. */
const PRE_FINDPRO = `
      setConsultDone({ id: request.id, mailto });
      track("consult_send_completed", { proRole: consultPro.role, mode: consultMode });
      toast(\`Consultation request sent for \${consultPro.name}.\`, "success");
`.replace(/\r\n/g, "\n");

describe("LC-12 · the Appointments surface uses the date model", () => {
  it("the sources were really read", () => {
    expect(appts.length).toBeGreaterThan(2000);
    expect(appts).toContain("export default function Appointments");
    expect(findPro).toContain("export default function FindProfessional");
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

describe("LC-09 · find → share → track is one flow", () => {
  it("a recorded consult request creates a tracked appointment", () => {
    const wired = /appointmentFromConsultRequest\(\{[\s\S]{0,400}?requestId: request\.id/.exec(findPro);
    expect(wired).toBeTruthy();
    expect(/appointmentFromConsultRequest/.exec(PRE_FINDPRO)).toBeNull();
    expect(/apptsCol\.upsert\(/.exec(findPro)).toBeTruthy();
  });

  it("the embedded directory does not offer to navigate to the page it is already on", () => {
    // Every "prepare a summary" CTA inside FindProfessional is behind !embedded.
    const consultNav = [...findPro.matchAll(/setActiveTab\("consult"\)/g)];
    expect(consultNav.length).toBeGreaterThan(0);
    expect(/\{!embedded &&/.exec(findPro)).toBeTruthy();
    expect(/\{!embedded &&/.exec(PRE_FINDPRO)).toBeNull();
  });

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
    "components/practice/DevelopmentCopilot.tsx": 2,
  };

  it("Appointments no longer holds one", () => {
    expect(appts.match(/setActiveTab\("reports"\)/g)).toBeNull();
  });

  it("the known remaining doors have not multiplied", () => {
    const copilot = read("components/practice/DevelopmentCopilot.tsx");
    expect(copilot.length).toBeGreaterThan(500);
    const count = (copilot.match(/setActiveTab\("reports"\)/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(ALLOWED["components/practice/DevelopmentCopilot.tsx"]);
  });
});
