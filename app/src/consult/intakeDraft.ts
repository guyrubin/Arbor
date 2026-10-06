/**
 * B-LOOP-12 — the parent's questions for one professional, typed in the
 * professional view's packet ("Your questions"). Saved to the packet ONLY:
 * a device-local draft per child per profession that the intake packet reads
 * (consult/packet buildIntakePacket `questions`) on the professional view and
 * at the consult step-3 egress. Never written to the record, never sent
 * anywhere except inside a packet the parent reviews and sends.
 */
import type { IntakeProfession } from "./packet";

export const intakeQuestionsKey = (childId: string, p: IntakeProfession): string => `arbor.intakeQuestions.${childId}.${p}`;

/** The draft as typed (one question per line). */
export function readIntakeQuestionsText(childId: string, p: IntakeProfession): string {
  try {
    return localStorage.getItem(intakeQuestionsKey(childId, p)) ?? "";
  } catch {
    return "";
  }
}

export function writeIntakeQuestionsText(childId: string, p: IntakeProfession, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(intakeQuestionsKey(childId, p), text.slice(0, 2000));
    else localStorage.removeItem(intakeQuestionsKey(childId, p));
  } catch {
    /* storage unavailable: the box still works for this view */
  }
}

/** The draft as packet lines (blank lines dropped). */
export const intakeQuestionLines = (text: string): string[] => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
