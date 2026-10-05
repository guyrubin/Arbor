/**
 * LC-11 mount guard — the School Brief surface.
 *
 * The pure rules (curated ceiling, the parent-only escalation note, print
 * sections) are proven in src/schoolBrief/schoolBrief.test.ts. This file proves
 * the SURFACE uses them: the export is a real document, the escalation note is
 * rendered to the parent, the language reaches the generation seam, and the
 * Consult menu no longer mints a rival teacher document.
 *
 * Scan discipline: \r\n normalised first, extractions asserted toBeTruthy(),
 * and every rule carries a negative control against the pre-change source.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const brief = read("components/sections/SchoolBrief.tsx");
const consult = read("components/sections/AskSpecialist.tsx");

/** The pre-change export path and generation call, verbatim from the audit. */
const PRE_BRIEF = `
      const data = await api.generateBrief({
        childProfile,
        logs: behaviorLogs,
        milestones,
        audience: "teacher",
      });
      const md = serializeSchoolBrief(ex, sectionLabels);
      const blob = new Blob([md], { type: "text/markdown" });
      const a = document.createElement("a");
      a.download = \`\${firstName}-school-handoff-\${ex.date}.md\`;
      a.click();
`.replace(/\r\n/g, "\n");

/** The pre-change Consult export menu handler. */
const PRE_CONSULT = `
  const runExport = (type: typeof REPORTS[number]["type"]) => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    toast(t("consult.opening"), "info");
    try { exportReport(type, excluded); }
    catch { toast(t("consult.exportError"), "error"); }
  };
`.replace(/\r\n/g, "\n");

