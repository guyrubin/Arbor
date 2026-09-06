/**
 * heroJourneyKidFailure.test.ts — OBJ-KID-04 guard.
 *
 * A tap that does nothing is the worst thing a kid surface can do. Two AI-backed
 * starts failed SILENTLY inside Kid Mode:
 *
 *   HeroJourneyTab "Play"      → api.generateHeroJourney rejects → toast(msg,
 *     "error") → ToastContext QUEUES while kid-locked (context/ToastContext.tsx
 *     "KID-LOCK (W0.9, LEAK 4)") → nothing renders. Observed 390 HE seeded: card
 *     text unchanged at +0.6 s and +4.6 s, no [role=status] anywhere.
 *   AdventuresTab "Create"     → the failure rendered the PARENT error string.
 *
 * The fix branches at the CALL SITE (`isKidModeActive()`), never in
 * ToastContext — the parent shell still needs the queue. This file pins both
 * call sites and the two kid lines, with the pre-fix code as an executable
 * negative control.
 *
 * Static, not rendered: this repo has no jsdom or @testing-library (see
 * package.json devDependencies), so the render half of the acceptance
 * ("a MascotSay [role=status] inside .arbor-play within 1 s, no toast node") is
 * the orchestrator's sandbox pass. What is provable here is the branch, the
 * copy and the absence of an unconditional toast — the three things that
 * regress.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as kidEn, he as kidHe } from "../../lib/i18nElevation/kidRegister";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const hero = read("components/tabs/HeroJourneyTab.tsx");
const adventures = read("components/practice/AdventuresTab.tsx");

/** The `catch` body of a named async handler — where the failure is decided. */
function catchBody(src: string, handler: string): string {
  const from = src.indexOf(handler);
  expect(from, `${handler} not found`).toBeGreaterThan(-1);
  const catchIdx = src.indexOf("} catch", from);
  expect(catchIdx, `${handler} has no catch`).toBeGreaterThan(-1);
  return src.slice(catchIdx, src.indexOf("} finally", catchIdx) + 1 || src.indexOf("\n  };", catchIdx));
}

describe("OBJ-KID-04 — the Hero Story Play failure answers the child", () => {
  const body = catchBody(hero, "const startJourney = async");

  it("routes the kid path to a kid-register state, and only the parent path to toast", () => {
    expect(body).toContain("if (kidMode) setStoryResting(true);");
    expect(body).toContain("else toast(msg,");
    // The toast call is REACHABLE only through the else — never on its own line.
    expect(body).not.toMatch(/^\s*toast\(/m);
  });

  it("reads Kid Mode from the gate, not from a prop or a guess", () => {
    expect(hero).toContain('import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";');
    expect(hero).toContain("useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive)");
  });

  it("renders the kid line as an announced MascotSay inside the play surface", () => {
    expect(hero).toMatch(/storyResting && \(\s*\n\s*<div role="status" aria-live="polite"/);
    expect(hero).toContain('<MascotSay mood="think" tone="yellow">{t("elev.play.hero.rest")}</MascotSay>');
    // The catalog view it sits in is the `.arbor-play` branch.
    expect(hero).toContain('className="arbor-play space-y-6"');
  });

  it("a retry is possible: the state resets on the next start and the card leaves loading", () => {
    const start = hero.slice(hero.indexOf("const startJourney = async"));
    expect(start.slice(0, start.indexOf("try {"))).toContain("setStoryResting(false);");
    expect(start).toContain("setLoadingId(null);");
  });

  it("negative control — the pre-fix catch (unconditional toast, no kid state) fails these rules", () => {
    const preFix = [
      "} catch (e) {",
      '  const msg = e instanceof Error ? e.message : "Failed to start the journey.";',
      '  toast(msg, "error");',
      "} finally {",
    ].join("\n");
    expect(preFix).not.toContain("if (kidMode) setStoryResting(true);");
    expect(preFix).toMatch(/^\s*toast\(/m);
  });
});

describe("OBJ-KID-04 — the Story Quest Create failure answers the child", () => {
  it("branches the generate error on Kid Mode and keeps the parent string for the parent", () => {
    expect(adventures).toContain("const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);");
    expect(adventures).toMatch(/\{genError &&\s*\n\s*\(kidMode \? \(/);
    expect(adventures).toContain('<MascotSay mood="think" tone="yellow">{t("elev.play.adventures.napping")}</MascotSay>');
    expect(adventures).toContain('<div role="status" aria-live="polite" className="w-full">');
    // …and the parent branch still prints the real, actionable message.
    expect(adventures).toContain("{genError}</p>");
  });

  it("negative control — the pre-fix single-branch error line has no kid path", () => {
    const preFix = '{genError && <p className="w-full text-[13px] font-semibold">{genError}</p>}';
    expect(preFix).not.toContain("kidMode");
    expect(/\{genError &&\s*\n\s*\(kidMode \? \(/.test(preFix)).toBe(false);
  });
});

describe("OBJ-KID-04 — the two failure lines are kid register in both locales", () => {
  const KEYS = ["elev.play.hero.rest", "elev.play.adventures.napping"];
  /** Adult words a failure line must never carry in front of a child. */
  const ADULT = /\b(?:AI|error|quota|retry|try again later|server|network|generate[ds]?|failed)\b/i;

  it.each(KEYS)("%s exists in EN and HE and names no machinery", (key) => {
    for (const [label, dict] of [["en", kidEn], ["he", kidHe]] as const) {
      const v = dict[key];
      expect(v, `${label} missing ${key}`).toBeTruthy();
      expect(ADULT.test(v), `${label} ${key} names machinery: ${v}`).toBe(false);
      expect(v).not.toContain("%");
    }
  });

  it("the HE lines are transcreated Hebrew, not EN placeholders", () => {
    for (const key of KEYS) expect(kidHe[key]).toMatch(/[\u0590-\u05FF]/);
  });

  it("negative control — the parent fallback string would fail the same rule", () => {
    expect(ADULT.test("Failed to start the journey.")).toBe(true);
  });
});

describe("OBJ-KID-04 — the fix is at the call site; ToastContext is untouched", () => {
  it("ToastContext still queues every toast while kid-locked", () => {
    const toastCtx = read("context/ToastContext.tsx");
    expect(toastCtx).toContain("const [kidLocked, setKidLocked] = useState(isKidModeActive);");
    expect(toastCtx).toContain("queueRef");
  });
});
