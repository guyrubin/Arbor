import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Next-level Wave-2 guard — COACH-4 + COACH-8 (2026-07-25).
 *
 * COACH-4: CoachTab is ONE conversation canvas. The wave-2 draft had two
 * mirrored composers (hero + in-thread) bound to the same chatInput — two send
 * buttons, two mics, three photo entries — and the answer streamed into a
 * fixed-height inner-scroll card below the fold. The consolidation keeps the
 * hero composer as the single input and lets the thread flow with the page.
 * Firewall CONDITIONS (CODEX-9 lesson): coach.aiDisclosure (EU AI-Act Art. 50)
 * and the photo/voice entry points MUST survive. A fresh thread must not reserve
 * a tall empty transcript viewport; a settled answer still flows with the page.
 *
 * COACH-8: the Behaviors capture bar must be a REAL input (honest affordance),
 * not a button styled as a text field — typing prefills newLogTrigger and
 * moves focus into the existing form. Zero new capture paths.
 *
 * SOURCE-BASED (same form as clinicalFirewall.wave3.test.ts) so a future
 * re-introduction of the duplicate composer or the fake-affordance bar is
 * caught at CI time.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function count(code: string, needle: string): number {
  return code.split(needle).length - 1;
}

describe("COACH-4 — CoachTab is one composer + one flowing thread", () => {
  const code = read("components/tabs/CoachTab.tsx");
  const composer = read("components/companion/CompanionComposer.tsx");

  it("has exactly one shared text input bound to the conversation draft", () => {
    expect(count(code, "<textarea")).toBe(0);
    expect(count(code, "<CompanionComposer ")).toBe(1);
    expect(count(composer, "<textarea")).toBe(1);
    expect(composer).toContain("value={value}");
    expect(composer).toContain("onChange(event.target.value)");
    expect(count(code, "value={chatInput}")).toBe(1);
    // The deleted bottom capsule input must not come back.
    expect(code).not.toContain("<input");
  });

  it("has exactly one mic, one photo and one document entry point (firewall condition: they survive)", () => {
    expect(count(composer, "onClick={onVoice}")).toBe(1);
    expect(count(composer, 'addFiles(event.target.files, "photo")')).toBe(1);
    expect(count(composer, 'addFiles(event.target.files, "document")')).toBe(1);
    expect(code).toContain("onVoice={() => void toggleVoice()}");
    expect(code).not.toContain("<ArborVision");
  });

  it("renders the EU AI-Act Art. 50 disclosure line (firewall condition: it survives)", () => {
    expect(composer).toContain('inputText(language, "companion.input.arbor-is-your-ai-companion")');
  });

  it("keeps one fresh Ask heading and its count-aware context without a duplicate composer title", () => {
    expect(count(code, "<h1")).toBe(1);
    expect(code).not.toContain("coach.empty.title");
    expect(code).toContain("elev.aihonesty.memory.none");
    expect(code).toContain("elev.aihonesty.memory.some");
  });

  it("fresh Ask reserves no tall empty transcript while answer flow remains unbounded", () => {
    expect(code).not.toMatch(/(?:min-)?h-\[min\(70dvh/);
    expect(code).not.toContain("overflow-y-auto");
    expect(code).toContain('data-module="coach-thread" className={`${cardCls} flex min-w-0 flex-col overflow-hidden`}');
    expect(code).toContain("{chatMessages.map((msg, idx) => (");
  });

  it("keeps Council and the specialist handoff as the compact row under the thread", () => {
    expect(code).toContain("handleCouncilSend");
    expect(code).toContain("coach.specialist.cta");
  });
});

describe("COACH-8 — Behaviors capture is an honest launcher (critic r2)", () => {
  const code = read("components/tabs/BehaviorsTab.tsx");

  // W2-ASKJB critic r2 (behaviors P1 G1): the "real input" became a trap —
  // onChange opened the inline form on EVERY keystroke, moved focus away and
  // cleared the text, so the parent's typing landed in a different field. The
  // honest affordance now is a launcher: Today's QuickCaptureBar, every tile
  // opening the ONE capture sheet in place (its text field is where typing
  // happens and stays). No field on the hub swallows keystrokes.
  it("the hub's capture is QuickCaptureBar opening the one sheet — no hub field that moves the parent's typing", () => {
    expect(code).toMatch(/<QuickCaptureBar\s+childName=\{behFirst\}\s+onText=\{\(\) => openCaptureSheet\(\{ mode: "text" \}\)\}\s+onMode=\{\(mode\) => openCaptureSheet\(\{ mode \}\)\}/);
    expect(code).toContain("onHardMoment={guideLead.any ? () => openHardMomentNow() : undefined}");
    expect(code).not.toContain('id="behaviors-capture-text"');
    expect(code).not.toMatch(/onChange=\{\(e\) => \{ setBarText\(e\.target\.value\); openFromBar/);
    // NEGATIVE CONTROL: the shipped r1 shape is recognised as the trap.
    const r1 = `onChange={(e) => { setBarText(e.target.value); openFromBar(e.target.value); }}`;
    expect(/onChange=\{\(e\) => \{ setBarText\(e\.target\.value\); openFromBar/.test(r1)).toBe(true);
  });

  it("the shared sheet owns the immediately editable input without a hub focus jump", () => {
    const modal = read("components/overview/QuickLogModal.tsx");
    expect(code).not.toMatch(/openFromBar|triggerInputRef|<form|<motion\.form/);
    expect(modal).toContain('id="quick-log-moment"');
    expect(modal).toContain('value={newLogTrigger}');
    expect(modal).toContain('onChange={(e) => changeTrigger(e.target.value)}');
    expect(modal).toMatch(/const changeTrigger = \(text: string\) => \{\s*stopCaptureWork\(\);\s*setNewLogTrigger\(text\);/);
  });

  it("zero duplicate writers — the sheet confirms through the existing one write seam", () => {
    const modal = read("components/overview/QuickLogModal.tsx");
    expect(code).not.toMatch(/handleAddLog\(|addMoment\(/);
    expect(count(modal, "handleAddLog(e, { callerShowsFailure: true, ...contentProvenance })")).toBe(1);
    expect(modal).toContain('onConfirm={confirm}');
    const submit = /const submit = [\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(submit).toContain("setReviewing(true)");
    expect(submit).not.toContain("handleAddLog");
    // Negative control: the retired second writer is detected, not ignored.
    expect('const submitLog = (e) => handleAddLog(e);').toMatch(/handleAddLog\(/);
  });
});

/**
 * Critic r2 (W2-ASKJB coach P1 G1): the subtitle promised "and Arbor remembers
 * for next time" 60 px above the data-use line "Arbor will ask before
 * remembering anything new". Under the contract nothing is kept without Keep
 * this — the subtitle promises only the job; memory is said once, in the
 * data-use line.
 */
describe("critic r2 — Ask's subtitle promises the job, never memory", () => {
  it("coach.subtitle in EN and HE carries no remember verb", async () => {
    const { translate } = await import("./i18n");
    const en = translate("en", "coach.subtitle");
    const he = translate("he", "coach.subtitle");
    expect(en).toBe("Tell Arbor what's happening. You'll get one calm next step and the words to say.");
    expect(en).not.toMatch(/remember|memor|keep|save/i);
    expect(he).not.toMatch(/יזכור|זוכר|לזכור|זיכרון|ישמור|שומר/);
    expect(he).not.toMatch(/[A-Za-z]/);
  });
});