describe("LC-11 · the teacher receives a document, not a Markdown file", () => {
  it("the sources were really read", () => {
    expect(brief.length).toBeGreaterThan(2000);
    expect(brief).toContain("export default function SchoolBrief");
    expect(consult).toContain("export default function AskSpecialist");
  });

  it("the approved brief goes through the shared, native-aware print egress", () => {
    expect(/openPrintableReport\(/.exec(brief)).toBeTruthy();
    expect(/schoolBriefToPrintSections\(/.exec(brief)).toBeTruthy();
    expect(/openPrintableReport/.exec(PRE_BRIEF)).toBeNull();
  });

  it("the .md blob download is gone", () => {
    expect(brief).not.toContain('type: "text/markdown"');
    expect(brief).not.toContain("-school-handoff-");
    expect(PRE_BRIEF).toContain('type: "text/markdown"');
  });

  it("the parent's language reaches the generation seam", () => {
    const call = /api\.generateBrief\(\{[\s\S]*?\}\)/.exec(brief);
    expect(call).toBeTruthy();
    expect(call![0]).toMatch(/language:\s*uiLang === "he" \? "he" : "en"/);
    expect(/language:/.exec(PRE_BRIEF)).toBeNull();
  });
});

describe("LC-11 · the escalation note reaches the parent (the serious half)", () => {
  it("the note renders in its own parent-only card", () => {
    expect(/data-testid="school-brief-escalation"/.exec(brief)).toBeTruthy();
    expect(/parentEscalationNote\(draft\)/.exec(brief)).toBeTruthy();
    expect(/data-testid="school-brief-escalation"/.exec(PRE_BRIEF)).toBeNull();
  });

  it("the card is labelled as NOT part of the teacher's copy, and routes to Safety", () => {
    const card = /data-testid="school-brief-escalation"[\s\S]*?<\/section>/.exec(brief);
    expect(card).toBeTruthy();
    expect(card![0]).toContain("elev.learnCare.brief.escalation.title");
    expect(card![0]).toContain("elev.learnCare.brief.escalation.body");
    expect(card![0]).toContain('setActiveTab("safety")');
  });

  it("the export path asserts the note cannot leak (fail closed at the seam)", () => {
    expect(/assertEscalationNoteNotExported\(/.exec(brief)).toBeTruthy();
    expect(/assertEscalationNoteNotExported/.exec(PRE_BRIEF)).toBeNull();
  });
});

/* ── LC-11b — "one teacher document, one door", checked against EVERY door ──
 *
 * This suite used to scan ONE named file (AskSpecialist.tsx) and conclude the
 * claim held. It did not: the Reports page (#/reports is a live route) still
 * rendered a "Teacher Handoff" card whose button ran the preset PDF path —
 * with no per-export approval, no CURATED_FIELDS allowlist, no
 * `assertEscalationNoteNotExported`, no parent review of AI-edited fields. The
 * scan passed while the open door was the UNGATED one.
 *
 * So the rule is now applied to every file that can REACH a teacher export,
 * discovered by walking the tree rather than by naming files. A new component
 * that consumes the export seam without routing the teacher type fails here. */

const reports = read("components/sections/Reports.tsx");

/** Every non-test source file, walked (not listed). */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const SOURCES = walk(SRC)
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ rel: path.relative(SRC, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8").replace(/\r\n/g, "\n") }));

/** A file can reach a teacher export if it consumes the export seam
 *  (`serializeForExport` / `exportPrintSections`) or builds a preset packet
 *  itself. `consult/packet.ts` DEFINES those functions — it is the policy
 *  module, not a door. B-CAREPRO-28: `useReportExport` prints parent-record
 *  documents only (its parameter is a ParentReportType), so it is no door. */
const TEACHER_REACHERS = SOURCES.filter(
  (f) =>
    f.rel !== "consult/packet.ts" &&
    (/serializeForExport\(/.test(f.src) || /exportPrintSections\(/.test(f.src) ||
      /buildPresetPacket\(/.test(f.src) || /presetPacketToPrintSections\(/.test(f.src))
);

/** The rule every door must satisfy: it recognises the teacher audience and
 *  sends it to the School Brief instead of minting a rival teacher document. */
const routesTeacherToSchoolBrief = (src: string): boolean =>
  /(type|audience) === "teacher"/.test(src) && /setActiveTab\("school-brief"\)/.test(src);

/** The pre-change Reports card: every report type exported unconditionally. */
const PRE_REPORTS_CARD = `
              <button
                onClick={() => exportReport(r.type)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"
                aria-label={\`Export \${r.title} as PDF\`}
              >
                <Icon name="download" size={14} /> PDF
              </button>
`.replace(/\r\n/g, "\n");

/** A plausible NEW component reaching the seam without routing the teacher. */
const HYPOTHETICAL_NEW_DOOR = `
  const exportReport = useReportExport();
  return <button onClick={() => exportReport("teacher")}>Teacher handoff</button>;
`;

describe("LC-11b · one teacher door — every door, not one named file", () => {
  it("the sweep really found the doors (non-vacuity)", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    const rels = TEACHER_REACHERS.map((f) => f.rel);
    expect(rels).toContain("components/sections/AskSpecialist.tsx");
    expect(TEACHER_REACHERS.length).toBeGreaterThanOrEqual(1);
  });

  it("EVERY file that can reach a teacher export routes it to the School Brief", () => {
    for (const file of TEACHER_REACHERS) {
      expect(routesTeacherToSchoolBrief(file.src), `${file.rel} can export a teacher document without routing to the School Brief`).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the pre-change card, and any new door, fail the same rule", () => {
    expect(routesTeacherToSchoolBrief(PRE_CONSULT)).toBe(false);
    expect(routesTeacherToSchoolBrief(PRE_REPORTS_CARD)).toBe(false);
    expect(routesTeacherToSchoolBrief(HYPOTHETICAL_NEW_DOOR)).toBe(false);
  });

  it("B-CAREPRO-28: Consult's teacher audience opens the School Brief and builds no teacher text", () => {
    expect(consult).toContain('const isTeacher = audience === "teacher";');
    const branch = /data-testid="consult-teacher-branch"[\s\S]*?<\/section>/.exec(consult);
    expect(branch).toBeTruthy();
    // B-CAREPRO-27: the teacher note travels with the parent into the brief.
    expect(branch![0]).toContain('onClick={() => { handTeacherNote(visionNote); setActiveTab("school-brief"); }}');
    // no Copy / PDF / send text for a teacher: the build and the PDF both stop first
    expect(consult).toContain('if (isTeacher) return { text: null, error: "" };');
    expect(consult).toContain("if (exportText == null || isTeacher) return;");
    expect(/type === "teacher"/.exec(PRE_CONSULT)).toBeNull();
  });

  it("the Reports page carries no Teacher card at all (B-CAREPRO-23: parent-record documents only)", () => {
    expect(reports.length).toBeGreaterThan(2000);
    expect(reports).toContain("export default function Reports");
    // The page iterates the parent-record list — the teacher type (and every
    // professional preset) cannot appear as a card, so no ungated teacher PDF.
    const page = reports.slice(reports.indexOf("export default function Reports"));
    // W2-CAREPRO c2 r1: the lead saves the combined parent record ("record" →
    // buildFullRecord, parent documents only); every document is a row of the same list.
    expect(page).toContain('exportReport("record");');
    expect(page).toContain("{PARENT_RECORD_REPORTS.map((r) => (");
    expect(page).not.toContain("reports-teacher-one-door");
    expect(page).not.toMatch(/\{REPORTS\.map\(/);
    // NEGATIVE CONTROL: the pre-change card exported every type unconditionally.
    expect(PRE_REPORTS_CARD).toContain("exportReport(r.type)");
  });

  it("B-CAREPRO-28: the Reports seam prints parent records only — no preset packet is built there", () => {
    const hook = reports.slice(reports.indexOf("export function useReportExport"), reports.indexOf("export function useConsultPdf"));
    expect(hook.length).toBeGreaterThan(300);
    expect(hook).toContain('return (type: ParentReportType | "record") => {');
    expect(hook).toContain('type === "record" ? buildFullRecord(ctx, uiLang) : buildReport(type, ctx, uiLang)');
    expect(reports).not.toContain("buildPresetPacket(");
    expect(reports).not.toContain("presetPacketToPrintSections(");
  });
});

/* ── B-CAREPRO-01 — a server escalation (409) is a Safety door, not a retry toast ──
 *
 * request() throws EscalationRequiredError on EVERY 409 with `details`
 * (which outranks `error`) as its message — so the old
 * `includes("Professional support")` branch never matched and the parent got
 * the generic "Couldn't build" toast. */
import { api, EscalationRequiredError, ApiError } from "../../lib/api";

describe("B-CAREPRO-01 · a blocked School Brief generate opens the escalation card", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: status < 400,
      status,
      headers: { get: () => null },
      json: async () => body,
    })));

  const payload = { childProfile: {} as any, logs: [], milestones: [], audience: "teacher" };

  it("409 (input screen body) reaches the caller as EscalationRequiredError", async () => {
    stubFetch(409, {
      error: "Professional support recommended",
      details: "This handoff should be reviewed by a qualified adult before sharing. Category: self_harm",
      escalationCategory: "self_harm",
    });
    const err = await api.generateBrief(payload).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationRequiredError);
    // The message the old substring branch looked at never carries the phrase.
    expect(err.message).not.toContain("Professional support");
  });

  it("409 (output screen body) reaches the caller as EscalationRequiredError", async () => {
    stubFetch(409, { error: "Professional support recommended", details: "Arbor could not produce a routine brief." });
    const err = await api.generateBrief(payload).catch((e) => e);
    expect(err).toBeInstanceOf(EscalationRequiredError);
  });

  it("500 stays a plain ApiError (the existing buildFailed toast path)", async () => {
    stubFetch(500, { error: "boom" });
    const err = await api.generateBrief(payload).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(EscalationRequiredError);
  });

  it("SchoolBrief imports EscalationRequiredError and branches on it before the generic toast", () => {
    expect(brief).toMatch(/import \{[^}]*EscalationRequiredError[^}]*\} from "\.\.\/\.\.\/lib\/api"/);
    const catchBlock = /\} catch \(err: any\) \{([\s\S]*?)\} finally \{/.exec(brief);
    expect(catchBlock).toBeTruthy();
    const body = catchBlock![1];
    const esc = body.indexOf("err instanceof EscalationRequiredError");
    const generic = body.indexOf('t("elev.learnCare.brief.buildFailed")');
    expect(esc).toBeGreaterThan(-1);
    expect(generic).toBeGreaterThan(esc);
    expect(body.slice(esc, generic)).toContain("setEscalationBlocked(true)");
    // The escalation branch raises no toast.
    expect(body.slice(esc, body.indexOf("else", esc))).not.toContain("toast(");
  });

  it("the dead substring branch is gone", () => {
    expect(brief).not.toContain('includes("Professional support")');
  });

  it("the escalation card renders from a blocked generate (one screen since B-CAREPRO-27: the draft is always there)", () => {
    expect(brief).toMatch(/const escalationCard = escalationNote \|\| escalationBlocked \?/);
    // B-CAREPRO-27: there is no empty state any more — the free draft is on
    // screen from the start — so the card mounts once, beside the draft.
    expect(brief.match(/\{escalationCard\}/g)?.length).toBe(1);
    expect(brief).not.toContain("{!draft ? (");
    const card = /data-testid="school-brief-escalation"[\s\S]*?<\/section>/.exec(brief);
    expect(card![0]).toContain("elev.learnCare.brief.escalation.blocked");
  });
});

/* B-CAREPRO-16 — a Free parent's generate answers 402 (requirePlusFeature
 * "professionalReports"); the brief used to toast the server's English
 * "Upgrade to Arbor Plus to use professional reports." with no paywall. */
import { PaywallError } from "../../lib/api";

describe("B-CAREPRO-16 · a Free parent gets the paywall sheet, not an English toast", () => {
  afterEach(() => vi.unstubAllGlobals());
  const payload = { childProfile: {} as any, logs: [], milestones: [], audience: "teacher" };

  it("402 reaches the caller as PaywallError carrying the professionalReports feature", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 402,
      headers: { get: () => null },
      json: async () => ({ error: "Upgrade required", details: "Upgrade to Arbor Plus to use professional reports.", upgrade: { feature: "professionalReports", plan: "plus" } }),
    })));
    const err = await api.generateBrief(payload).catch((e) => e);
    expect(err).toBeInstanceOf(PaywallError);
    expect(err.feature).toBe("professionalReports");
  });

  it("the PaywallError branch opens the paywall with the error's feature and plan; no toast of err.message", () => {
    const catchBlock = /\} catch \(err: any\) \{([\s\S]*?)\} finally \{/.exec(brief);
    expect(catchBlock).toBeTruthy();
    expect(catchBlock![1]).toContain("else if (err instanceof PaywallError) openPaywall(err.feature, err.plan);");
    expect(brief).not.toMatch(/toast\(err\.message/);
    // NEGATIVE CONTROL: the pre-change branch is caught by the same rule.
    expect(/toast\(err\.message/.test('else if (err instanceof PaywallError) toast(err.message, "info");')).toBe(true);
  });
});

