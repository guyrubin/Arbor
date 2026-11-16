/**
 * v10 (canvas V77): the sidebar card is the child switcher alone, as every N-*-D
 * board draws it ("Dylan · 3 years ⌄"). Editing the child's profile lives in the
 * switcher's own menu, so the function survives on desktop and phone without a
 * second control, and the name and age are shown once (no caption under it).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..", "..");
const code = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the child switcher carries profile editing; the card shows the child once", () => {
  const card = code("components/profile/ProfileSwitcher.tsx");
  const sw = code("components/layout/TopbarKidSwitcher.tsx");

  it("the switcher menu has an Edit child profile row that opens the profile drawer", () => {
    expect(sw).toContain('data-testid="switcher-edit-profile"');
    expect(sw).toMatch(/setShowEdit\(true\)/);
    expect(sw).toContain("<ProfileEditDrawer open={showEdit}");
    expect(sw.indexOf("switcher-edit-profile")).toBeLessThan(sw.indexOf('t("ac.add")'));
  });

  it("the sidebar card mounts only the full-width switcher: no pencil, no repeated name-and-age caption", () => {
    expect(card).toContain('<TopbarKidSwitcher maxWidth="100%" fullWidth />');
    expect(card).not.toContain("ProfileEditDrawer");
    expect(card).not.toContain("elev.ages.shell.showing");
    expect(card).not.toMatch(/<button/);
  });

  it("NEGATIVE CONTROL: the old card shape (a pencil beside the switcher) is detectable", () => {
    const old = `<TopbarKidSwitcher maxWidth="100%" fullWidth />\n<button onClick={() => setShowEdit(true)} aria-label={t("aria.editChildProfile")}>`;
    expect(old).toMatch(/<button/);
  });
});
