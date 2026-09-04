/* Wave L — CoachTab structural pins (ENG-10/11, GP-14, AI-06, AI-23, AI-24).
 *
 * The vitest env is node-only (`src/**\/*.test.ts`), so component acceptance is
 * pinned structurally, the house pattern used by coachStreamingUx.test.ts and
 * askJourneyUx.test.ts. Every assertion below is paired with a NEGATIVE
 * CONTROL that runs the matcher against the PRE-CHANGE source shape and proves
 * it would have failed — a source assertion that cannot fail is not a test.
 *
 * The behavioural halves live in pure modules with real tests:
 *   lib/timeOfDay.test.ts · lib/jitai.test.ts · lib/jitaiTelemetry.test.ts ·
 *   lib/coachDisclosure.test.ts · lib/aiErrorCopy.test.ts ·
 *   lib/apiVoiceStatus.test.ts
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const coach = stripComments(read("components/tabs/CoachTab.tsx"));
const cue = stripComments(read("components/coach/RhythmCue.tsx"));

describe("ENG-10 / ENG-11 — the cue is mounted on a surface a parent opens, and measured", () => {
  it("CoachTab mounts RhythmCue", () => {
    expect(coach).toMatch(/import RhythmCue from "\.\.\/coach\/RhythmCue"/);
    expect(coach).toMatch(/<RhythmCue\s+surface="coach"\s*\/>/);
  });

  it("NEGATIVE CONTROL — the pre-change CoachTab had no cue at all", () => {
    const preFix = `{!userTurnExists && (\n  <div className="space-y-2">`;
    expect(/<RhythmCue/.test(preFix)).toBe(false);
  });

  it("the cue renders the ENGINE's decision and adds no gate of its own", () => {
    expect(cue).toMatch(/nextNudge\(/);
    expect(cue).toMatch(/loadPrefs\(\)/);
    expect(cue).toMatch(/shownNudgesToday\(\)/);
    // It must NOT spend the day's ceiling a second time — the bell owns that
    // ledger (growth/jitaiPrefs.recordNudgeShown).
    expect(cue).not.toMatch(/recordNudgeShown/);
  });

  it("every visible string comes from the nudge's i18n keys, never inline copy", () => {
    expect(cue).toMatch(/t\(visible\.headlineKey, visible\.vars\)/);
    expect(cue).toMatch(/t\(visible\.bodyKey, visible\.vars\)/);
    expect(cue).toMatch(/t\(visible\.ctaKey, visible\.vars\)/);
  });

  it("shown / acted / dismissed are all instrumented (ENG-11's 'unmeasured' half)", () => {
    expect(cue).toMatch(/trackNudgeShown\(/);
    expect(cue).toMatch(/trackNudgeActed\(/);
    expect(cue).toMatch(/trackNudgeDismissed\(/);
  });

  it("clinical firewall: the card carries no score, ring, percentage or verdict", () => {
    // (\bring\b is deliberately absent — Tailwind's focus-visible:ring is
    // an accessibility affordance, not a progress ring.)
    expect(cue).not.toMatch(/percent|\bscore\b|\bpercentile\b|\bgrade\b|\bon track\b|\bbehind\b|\bdelay(ed)?\b|progress-?ring/i);
    // Tone comes from the CUE's kind, never from how the child's day went.
    expect(cue).toMatch(/PASTEL\[visible\.tone\]/);
  });

  it("touch targets and RTL: 44px controls, logical spacing, dir=auto on copy", () => {
    expect(cue).toMatch(/min-h-\[44px\]/);
    expect(cue).toMatch(/dir="auto"/);
    expect(cue).not.toMatch(/#[0-9a-fA-F]{6}/); // tokens only, no raw hex
  });
});

describe("GP-14 — the disclosure names WHICH facts and fields, not just how many", () => {
  it("the panel's uses[] is built by coachDisclosure from the approved ledger", () => {
    expect(coach).toMatch(/import \{ coachDisclosure \} from "\.\.\/\.\.\/lib\/coachDisclosure"/);
    expect(coach).toMatch(/coachDisclosure\(/);
    expect(coach).toMatch(/approvedFacts: approvedMemoryItems\.map\(/);
    expect(coach).toMatch(/factsUsedInLastAnswer: lastFactsUsed/);
  });

  it("NEGATIVE CONTROL — the pre-change uses[] was a bare count with no fact text", () => {
    const preFix = `uses={[
      tcc("elev.coachcontract.uses.message"),
      tcc("elev.coachcontract.uses.profile", { name: childFirst }),
      typeof lastFactsUsed === "number"
        ? tcc("elev.coachcontract.uses.memory", { count: lastFactsUsed })
        : tcc("elev.coachcontract.uses.memoryNone"),
    ]}`;
    expect(/coachDisclosure\(/.test(preFix)).toBe(false);
    expect(/approvedFacts:/.test(preFix)).toBe(false);
    // and the count-only bullet is gone from the live source
    expect(coach).not.toMatch(/tcc\("elev\.coachcontract\.uses\.memory"/);
  });
});

describe("AI-06 — the failure card branches, and only offers Retry when retrying can work", () => {
  it("copy and affordances come from the classifier", () => {
    expect(coach).toMatch(/import \{ browserOnline, classifyAiFailure, type AiFailureCopy \}/);
    expect(coach).toMatch(/const failureCopy: AiFailureCopy \| null =/);
    expect(coach).toMatch(/t\(failureCopy\.titleKey\)/);
    expect(coach).toMatch(/t\(failureCopy\.bodyKey, failureCopy\.bodyParams\)/);
    expect(coach).toMatch(/failureCopy\.retryable && lastUserText/);
    expect(coach).toMatch(/failureCopy\.actionKey && failureCopy\.actionRoute/);
  });

  it("the voice path stops pretending a quota/consent refusal is a transport hiccup", () => {
    expect(coach).toMatch(/err instanceof ApiError && \(err\.status === 429 \|\| err\.status === 451\)/);
    expect(coach).toMatch(/setAiFailure\(classifyAiFailure\(err, \{[^)]*retryAfterSeconds: err\.retryAfterSeconds/);
  });

  it("NEGATIVE CONTROL — the pre-change card was one sentence and an unconditional Retry", () => {
    const preFix = `{apiError && !isChatLoading && (
      <p className="text-xs">{t("coach.error")}</p>
      {lastUserText && (<button onClick={() => handleChatSend(lastUserText)}>{t("coach.retry")}</button>)}
    )}`;
    expect(/failureCopy/.test(preFix)).toBe(false);
    expect(/retryable/.test(preFix)).toBe(false);
    // the single generic sentence no longer renders unconditionally
    expect(coach).not.toMatch(/\{t\("coach\.error"\)\}/);
  });
});

describe("AI-24 — offline is said out loud, before the send", () => {
  it("the surface tracks online state from the browser's own events", () => {
    expect(coach).toMatch(/useState\(\(\) => browserOnline\(\)\)/);
    expect(coach).toMatch(/addEventListener\("online"/);
    expect(coach).toMatch(/addEventListener\("offline"/);
    expect(coach).toMatch(/removeEventListener\("offline"/);
  });

  it("EVERY send entry point goes through ONE offline seam — typing is NOT blocked", () => {
    // The context's send is shadowed, so the composer button, Enter, the
    // follow-up chips, the fast-start scenarios and the council all inherit
    // the guard from a single place.
    expect(coach).toMatch(/handleChatSend: sendToCoach/);
    expect(coach).toMatch(/handleCouncilSend: convenceCouncil/);
    expect(coach).toMatch(/const handleChatSend = \(customPrompt\?: string, opts\?: \{ displayText\?: string \}\) => \{\s*if \(!online\) \{/);
    expect(coach).toMatch(/const handleCouncilSend = \(customPrompt\?: string\) => \{\s*if \(!online\) \{/);
    expect(coach).toMatch(/classifyAiFailure\(null, \{ online: false/);
    expect(coach).toMatch(/data-testid="coach-offline-note"/);
    expect(coach).toMatch(/elev\.aierrors\.offline\.composer/);
    // the textarea stays editable — only loading gates it
    expect(coach).toMatch(/disabled=\{isChatLoading\}\s*\n\s*rows=\{2\}/);
  });

  it("the send button's opening element stays byte-identical to the frozen white-label case", () => {
    // lib/whiteLabelContrast.test.ts (CR-01) hashes the WHOLE opening element
    // of every unresolved fill — T.gradientCta here — so the offline gate had
    // to live in the handler, not in this element's `disabled`. Pinned so a
    // later edit shows up as a deliberate choice, not a surprise ratchet break.
    expect(coach).toMatch(/onClick=\{\(\) => handleChatSend\(\)\}\s*\n\s*disabled=\{isChatLoading \|\| !chatInput\.trim\(\)\}/);
  });

  it("NEGATIVE CONTROL — the pre-change surface had no offline seam at all", () => {
    const preFix = `const { handleChatSend, handleCouncilSend } = useArbor();
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}`;
    expect(/sendToCoach/.test(preFix)).toBe(false);
    expect(/online: false/.test(preFix)).toBe(false);
    expect(/coach-offline-note/.test(preFix)).toBe(false);
  });
});

describe("AI-23 — the day-0 hero never claims memory it does not have", () => {
  it("the hero line is count-aware across 0 / 1 / n", () => {
    expect(coach).toMatch(/approvedMemoryItems\.length === 0/);
    expect(coach).toMatch(/elev\.aihonesty\.memory\.none/);
    expect(coach).toMatch(/elev\.aihonesty\.memory\.one/);
    expect(coach).toMatch(/elev\.aihonesty\.memory\.some/);
  });

  it("NEGATIVE CONTROL — the pre-change hero asserted memory use unconditionally", () => {
    const preFix = `<p>{t("coach.empty.sub", { name: childFirst })}</p>`;
    expect(/approvedMemoryItems\.length === 0/.test(preFix)).toBe(false);
    expect(/elev\.aihonesty\.memory\.none/.test(preFix)).toBe(false);
  });

  it("and the same rule holds in the disclosure panel (GP-14 reuses it)", () => {
    const disclosure = read("lib/coachDisclosure.ts");
    expect(disclosure).toMatch(/elev\.memdisc\.facts\.none/);
  });
});

describe("AI-06 — Arbor Vision stops speaking the server's English at the parent", () => {
  const vision = stripComments(read("components/coach/ArborVision.tsx"));

  it("the vision failure is classified, not echoed", () => {
    expect(vision).toMatch(/classifyAiFailure\(e, \{/);
    expect(vision).toMatch(/retryAfterSeconds: e instanceof ApiError \? e\.retryAfterSeconds : undefined/);
    expect(vision).toMatch(/data-testid="vision-failure"/);
    expect(vision).toMatch(/t\(failure\.bodyKey, failure\.bodyParams\)/);
    expect(vision).toMatch(/failure\.retryable && \(/);
  });

  it("NEGATIVE CONTROL — the pre-change catch rendered e.message verbatim", () => {
    const preFix = `} catch (e: any) {
      setError(e?.message || t("vis.analyzeError"));
    }`;
    expect(/classifyAiFailure/.test(preFix)).toBe(false);
    expect(/setError\(e\?\.message/.test(preFix)).toBe(true);
    // …and that shape no longer exists on the live surface.
    expect(vision).not.toMatch(/setError\(e\?\.message/);
  });

  it("/api/vision is exactly the endpoint that can answer BOTH 429 and 451", () => {
    // The server gate: requireConsent(consentStore, "face_processing", …) →
    // 451 fail-closed; the shared AI quota → 429. One surface, two opposite
    // problems, which is why the classifier exists.
    const routes = read("routes/api.ts");
    expect(routes).toMatch(/router\.post\("\/vision", requireConsent\(consentStore, "face_processing"/);
  });
});
