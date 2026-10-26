import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18n";
import { choiceSelected, toggleDelimitedChoice } from "../../lib/profileChoiceLines";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fields = readFileSync(path.join(dir, "AddChildFields.tsx"), "utf8");
const drawer = readFileSync(path.join(dir, "ProfileEditDrawer.tsx"), "utf8");
const modal = readFileSync(path.join(dir, "AddChildModal.tsx"), "utf8");

describe("14 Oct user feedback — Add Child / Edit Child choice parity", () => {
  it("reuses Add Child's seven focus values and six language values, not another taxonomy", () => {
    expect(fields).toContain("export const DOMAINS:");
    expect(fields).toContain("export const CHILD_LANGUAGES =");
    expect(drawer).toContain('import { CHILD_LANGUAGES, DOMAINS } from "./AddChildFields"');
    expect(drawer).toContain("DOMAINS.map((domain)");
    expect(drawer).toContain("CHILD_LANGUAGES.map((language)");
    expect(modal).toContain('import { StepChild, StepDomains, DOMAINS } from "./AddChildFields"');
  });

  it("reopens EN choices in a HE session without silently migrating saved text", () => {
    const key = "ob.step.domains.sleep";
    const original = `${en[key]}\nNeeds quiet time`;
    const aliases = [en[key], he[key]];
    expect(choiceSelected(original, aliases, "\n")).toBe(true);
    expect(original).toBe(`${en[key]}\nNeeds quiet time`);
    expect(toggleDelimitedChoice(original, aliases, he[key], "\n")).toBe("Needs quiet time");
  });

  it("adds a translated focus once and preserves unrelated legacy challenges", () => {
    const key = "ob.step.domains.feelings";
    const labels = [en[key], he[key]];
    const original = "Loud school bus\nNeeds gentle transitions";
    const added = toggleDelimitedChoice(original, labels, he[key], "\n");
    expect(added).toBe(`${original}\n${he[key]}`);
    expect(choiceSelected(added, labels, "\n")).toBe(true);
    expect(toggleDelimitedChoice(added, labels, en[key], "\n")).toBe(original);
  });

  it("toggling built-in languages does not remove custom ones", () => {
    const initial = "English, Deutsch";
    const withHebrew = toggleDelimitedChoice(initial, ["Hebrew"], "Hebrew", ",");
    expect(withHebrew).toBe("English, Deutsch, Hebrew");
    expect(choiceSelected(withHebrew, ["Hebrew"], ",")).toBe(true);
    expect(toggleDelimitedChoice(withHebrew, ["Hebrew"], "Hebrew", ",")).toBe(initial);
  });

  it("does not write to avatar/age/delete paths or remove custom fields", () => {
    expect(drawer).toContain("avatar: avatarMeta ?? undefined");
    expect(drawer).toContain("agePatchFromMonths(ageMonths)");
    expect(drawer).toContain('challenges: challenges.split("\\n").map((s) => s.trim()).filter(Boolean)');
    expect(drawer).toContain("sanitizeInterestToken");
    expect(drawer).toContain('data-testid="profile-focus-choices"');
  });
});
