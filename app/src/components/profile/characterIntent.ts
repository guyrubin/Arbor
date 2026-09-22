/**
 * characterIntent — the character picker's state transitions, extracted from
 * AvatarCreator so they are testable without a DOM (UX26-29, M4).
 *
 * Astra's secondary finding on the kids run: once a character was chosen there
 * was no way back to "no character". The picker is now a real radiogroup with a
 * "none" option, and `selectCharacter` is the single transition both the click
 * handler and the keyboard handler go through.
 *
 * Invariants:
 *  - choosing "none" returns UNDEFINED intent and drops any custom text with it;
 *  - re-choosing "custom" keeps the text already typed (it survives edits);
 *  - moving from custom to a preset drops the text (it is not that preset's idea).
 * None of these touch the SAVED avatar: AvatarCreator emits onCreated only from
 * `use()`, behind isAvatarDraftCurrent.
 */

import type { AvatarCharacterIntent, AvatarCharacterPreset } from "../../lib/api";

/** The picker's options: the four presets plus the explicit clear. */
export type CharacterChoice = AvatarCharacterPreset | "none";

export const CHARACTER_CHOICES: readonly CharacterChoice[] = ["princess", "superhero", "explorer", "custom", "none"];

/** The transition. Pure — no draft/preview side effects live here. */
export function selectCharacter(
  current: AvatarCharacterIntent | undefined,
  choice: CharacterChoice,
): AvatarCharacterIntent | undefined {
  if (choice === "none") return undefined;
  if (choice === "custom") {
    return { preset: "custom", customIdea: current?.preset === "custom" ? (current.customIdea ?? "") : "" };
  }
  return { preset: choice };
}

/** Which radio reads as checked — "none" is checked exactly when nothing is. */
export function isCharacterSelected(
  current: AvatarCharacterIntent | undefined,
  choice: CharacterChoice,
): boolean {
  return choice === "none" ? current === undefined : current?.preset === choice;
}

/**
 * Keyboard semantics for a radiogroup (WAI-ARIA): arrows move the selection and
 * wrap; Home/End jump to the ends. Direction is the READER's — in Hebrew the
 * visual start is the right edge, so the horizontal arrows swap.
 */
export function nextChoiceIndex(index: number, key: string, count: number, rtl = false): number | null {
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const backward = rtl ? "ArrowRight" : "ArrowLeft";
  if (key === "ArrowDown" || key === forward) return (index + 1) % count;
  if (key === "ArrowUp" || key === backward) return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
