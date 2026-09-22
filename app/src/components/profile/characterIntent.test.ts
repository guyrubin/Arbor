/**
 * M4 / UX26-29 — the character picker (kids gauntlet, 22 Sep 2026).
 *
 * Astra's secondary finding: the picker had no way back to "no character", and
 * its strings were English literals. Both are pinned here — the transitions as
 * pure logic, the markup contract as a source scan (the creator is a portalled
 * dialog; this suite is node-environment, the house pattern).
 *
 * The load-bearing acceptance line: switching or clearing an option drops the
 * stale PREVIEW and never the SAVED avatar. AvatarCreator emits onCreated from
 * exactly one place — `use()`, behind isAvatarDraftCurrent — so the picker
 * cannot touch what is already on the child.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHARACTER_CHOICES, isCharacterSelected, nextChoiceIndex, selectCharacter } from "./characterIntent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creator = readFileSync(path.join(__dirname, "AvatarCreator.tsx"), "utf8");

describe("selectCharacter — the clear control", () => {
  it("returns the draft to NO intent", () => {
    expect(selectCharacter({ preset: "princess" }, "none")).toBeUndefined();
    expect(selectCharacter(undefined, "none")).toBeUndefined();
  });

  it("clearing also drops the custom text", () => {
    const cleared = selectCharacter({ preset: "custom", customIdea: "a dragon who bakes" }, "none");
    expect(cleared).toBeUndefined();
    // …and re-entering custom starts empty rather than resurrecting it.
    expect(selectCharacter(cleared, "custom")).toEqual({ preset: "custom", customIdea: "" });
  });

  it("custom text SURVIVES re-picking custom (UX26-29: survives edits)", () => {
    const current = { preset: "custom" as const, customIdea: "a stargazer" };
    expect(selectCharacter(current, "custom")).toEqual({ preset: "custom", customIdea: "a stargazer" });
  });

  it("moving from custom to a preset drops text that is not that preset's idea", () => {
    expect(selectCharacter({ preset: "custom", customIdea: "a baker" }, "explorer")).toEqual({ preset: "explorer" });
  });

  it("every preset is reachable and round-trips", () => {
    for (const choice of ["princess", "superhero", "explorer"] as const) {
      expect(selectCharacter({ preset: "custom", customIdea: "x" }, choice)).toEqual({ preset: choice });
    }
  });
});

describe("isCharacterSelected — one option is always checked", () => {
  it("'none' is checked exactly when nothing is chosen", () => {
    expect(isCharacterSelected(undefined, "none")).toBe(true);
    expect(isCharacterSelected({ preset: "princess" }, "none")).toBe(false);
  });

  it("exactly one option is checked in every state", () => {
    for (const state of [undefined, { preset: "princess" as const }, { preset: "custom" as const, customIdea: "x" }]) {
      const checked = CHARACTER_CHOICES.filter((c) => isCharacterSelected(state, c));
      expect(checked).toHaveLength(1);
    }
  });
});

describe("nextChoiceIndex — WAI-ARIA radiogroup keys", () => {
  it("arrows move and wrap", () => {
    expect(nextChoiceIndex(0, "ArrowRight", 5)).toBe(1);
    expect(nextChoiceIndex(4, "ArrowDown", 5)).toBe(0);
    expect(nextChoiceIndex(0, "ArrowLeft", 5)).toBe(4);
    expect(nextChoiceIndex(0, "ArrowUp", 5)).toBe(4);
  });

  it("horizontal arrows follow the READER's direction in Hebrew", () => {
    expect(nextChoiceIndex(0, "ArrowLeft", 5, true)).toBe(1);
    expect(nextChoiceIndex(1, "ArrowRight", 5, true)).toBe(0);
    // Vertical arrows are direction-neutral.
    expect(nextChoiceIndex(0, "ArrowDown", 5, true)).toBe(1);
  });

  it("Home/End jump to the ends; anything else is not ours", () => {
    expect(nextChoiceIndex(3, "Home", 5)).toBe(0);
    expect(nextChoiceIndex(0, "End", 5)).toBe(4);
    expect(nextChoiceIndex(0, "Tab", 5)).toBeNull();
    expect(nextChoiceIndex(0, "Enter", 5)).toBeNull();
  });
});

describe("AvatarCreator — the picker's markup contract", () => {
  it("is a real radiogroup with a visible clear option", () => {
    expect(creator).toContain('role="radiogroup"');
    expect(creator).toContain('role="radio"');
    expect(creator).toContain("aria-checked={selected}");
    expect(creator).toContain('{ id: "none", labelKey: "elev.hero.character.none"');
    expect(creator).toContain('data-testid={`avatar-character-${id}`}');
  });

  it("keyboard semantics: roving tabindex + arrow handling", () => {
    expect(creator).toContain("tabIndex={selected ? 0 : -1}");
    expect(creator).toContain("nextChoiceIndex(index, event.key, CHARACTER_CHOICES.length, uiLang === \"he\")");
    expect(creator).toContain("characterRefs.current[next]?.focus()");
    // Arrow-navigating onto "My own idea" must not drop focus into the text
    // field mid-navigation; a pointer choice still autofocuses it.
    expect(creator).toContain("autoFocus={!keyboardChoiceRef.current}");
  });

  it("targets clear the 44 px floor at 320/390 in two columns", () => {
    expect(creator).toContain("grid grid-cols-2 gap-2");
    expect(creator).toContain("min-h-[56px]");
    // The mode + style rows in the same dialog were 32 px tall.
    expect(creator).toContain("py-2.5 min-h-11 rounded-xl text-xs font-bold");
    expect(creator).toContain("py-2 min-h-11 rounded-xl text-[11px] font-bold");
  });

  it("every picker string goes through the i18n registry (no English literals)", () => {
    for (const key of [
      "elev.hero.character.legend",
      "elev.hero.character.group",
      "elev.hero.character.customLabel",
      "elev.hero.character.customPlaceholder",
      "elev.hero.style.legend",
      "elev.hero.mode.describe",
      "elev.hero.cta.use",
    ]) {
      expect(creator, `${key} must be used by the creator`).toContain(`"${key}"`);
    }
    expect(creator).not.toContain('label: "Princess"');
    expect(creator).not.toContain('placeholder="A baker');
    expect(creator).not.toContain("Use this avatar");
  });

  it("choosing an option clears the stale preview and leaves the SAVED avatar alone", () => {
    // One transition for click and keyboard…
    expect(creator).toMatch(/const chooseCharacter = \(choice: CharacterChoice\) => \{[\s\S]*?setCharacter\(\(current\) => selectCharacter\(current, choice\)\);[\s\S]*?setResult\(undefined\);/);
    // …which bumps the request id, so an in-flight generation cannot land on it.
    expect(creator).toMatch(/const chooseCharacter[\s\S]{0,200}draftRequestRef\.current \+= 1;/);
    // onCreated is emitted from exactly ONE place: use(), behind the snapshot
    // guard. Cancel/close therefore writes nothing.
    expect(creator.match(/onCreated\(/g) ?? []).toHaveLength(1);
    expect(creator).toMatch(/if \(!isAvatarDraftCurrent\(draft, \{ childId, requestId: draftRequestRef\.current, open \}\)\) return;\s*\n\s*onCreated\(/);
  });

  it("AV-05 request-snapshot binding survives the new async bound", () => {
    expect(creator).toContain("const dataUrl = await shrinkDataUrlToBudget(draft.dataUrl);");
    // Guarded BEFORE the await and again AFTER it.
    expect(creator).toMatch(/if \(!isAvatarDraftCurrent\(result, \{ childId, requestId: draftRequestRef\.current, open \}\)\) return;[\s\S]*?await shrinkDataUrlToBudget/);
  });
});
