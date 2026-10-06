/**
 * B-INF-10 — the ONE child-age formatter for the places a parent reads her
 * child's age next to the name: the switcher, Today's identity line, the
 * Shell identity line (B-SHELL-38), Profile and the Consult packet.
 *
 * Under three years the age prints in months ("22 months" / "22 חודשים");
 * from three, whole years ("5 years" / "5 שנים"). It is the child's OWN
 * chronological age — a preterm correction chooses content (lib/age/forChild)
 * but never changes the age a parent reads.
 *
 * Keys are the existing plural keys (`age.month1` / `age.months` /
 * `age.years`), so EN + HE already exist in lib/i18n.ts.
 */
import { ageMonthsFromProfile, type ChildAgeProfile } from "../childAge";

export type AgeT = (key: string, vars?: Record<string, number>) => string;

/** Months under which the age prints in months. */
export const MONTHS_DISPLAY_UNDER = 36;

function fallback(key: string, vars?: Record<string, number>): string {
  const n = vars?.n ?? 0;
  if (key === "age.month1") return "1 month";
  if (key === "age.months") return `${n} months`;
  if (key === "age.years") return `${n} years`;
  return key;
}

/** A known months value → "22 months" · "1 month" · "5 years". */
export function formatAgeMonths(totalMonths: number, t?: AgeT): string {
  const months = Math.max(0, Math.floor(Number.isFinite(totalMonths) ? totalMonths : 0));
  const tr = t ?? fallback;
  if (months < MONTHS_DISPLAY_UNDER) return months === 1 ? tr("age.month1") : tr("age.months", { n: months });
  return tr("age.years", { n: Math.floor(months / 12) });
}

/** The child's age for display, or "" when the profile carries no age. */
export function formatChildAge(profile: ChildAgeProfile | null | undefined, t?: AgeT, now?: Date): string {
  if (!profile) return "";
  const months = ageMonthsFromProfile(profile, now);
  return months === null ? "" : formatAgeMonths(months, t);
}
