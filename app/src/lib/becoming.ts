// "Aim at the highest good" — connect the Family Charter (the values a family is
// forming around) to the child's hero journey, so stories that build the family's
// chosen virtues surface first and the aim is visible. Pure, dependency-free.
import type { DevelopmentMetricId } from "../types";
// The charter's storage key has ONE owner (lib/familyCharter.ts). It used to be
// spelled here as a second literal, which is how the writer and the readers were
// free to disagree about shape. Importing the constant keeps this module pure —
// it is a string, not a dependency on React, storage or the network.
import { FAMILY_CHARTER_KEY } from "./familyCharter";

const CHARTER_KEY = FAMILY_CHARTER_KEY;

/** The family's chosen values (free text), as set in Family Formation. */
export const loadCharter = (): string[] => {
  try {
    const raw = localStorage.getItem(CHARTER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

// Map a free-text family value to the development virtue it expresses.
const VALUE_VIRTUE: { match: RegExp; metric: DevelopmentMetricId }[] = [
  { match: /courage|brave|bold|fearless/i, metric: "courage" },
  { match: /honest|truth|integrity|sincer/i, metric: "truth" },
  { match: /responsib|duty|reliab|account|diligen/i, metric: "responsibility" },
  { match: /wis(dom|e)|thoughtful|judg|fair|discern/i, metric: "wisdom" },
  { match: /resilien|grit|persever|persist|patien|strength|hope/i, metric: "resilience" },
  { match: /kind|empath|compassion|care|gentle|love|generous/i, metric: "empathy" },
];

export const valueToVirtue = (value: string): DevelopmentMetricId | null =>
  VALUE_VIRTUE.find((v) => v.match.test(value))?.metric ?? null;

/** The distinct virtues a family's charter aims at (order preserved). */
export const aimVirtues = (values: string[]): DevelopmentMetricId[] => {
  const out: DevelopmentMetricId[] = [];
  for (const v of values) {
    const m = valueToVirtue(v);
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
};
