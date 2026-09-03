import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "./i18n";

/**
 * AIX-S3 — ArborVision's loop CTAs feed real seams (source-tier guards, in the
 * coachCaptureHonesty.test.ts style).
 *
 * (a) Handoff: CoachTab's ArborVision mount must CONSUME the handoffNote
 *     argument — threading it into the consult-composer prefill seam
 *     (requestConsultPrefill) — never the old dropped-arg `onGoHandoff={() =>`
 *     that left the parent on an empty consult tab. AskSpecialist consumes the
 *     seam into a PARENT-EDITABLE note; the note joins exports only through
 *     the existing explicit acts (firewall: prefill is not consent).
 *
 * (b) Memory: suggestedMemory items get a per-item propose CTA through the
 *     EXISTING parent-approved seam (proposeMemory → POST /memory/:id/propose)
 *     so items land ONLY in the pending-approval queue.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("AIX-S3(a) — CoachTab consumes the handoff note (mount contract)", () => {
  const code = read("components/tabs/CoachTab.tsx");

  it("onGoHandoff receives the note argument and threads it into requestConsultPrefill", () => {
    expect(code).toMatch(/onGoHandoff=\{\(note\) => \{ requestConsultPrefill\(note\);/);
  });

  it("the old dropped-argument mount is gone", () => {
    expect(code).not.toMatch(/onGoHandoff=\{\(\) =>/);
  });

  it("the toast is the factual 'prefilled' copy, not the stale 'paste it' copy", () => {
    const mount = code.slice(code.indexOf("<ArborVision"));
    expect(mount).toContain('t("coach.toast.handoffPrefilled")');
    expect(mount).not.toContain('t("coach.toast.noteCopied")');
  });

  it("onProposeMemory wires the existing parent-approved propose seam", () => {
    expect(code).toMatch(/onProposeMemory=\{\(fact\) => proposeMemory\(fact/);
  });
});

describe("AIX-S3(a) — AskSpecialist: parent-editable prefill, explicit-act sharing", () => {
  const code = read("components/sections/AskSpecialist.tsx");

  it("consumes the one-shot seam (pendingConsultNote → local editable state)", () => {
    expect(code).toContain("pendingConsultNote");
    expect(code).toContain("consumeConsultPrefill()");
    expect(code).toContain("setVisionNote(pendingConsultNote)");
  });

  it("renders the note as an EDITABLE textarea (prefill is not consent)", () => {
    expect(code).toMatch(/<textarea[\s\S]{0,200}value=\{visionNote\}/);
    expect(code).toMatch(/onChange=\{\(e\) => setVisionNote\(e\.target\.value\)\}/);
  });

  it("the note joins the packet only via appendParentNote in markdown() — no new send path", () => {
    expect(code).toContain("serializeForExport(audience, packet, excluded, visionNote");
    // No auto-send: the only submit acts remain the existing explicit ones.
    expect(code).not.toMatch(/useEffect\([\s\S]{0,400}?(submitConsult|requestConsult)/);
  });

  it("editing the note re-arms the reviewed gate", () => {
    // Wave T (LC-08): the export audience is part of what the parent reviews,
    // so changing it re-arms the gate too.
    expect(code).toMatch(/setReviewed\(false\); \}, \[excluded, visionNote, audience, childProfile\.id\]/);
  });
});

describe("AIX-S3 — ArborContext seam shape", () => {
  const code = read("context/ArborContext.tsx");

  it("defines the one-shot consult-prefill seam (mirrors the capture seam)", () => {
    expect(code).toContain("const requestConsultPrefill = (note: string) => setPendingConsultNote(note)");
    expect(code).toContain("const consumeConsultPrefill = () => setPendingConsultNote(null)");
  });
});

describe("AIX-S3(b) — suggestedMemory items propose into the pending queue only", () => {
  const code = read("components/coach/ArborVision.tsx");

  it("each suggestedMemory item renders a per-item propose CTA", () => {
    expect(code).toMatch(/suggestedMemory\.map\(\(fact, i\)/);
    expect(code).toContain("proposeItem(fact, i)");
    expect(code).toContain('t("vis.memory.save"');
  });

  it("propose goes through the injected seam — no direct fetch and no auto-approve", () => {
    expect(code).toContain("onProposeMemory(fact)");
    expect(code).not.toContain("fetch(");
    // The component never performs an approval transition — approval stays in
    // Profile › Child Memory (handleMemoryDecision), untouched here.
    expect(code).not.toContain("handleMemoryDecision");
    expect(code).not.toMatch(/status:\s*["']approved["']/);
  });

  it("pending-queue honesty note renders with the list", () => {
    expect(code).toContain('t("vis.memory.pendingNote")');
  });
});

describe("AIX-S3 — EN + HE copy for both CTAs", () => {
  const KEYS = [
    "coach.toast.handoffPrefilled",
    "consult.visionNote.title",
    "consult.visionNote.hint",
    "consult.visionNote.heading",
    "consult.visionNote.remove",
    "vis.memory.save",
    "vis.memory.saved",
    "vis.memory.retry",
    "vis.memory.pendingNote",
  ];

  it("every key exists in BOTH dictionaries with non-empty values", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
    }
  });

  it("provenance copy is factual — no confidence/certainty wording", () => {
    const banned = /(\b95%|\bconfident|\bcertain|\baccurate|\bguarantee)/i;
    for (const k of KEYS) expect(en[k]).not.toMatch(banned);
  });
});
