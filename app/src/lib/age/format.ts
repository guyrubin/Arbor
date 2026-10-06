/**
 * B-INF-10 — the ONE child-age formatter.
 *
 * THE RULE (decided 6 Oct, the pack's B-INF-10 text):
 *   · under 36 months → "N months" / "N חודשים" ("1 month" / "חודש אחד"),
 *     everywhere the age is printed;
 *   · 36 months and over → whole years, "N years" / "N שנים";
 *     the months are added ("3 years 4 months") ONLY when the caller passes
 *     `{ precise: true }` — the documents a clinician reads (the visit packet
 *     and the sharing preview built from it). The switcher, Today's header,
 *     the Shell identity line and Profile's identity line never pass it.
 *
 * It is the child's OWN chronological age — a preterm correction chooses
 * content (lib/age/forChild) but never changes the age a parent reads.
 *
 * Keys are the existing plural keys in lib/i18n.ts (`age.month1` /
 * `age.months` / `age.years` / `age.yearsMonth1` / `age.yearsMonths`), EN + HE.
 */
import { ageMonthsFromProfile, type ChildAgeProfile } from "../childAge";

export type AgeT = (key: string, vars?: Record<string, number>) => string;
export type AgeFormatOptions = { precise?: boolean };

/** Months under which the age prints in months. */
export const MONTHS_DISPLAY_UNDER = 36;

function fallback(key: string, vars?: Record<string, number>): string {
  const n = vars?.n ?? 0;
  const m = vars?.m ?? 0;
  if (key === "age.month1") return "1 month";
  if (key === "age.months") return `${n} months`;
  if (key === "age.years") return `${n} years`;
  if (key === "age.yearsMonth1") return `${n} years 1 month`;
  if (key === "age.yearsMonths") return `${n} years ${m} months`;
  return key;
}

/** A known months value → "22 months" · "1 month" · "5 years" (precise: "3 years 4 months"). */
export function formatAgeMonths(totalMonths: number, t?: AgeT, opts: AgeFormatOptions = {}): string {
  const months = Math.max(0, Math.floor(Number.isFinite(totalMonths) ? totalMonths : 0));
  const tr = t ?? fallback;
  if (months < MONTHS_DISPLAY_UNDER) return months === 1 ? tr("age.month1") : tr("age.months", { n: months });
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!opts.precise || rest === 0) return tr("age.years", { n: years });
  return rest === 1 ? tr("age.yearsMonth1", { n: years }) : tr("age.yearsMonths", { n: years, m: rest });
}

/** The child's age for display, or "" when the profile carries no age. */
export function formatChildAge(
  profile: ChildAgeProfile | null | undefined,
  t?: AgeT,
  now?: Date,
  opts: AgeFormatOptions = {},
): string {
  if (!profile) return "";
  const months = ageMonthsFromProfile(profile, now);
  return months === null ? "" : formatAgeMonths(months, t, opts);
}
