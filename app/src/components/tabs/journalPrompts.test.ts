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
    expect(src).toContain("dailyPromptKeys({ ageYears: ageYearsOf(childProfile), childId: childProfile.id");
  });

  // W2-ASKJB critic r1 (journal P1 G1, lane-ASKJB.md:324): the capture triad
  // is the primary move and must sit above the fold at 375, so it now leads
  // and the chips follow it as one snap row (the cue still renders above the
  // compose card). Order flipped deliberately; this pins the new order.
  it("renders the capture triad (MODE_TILES) ABOVE the chips", () => {
    const chips = src.indexOf('data-testid="journal-prompt-chips"');
    const tiles = src.indexOf("{MODE_TILES.map(");
    expect(chips).toBeGreaterThan(-1);
    expect(tiles).toBeGreaterThan(-1);
    expect(tiles).toBeLessThan(chips);
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
    // B-TODAY-19 (07fea27) moved capture IN PLACE: the Journal opens the ONE
    // capture sheet itself (no requestCapture hand-off to Behaviors), and the
    // tapped prompt rides in as the sheet's visible cue — its KEY, stored on
    // the log as promptKey — never as draft text.
    expect(src).toMatch(
      /const startCapture = \(mode: CaptureMode\) => \{\s*setQuickLogMode\(mode\);\s*setQuickLogPromptKey\(activePromptKey\);\s*setQuickLogOpen\(true\);/,
    );
    expect(src).toContain("<QuickLogModal open={quickLogOpen} mode={quickLogMode} promptKey={quickLogPromptKey}");
    expect(src).not.toMatch(/requestCapture\(/);
    // The prompt TEXT must never flow into the sheet (only the key, as a cue).
    expect(src).not.toMatch(/setQuickLogPromptKey\(t\(|promptKey=\{t\(|initialText=|defaultText=/);
  });

  it("tracks journal_prompt_tap with the child's band", () => {
    expect(src).toContain('track("journal_prompt_tap", { band: bandForAge(ageYearsOf(childProfile)) })');
  });
});
