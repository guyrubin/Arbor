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
 * (b) Memory: the per-item suggestedMemory propose CTA left with ArborVision
 *     itself (deleted 2026-10-09 — nothing mounted it). Memory review from a
 *     unified answer stays on the parent-owned surface pinned below.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("AIX-S3(a) — attached media stays in the unified report and explicit handoff", () => {
  const code = read("components/tabs/CoachTab.tsx");
  const composer = read("components/companion/CompanionComposer.tsx");

  it("the report receives the note argument and threads it into the same editable prefill seam", () => {
    expect(code).toMatch(/onAddToHandoff=\{\(note, audience = "teacher"\) => \{\s*requestConsultPrefill\(\{ note, audience \}\);/);
    expect(code).not.toContain("<ArborVision");
  });

  it("the old dropped-argument mount is gone", () => {
    expect(code).not.toMatch(/onGoHandoff=\{\(\) =>/);
  });

  it("media uses the composer send seam instead of a separate Vision result", () => {
    expect(code).toContain("onSend={handleChatSend}");
    expect(composer).toContain("onSend(undefined, { attachments })");
    expect(code).not.toContain("setVisionMode(");
    expect(code).not.toContain('t("coach.toast.noteCopied")');
  });

  it("the unified answer exposes memory review through the existing parent-owned surface", () => {
    expect(code).toContain("onManageMemory=");
    const cards = read("components/coach/CoachAnswerCards.tsx");
    expect(cards).toContain('t("coach.memory.reviewChip")');
    expect(cards).toContain("onClick={onManageMemory}");
    expect(cards).not.toContain("handleMemoryDecision");
    expect(cards).not.toMatch(/status:\s*["']approved["']/);
  });
});

describe("AIX-S3(a) — AskSpecialist: parent-editable prefill, explicit-act sharing", () => {
  const code = read("components/sections/AskSpecialist.tsx");

  it("consumes the one-shot seam (pendingConsultPrefill → local editable state)", () => {
    // B-CAREPRO-13: the seam carries { reason, note, audience, preset }; the
    // note still lands in the same editable field.
    expect(code).toContain("pendingConsultPrefill");
    expect(code).toContain("consumeConsultPrefill()");
    expect(code).toContain("setVisionNote(patch.note)");
  });

  it("renders the note as an EDITABLE textarea (prefill is not consent)", () => {
    expect(code).toMatch(/<textarea[\s\S]{0,200}value=\{visionNote\}/);
    expect(code).toMatch(/onChange=\{\(e\) => setVisionNote\(e\.target\.value\)\}/);
  });

  it("the note joins the packet only via appendParentNote in markdown() — no new send path", () => {
    expect(code).toContain("serializeForExport(egressAudience, packet, excluded, visionNote");
    // No auto-send: the only submit acts remain the existing explicit ones.
    expect(code).not.toMatch(/useEffect\([\s\S]{0,400}?(submitConsult|requestConsult)/);
  });

  it("editing the note re-arms the reviewed gate", () => {
    // Wave T (LC-08): the export audience is part of what the parent reviews,
    // so changing it re-arms the gate too.
    // LC-20: and so is the reason-for-visit line — it is parent-authored text
    // that rides into every export, so editing it must re-arm the gate as well.
    // W2-CAREPRO c2 r1: the same effect also collapses the phone preview.
    // Match the edit/preview effect specifically, not the separate receipt invalidation.
    const deps = /useEffect\(\(\) => \{ setReviewed\(false\); setPreviewAll\(false\); \}, \[([^\]]+)\]\);/.exec(code);
    expect(deps).toBeTruthy();
    for (const dep of ["excluded", "visionNote", "reason", "audience", "childProfile.id"]) {
      expect(deps![1]).toContain(dep);
    }
    // Fresh text or a changed child/source receipt invalidates approval as well.
    expect(code).toContain("const exportReceipt = useMemo(() => ({}), [exportText, audience, intake, childProfile.id, egress.receipt]);");
    expect(code).toContain("useEffect(() => { setReviewed(false); }, [exportReceipt]);");
    expect(code).toContain("if (!egress.isCurrent() || approval.current !== exportReceipt) approval.current = null;");
    expect(code).toContain("latestExport.current === exportReceipt && egress.isCurrent()");
  });
});

describe("AIX-S3 — ArborContext seam shape", () => {
  const code = read("context/ArborContext.tsx");

  it("defines the one-shot consult-prefill seam (mirrors the capture seam)", () => {
    expect(code).toContain("const requestConsultPrefill = (prefill: ConsultPrefill) => setPendingConsultPrefill(prefill)");
    expect(code).toContain("const consumeConsultPrefill = () => setPendingConsultPrefill(null)");
  });
});

describe("AIX-S3 — EN + HE copy for the handoff CTA", () => {
  const KEYS = [
    "coach.toast.handoffPrefilled",
    "consult.visionNote.title",
    "consult.visionNote.hint",
    "consult.visionNote.heading",
    "consult.visionNote.remove",
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
