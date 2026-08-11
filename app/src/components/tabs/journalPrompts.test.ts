import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * W2 masterplan 2.6 — Journal prompts mount scan (Maytal's empty-journal ask).
 *
 * JournalTab mounts 3 rotating promptBank guiding questions as tappable chips
 * ABOVE the capture triad, reusing the SAME deterministic rotation +
 * elev.prompt.* strings PromptCaptureCard mounts on Today (W1). Tap = the
 * question becomes a visible writing cue — the sanctioned W1 pattern: the
 * question text is NEVER injected into the draft body.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(here, "./JournalTab.tsx"), "utf8");
const src = raw.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("W2 2.6 JournalTab prompt mount", () => {
  it("uses the shared promptBank rotation (same API as PromptCaptureCard's caller)", () => {
    expect(src).toContain('from "../../lib/promptBank"');
    expect(src).toContain("dailyPromptKeys({ ageYears: childProfile.age, childId: childProfile.id");
  });

  it("renders the chips ABOVE the capture triad (MODE_TILES)", () => {
    const chips = src.indexOf('data-testid="journal-prompt-chips"');
    const tiles = src.indexOf("{MODE_TILES.map(");
    expect(chips).toBeGreaterThan(-1);
    expect(tiles).toBeGreaterThan(-1);
    expect(chips).toBeLessThan(tiles);
  });

  it("chips resolve through t() with the registered elev.prompt.* strings", () => {
    // The rotation returns elev.prompt.<band>.<n> keys; the chip label is t(key)
    // and the row is introduced by the registered elev.prompt.lead string.
    expect(src).toContain('t("elev.prompt.lead")');
    expect(src).toMatch(/promptKeys\.map\(/);
    expect(src).toContain("{t(key)}");
  });

  it("tap shows the prompt as a writing cue and never injects it into the draft", () => {
    expect(src).toContain('data-testid="journal-prompt-cue"');
    expect(src).toContain("{t(activePromptKey)}");
    // The sanctioned pattern: capture opens exactly as before, mode-only.
    expect(src).toContain("requestCapture(mode)");
    // The prompt key/text must never flow into the capture call.
    expect(src).not.toMatch(/requestCapture\((?!mode\))/);
  });

  it("tracks journal_prompt_tap with the child's band", () => {
    expect(src).toContain('track("journal_prompt_tap", { band: bandForAge(childProfile.age) })');
  });
});
