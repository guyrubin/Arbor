/**
 * B-CAREPRO-13 — ONE Consult prefill seam carries reason, note, audience and
 * preset (wiring guard in the careTrackWiring.test.ts pattern).
 *
 * Proves:
 *  - every production caller of `requestConsultPrefill` passes the widened
 *    OBJECT shape (no bare string that lands in the wrong field), and every
 *    caller then routes to #/consult;
 *  - Coach's teacher note travels with audience "teacher", Screening and
 *    Safety hand a REASON, Vision a note;
 *  - AskSpecialist consumes all four fields into editable state, and the pure
 *    resolver never lets an audience clear a reason;
 *  - nothing auto-sends: the reviewed gate is re-armed on consumption.
 *
 * Scan discipline: \r\n normalised, every extraction asserted, negative
 * controls against the pre-change shapes.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (k: string) => k }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }),
}));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({}) }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("./Reports", async () => {
  const REPORTS = [
    { titleKey: "elev.reports.therapist.title", type: "therapist" },
    { titleKey: "elev.reports.pediatrician.title", type: "pediatrician" },
    { titleKey: "elev.reports.slp.title", type: "slp" },
    { titleKey: "elev.reports.behavioral_health.title", type: "behavioral_health" },
  ];
  return { REPORTS, useReportExport: () => vi.fn(), useConsultPdf: () => vi.fn() };
});

import { resolveConsultPrefill } from "./AskSpecialist";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules") walk(p, out); continue; }
    if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Every call site `requestConsultPrefill(` in production source, with file. */
