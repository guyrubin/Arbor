/* ════════════════════════════════════════════════════════════════════════════
   promptBank.ts — E9 "journal that starts itself": guiding-question rotation.

   An authored bank of ~30 warm, specific guiding questions per developmental
   band (the playbank's PlayBand — the app's canonical coarse band), surfaced as
   3 chips/day above the Journal capture triad. The QUESTION TEXTS live in the
   i18n seam (src/lib/i18nElevation/journal.ts, keys "elev.prompt.<band>.<n>")
   so EN + HE render through t() like every other string; this module only
   selects WHICH keys show today.

   Rotation is DETERMINISTIC: seeded by the local calendar day + childId (no
   Date.now / Math.random). Same child, same day → same 3 questions on every
   render and device; siblings differ; tomorrow rotates. Pure functions only —
   unit-testable without React or context.

   CLINICAL FIREWALL: prompts are open invitations to notice, never assessments
   ("what funny word was said today?" — never "is your child saying N words?").
   ════════════════════════════════════════════════════════════════════════════ */
import { bandForAge, type PlayBand } from "../playbank/content";

/** Authored bank size per band — journal.ts must hold exactly this many per band. */
export const PROMPTS_PER_BAND = 30;

/** How many prompt chips the Journal composer shows per day. */
export const DAILY_PROMPT_COUNT = 3;

/** All bands with an authored prompt set (mirrors the playbank's PLAY_BANDS). */
export const PROMPT_BANDS: readonly PlayBand[] = ["infant", "toddler", "preschool", "early-school"];

/** i18n key for prompt #index (0-based) of a band → "elev.prompt.<band>.<n>" (1-based). */
export const promptKey = (band: PlayBand, index: number): string =>
  `elev.prompt.${band}.${index + 1}`;

/** Local calendar-day stamp ("2026-07-09") — the rotation flips at local midnight. */
export function localDayStamp(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** FNV-1a 32-bit hash — tiny, stable, dependency-free seed derivation. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Strides coprime with PROMPTS_PER_BAND (30) → 3 picks are always distinct. */
const STRIDES = [1, 7, 11, 13, 17, 19, 23, 29] as const;

/**
 * Today's 3 guiding-question i18n keys for a child — deterministic, distinct.
 * Derives everything from the PASSED date (never reads the clock itself).
 */
export function dailyPromptKeys(args: { ageYears: number; childId: string; date: Date }): string[] {
  const band = bandForAge(args.ageYears);
  const seed = fnv1a(`${args.childId}|${localDayStamp(args.date)}`);
  const start = seed % PROMPTS_PER_BAND;
  const stride = STRIDES[(seed >>> 8) % STRIDES.length];
  return Array.from({ length: DAILY_PROMPT_COUNT }, (_, k) =>
    promptKey(band, (start + k * stride) % PROMPTS_PER_BAND)
  );
}
