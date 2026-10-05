/**
 * B-KID-44 (KA-11) — the entry seam also covers the AskSpecialist door.
 * Consult's "At home while you wait" opens a world through
 * openHomePracticeWorld(w, { setActiveTab, openKidMode }). That `openKidMode`
 * is passed as a VALUE, so the call-site grep in kidModeEntry.seam.test.ts
 * (`openKidMode(` only in the seam) cannot see a regression that hands it the
 * raw context opener. This pins the value's source: the seam's `request`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const ask = readFileSync(path.join(SRC, "components/sections/AskSpecialist.tsx"), "utf8");
const home = readFileSync(path.join(SRC, "consult/homePractice.ts"), "utf8");

describe("B-KID-44: Consult's home-practice door goes through the ONE seam", () => {
  it("AskSpecialist's openKidMode IS the seam's request (hero-first, then the named world)", () => {
    expect(ask).toContain("const { request: openKidMode, step: kidModeStep } = useKidModeEntry();");
    expect(ask).toContain("openHomePracticeWorld(w, { setActiveTab, openKidMode })");
    expect(ask).toContain("{kidModeStep}");
    expect(ask).not.toMatch(/\buseKidMode\(\)/);
    expect(ask).not.toMatch(/import \{[^}]*\buseKidMode\b[^}]*\} from "[^"]*KidModeContext"/);
  });
  it("the helper opens Kid Mode ON the world (view arcade + worldId)", () => {
    expect(home).toContain('seams.openKidMode({ view: "arcade", worldId: world.id });');
  });
  it("NEGATIVE CONTROL: a raw context opener passed as the value is what this pin rejects", () => {
    const preFix = 'const { openKidMode } = useKidMode();\nopenHomePracticeWorld(w, { setActiveTab, openKidMode })';
    expect(preFix).toMatch(/\buseKidMode\(\)/);
  });
});