/* ── B-CAREPRO-27 — one teacher document: the School Brief, seeded from the
 * teacher preset. Consult's teacher Copy/Download/mail used to mint a second,
 * deterministic teacher document (about + tried) beside the AI brief, and the
 * brief itself was Plus-only. Now: the packet seam refuses a teacher, the brief
 * opens on a FREE draft from CONSULT_PRESETS.teacher, and "Draft with Arbor"
 * (Plus) is the only network path. */
import {
  buildConsultPacket,
  exportPrintSections,
  serializeForExport,
  teacherBriefDraft,
  TeacherEgressError,
  type BuildPacketInput,
} from "../../consult/packet";
import { buildSchoolBriefExport, findClinicalDiagnosisTerm } from "../../schoolBrief/schoolBrief";
import { handTeacherNote, takeTeacherNote } from "../../schoolBrief/teacherHandoff";

const DRAFT_INPUT: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew", "English"], schoolContext: "Gan Shaked", strengths: ["Builds towers", "Kind to friends"], challenges: ["Speech delay"] },
  logs: [{ behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date().toISOString(), trigger: "leaving the park" }],
  milestones: [{ domain: "language_communication", title: "Says two-word phrases", checked: true }],
  plans: [{ title: "Five-minute warning", issue: "leaving the park" }],
  memory: [{ fact: "Calms with a countdown", status: "approved" }],
  nowMs: Date.now(),
  reason: "Should we get him assessed?",
};