const CALLS = walk(SRC).flatMap((f) => {
  const s = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const rel = path.relative(SRC, f).replace(/\\/g, "/");
  return [...s.matchAll(/requestConsultPrefill\(/g)].map((m) => {
    // balanced-paren argument extraction (a reason can itself be a call)
    const open = (m.index ?? 0) + m[0].length;
    let depth = 1, i = open;
    while (i < s.length && depth > 0) { if (s[i] === "(") depth++; else if (s[i] === ")") depth--; i++; }
    return { rel, arg: s.slice(open, i - 1), at: m.index ?? 0, src: s };
  });
});

const OBJECT_ARG = /^\{[\s\S]*\}$/;

describe("B-CAREPRO-13 · every caller goes through the widened seam", () => {
  it("the scan found five explicit callers (Appointments, Reports, unified Coach report, Screening, Safety)", () => {
    const files = CALLS.map((c) => c.rel).sort();
    expect(files).toEqual([
      "components/sections/Appointments.tsx", // B-CAREPRO-31: "Prepare" on an upcoming visit
      "components/sections/Reports.tsx", // B-CAREPRO-23: the one door from Your full record into Consult
      "components/sections/Screening.tsx",
      "components/tabs/CoachTab.tsx",
      "components/tabs/SafetyTab.tsx",
    ]);
  });

  it("every call passes an object literal and then routes to #/consult", () => {
    for (const c of CALLS) {
      expect(c.arg.trim(), `${c.rel}: ${c.arg}`).toMatch(OBJECT_ARG);
      const after = c.src.slice(c.at, c.at + 400);
      expect(after, `${c.rel} routes to consult`).toContain('setActiveTab("consult")');
    }
    // NEGATIVE CONTROL: the pre-change string shapes fail the same rule.
    for (const pre of ["note", "visitPrefillReason(watchAreas, t)"]) expect(OBJECT_ARG.test(pre)).toBe(false);
  });

  it("each caller sets the field it knows", () => {
    const coach = read("components/tabs/CoachTab.tsx");
    expect(coach).toContain('requestConsultPrefill({ note, audience: "teacher" });'); // teacher note
    expect(coach).not.toContain("<ArborVision"); // attached media stays in the unified conversation
    expect(read("components/sections/Screening.tsx")).toContain("requestConsultPrefill({ reason: visitPrefillReason(watchAreas, t) });");
    expect(read("components/tabs/SafetyTab.tsx")).toContain('requestConsultPrefill({ reason: t("elev.safety.signs.consultReason", { labels }) });');
  });

  it("the context seam carries the four-field type and only AskSpecialist consumes it", () => {
    const ctx = read("context/ArborContext.tsx");
    const type = /export type ConsultPrefill = \{([\s\S]*?)\};/.exec(ctx);
    expect(type).toBeTruthy();
    for (const f of ["reason?: string", "note?: string", "audience?: ExportAudience", "preset?:"]) expect(type![1]).toContain(f);
    const readers = walk(SRC)
      .filter((f) => readFileSync(f, "utf8").includes("pendingConsultPrefill"))
      .map((f) => path.relative(SRC, f).replace(/\\/g, "/"))
      .sort();
    expect(readers).toEqual(["components/sections/AskSpecialist.tsx", "context/ArborContext.tsx"]);
  });
});

describe("B-CAREPRO-13 · AskSpecialist consumes all four fields", () => {
  const ask = read("components/sections/AskSpecialist.tsx");

  it("the effect applies reason, note and audience (a preset IS an audience), re-arms the gate, then consumes", () => {
    const eff = /useEffect\(\(\) => \{\n    if \(pendingConsultPrefill == null\) return;[\s\S]*?\}, \[pendingConsultPrefill\]\);/.exec(ask);
    expect(eff).toBeTruthy();
    for (const line of [
      "setReason(patch.reason)",
      "setVisionNote(patch.note)",
      "setAudienceState(patch.audience)",
      "setReviewed(false)",
      "consumeConsultPrefill()",
    ]) expect(eff![0]).toContain(line);
    // the caller's audience is not persisted as the parent's remembered choice
    expect(eff![0]).not.toContain("setAudience(");
    // no auto-send from the prefill
    expect(eff![0]).not.toMatch(/copy\(|savePdf\(|printPdf\(|sendToTrusted\(|exportReport\(/);
  });

  it("every prefilled field stays editable", () => {
    expect(ask).toMatch(/value=\{reason\}\n\s*onChange=\{\(e\) => setReason\(e\.target\.value\)\}/);
    expect(ask).toMatch(/onChange=\{\(e\) => setVisionNote\(e\.target\.value\)\}/);
    expect(ask).toContain("onClick={() => setAudience(a)}");
  });

  it("B-CAREPRO-28: a caller's preset selects that audience; every verb stays behind the gate", () => {
    expect(ask).not.toContain("presetHint");
    expect(ask).not.toContain("menuReports");
    for (const verb of ["onClick={copy} disabled={noneSelected}", "onClick={savePdf} disabled={noneSelected}"]) expect(ask).toContain(verb);
    expect(ask).toMatch(/onClick=\{sendToTrusted\}\n\s*disabled=\{noneSelected\}/);
  });

  it("resolver: an audience never clears a reason; each field independent", () => {
    expect(resolveConsultPrefill({ reason: "Speech at 3", audience: "teacher" })).toEqual({ reason: "Speech at 3", audience: "teacher" });
    expect(resolveConsultPrefill({ note: "From the coach", audience: "teacher" })).toEqual({ note: "From the coach", audience: "teacher" });
    expect(resolveConsultPrefill({ reason: "r", note: "n", audience: "self" })).toEqual({ reason: "r", note: "n", audience: "self" });
  });

  it("resolver: a preset IS the audience; legacy 'clinician' reads as therapist; blanks, unknowns and the teacher preset set nothing", () => {
    expect(resolveConsultPrefill({ preset: "pediatrician" })).toEqual({ audience: "pediatrician" });
    expect(resolveConsultPrefill({ preset: "slp", reason: "Visit with SLP" })).toEqual({ audience: "slp", reason: "Visit with SLP" });
    expect(resolveConsultPrefill({ audience: "clinician" as never })).toEqual({ audience: "therapist" });
    expect(resolveConsultPrefill({ reason: "  ", note: "" })).toEqual({});
    expect(resolveConsultPrefill({ audience: "nurse" as never })).toEqual({});
    expect(resolveConsultPrefill({ preset: "teacher" as never })).toEqual({});
  });
});