describe("B-CAREPRO-27 · teacher egress only via buildSchoolBriefExport", () => {
  it("the consult seam refuses a teacher (Copy text and PDF sections)", () => {
    const packet = buildConsultPacket(DRAFT_INPUT);
    expect(() => serializeForExport("teacher", packet)).toThrow(TeacherEgressError);
    expect(() => exportPrintSections("teacher", packet)).toThrow(TeacherEgressError);
    // POSITIVE CONTROL: a clinician audience still builds.
    expect(serializeForExport("therapist", packet)).toContain("Five-minute warning");
  });

  it("no component hands the literal teacher audience to a packet serializer", () => {
    const TEACHER_CALL = /\b(serializeForExport|exportPrintSections|serializePresetPacket|presetPacketToPrintSections|buildPresetPacket)\(\s*"teacher"/;
    const offenders = SOURCES.filter((f) => f.rel.startsWith("components/") && TEACHER_CALL.test(f.src)).map((f) => f.rel);
    expect(offenders).toEqual([]);
    expect(TEACHER_CALL.test('serializeForExport("teacher", packet, excluded)')).toBe(true);
  });

  it("the School Brief prints only through buildSchoolBriefExport (approval + curated fields + scan)", () => {
    const onApprove = /const onApprove = \(\) => \{[\s\S]*?\n  \};/.exec(brief);
    expect(onApprove).toBeTruthy();
    expect(onApprove![0]).toContain("canExport(approved)");
    expect(onApprove![0]).toContain("buildExport()");
    expect(onApprove![0]).toContain("openPrintableReport(");
    expect(brief).toMatch(/return buildSchoolBriefExport\(draft, \{/);
  });
});

describe("B-CAREPRO-27 · the brief opens on a free draft from the teacher preset", () => {
  it("overview ← about lines; strengths ← profile strengths; strategies ← the plan as written, never its issue (W2-CAREPRO c2 r1)", () => {
    const d = teacherBriefDraft(DRAFT_INPUT, "en");
    expect(d.overview).toContain("Dylan");
    expect(d.overview).toContain("Setting: Gan Shaked.");
    expect(d.keyStrengths).toEqual(["Builds towers", "Kind to friends"]);
    // A plan with no steps: its title alone — the issue never reaches a teacher.
    expect(d.suggestedTeacherStrategies).toEqual(["Five-minute warning"]);
    expect(JSON.stringify(d.suggestedTeacherStrategies)).not.toContain("leaving the park");
  });

  it("never carries what the teacher ceiling forbids: logs, milestones, memory, the clinician-facing reason", () => {
    const text = JSON.stringify(teacherBriefDraft(DRAFT_INPUT, "en"));
    for (const banned of ["Transition Refusal", "Says two-word phrases", "Calms with a countdown", "assessed"]) expect(text).not.toContain(banned);
  });

  it("a line the clinical scan would refuse is left out, so the free draft prints (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const d = teacherBriefDraft(DRAFT_INPUT, lang);
      const all = [d.overview, ...d.keyStrengths, ...d.suggestedTeacherStrategies].join("\n");
      expect(findClinicalDiagnosisTerm(all), lang).toBeNull();
      expect(() => buildSchoolBriefExport({ ...d, classroomChallenges: [], languageSupportPlan: [] }, { title: "Brief", date: "2026-10-02" })).not.toThrow();
    }
    // NEGATIVE CONTROL: the dropped line would have failed the export scan.
    expect(findClinicalDiagnosisTerm("Current focus: Speech delay.")).not.toBeNull();
  });

  it("HE draft passes the HE clinical list and speaks Hebrew around the family's words", () => {
    const d = teacherBriefDraft({ ...DRAFT_INPUT, profile: { ...DRAFT_INPUT.profile, schoolContext: "גן שקד", challenges: ["בקרים"] } }, "he");
    expect(d.overview).toContain("מסגרת:");
    expect(d.overview).not.toContain("Setting:");
    expect(findClinicalDiagnosisTerm(d.overview)).toBeNull();
  });

  it("the editor seeds from the free draft — no network, no paywall — and Plus is the AI draft", () => {
    expect(brief).toContain("const [draft, setDraft] = useState<SchoolBriefData>(freeDraft);");
    expect(brief).toMatch(/teacherBriefDraft\(\n?\s*buildPacketInput\(/);
    // the AI path is a separate, labelled button; the free path calls no api
    // B-CAREPRO-NEW-2d: the memo also returns the opening line it built.
    const freeDraftMemo = /const \{ freeDraft, openingLine \} = useMemo\(\(\) => \{[\s\S]*?\}, \[/.exec(brief);
    expect(freeDraftMemo).toBeTruthy();
    expect(freeDraftMemo![0]).not.toMatch(/api\.|fetch\(/);
    expect(brief).toContain('data-testid="school-brief-ai-draft"');
    expect(brief).toContain('t("elev.learnCare.brief.aiDraft")');
    // the distinct-from-consult line and the empty state are gone (one document)
    expect(brief).not.toContain("schoolBrief.distinct");
    expect(brief).not.toContain("schoolBrief.empty.");
  });

  it("Consult's teacher note travels once into the brief", () => {
    handTeacherNote("  Loves trains — use them for transitions.  ");
    expect(takeTeacherNote()).toBe("Loves trains — use them for transitions.");
    expect(takeTeacherNote()).toBeNull();
    expect(brief).toContain("useState<string | null>(() => takeTeacherNote())");
  });
});
