/* coachDisclosure — GP-14: "what the coach sees", said out loud.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * The Ask-Arbor data-contract panel reported a NUMBER: "Memory facts you
 * approved (3 used in the last answer)". A parent cannot check, correct or
 * withdraw a fact they are never shown, so the panel was asking for trust
 * while withholding the only thing that earns it. `ai/prompts.ts` has always
 * said, in the comment above MODEL_PROFILE_FIELDS, that the allow-list is
 * "meant to drive the … 'what Arbor uses' list … so the disclosure and the
 * wire cannot drift apart". This module is that drive.
 *
 * WHY THE FIELD LIST IS MIRRORED, NOT IMPORTED
 * ────────────────────────────────────────────
 * `ai/prompts.ts` → `contracts/coach.ts` → `@google/genai`. Importing it into
 * a React component would drag a server SDK into the browser bundle. So the
 * list is mirrored here and pinned by coachDisclosure.test.ts, which imports
 * the REAL `MODEL_PROFILE_FIELDS` + `promptProfile` (node test env, no bundle
 * cost) and fails the moment the two disagree — on the constant OR on which
 * fields a given profile actually projects to.
 *
 * CLINICAL FIREWALL
 * ─────────────────
 * This names (a) the parent's own approved fact text, verbatim, and (b) the
 * NAMES of the profile fields sent. Never a field's value, never a count
 * about the child, never a score, band or verdict. Naming a fact the parent
 * approved is disclosure; grading the child is not, and nothing here does it.
 *
 * Pure: no React, no I/O. The caller injects `t`, so copy stays translatable.
 */
import { ageMonthsFromProfile } from "./childAge";
import type { ChildProfile } from "../types";

/** MIRROR of ai/prompts.ts MODEL_PROFILE_FIELDS — pinned by the drift guard. */
export const DISCLOSED_PROFILE_FIELDS = [
  "name",
  "age",
  "ageLabel",
  "languages",
  "schoolContext",
  "strengths",
  "challenges",
  "activeGoals",
  "interests",
  "preterm",
  "gender",
] as const;

export type DisclosedProfileField = (typeof DISCLOSED_PROFILE_FIELDS)[number];

const hasStrings = (v: unknown): boolean =>
  Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim().length > 0);

const hasText = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

/**
 * Which allow-listed fields this profile actually carries — i.e. which ones
 * `promptProfile()` would emit. Mirrors its predicates field for field; the
 * drift guard proves the mirror, over fixtures, key set for key set.
 */
export function disclosedProfileFields(profile: unknown, now?: Date): DisclosedProfileField[] {
  if (!profile || typeof profile !== "object") return [];
  const p = profile as Partial<ChildProfile> & Record<string, unknown>;
  const out: DisclosedProfileField[] = [];
  if (hasText(p.name)) out.push("name");
  if (typeof p.age === "number" && Number.isFinite(p.age)) out.push("age");
  if (ageMonthsFromProfile(p as ChildProfile, now) !== null) out.push("ageLabel");
  if (hasStrings(p.languages)) out.push("languages");
  if (hasText(p.schoolContext)) out.push("schoolContext");
  if (hasStrings(p.strengths)) out.push("strengths");
  if (hasStrings(p.challenges)) out.push("challenges");
  if (
    Array.isArray(p.activeGoals) &&
    (p.activeGoals as unknown[]).some((g) => !!g && typeof g === "object" && hasText((g as { label?: unknown }).label))
  ) {
    out.push("activeGoals");
  }
  if (hasStrings(p.interests)) out.push("interests");
  const weeks = (p.preterm as { gestationalWeeks?: unknown } | undefined)?.gestationalWeeks;
  if (typeof weeks === "number" && Number.isFinite(weeks)) out.push("preterm");
  if (hasText(p.gender)) out.push("gender");
  return out;
}

/** One approved memory fact, as the parent approved it. */
export interface DisclosedFact {
  memoryId: string;
  fact: string;
}

export interface CoachDisclosureInput {
  profile: unknown;
  /** The parent's APPROVED memory ledger (components read it from context). */
  approvedFacts: readonly DisclosedFact[];
  /** Server-reported count of approved facts the last answer actually used. */
  factsUsedInLastAnswer?: number;
  childFirstName: string;
  /** How many facts to name inline before folding into "+N more". */
  nameLimit?: number;
  now?: Date;
}

export interface CoachDisclosure {
  /** Bullet strings for TrustPanel `uses`, already translated. */
  uses: string[];
  /** The field ids named, exposed for tests/telemetry — never rendered raw. */
  fields: DisclosedProfileField[];
  /** How many facts were named inline. */
  namedFactCount: number;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const DEFAULT_NAME_LIMIT = 4;

/**
 * Build the disclosure bullets. Deterministic for a given input + `t`.
 *
 * Ordering is deliberate: the profile line first (what Arbor knows anyway),
 * then the memory the parent granted — the facts are the sensitive half, so
 * they sit closest to the "you control this" group below them in the panel.
 */
export function coachDisclosure(input: CoachDisclosureInput, t: Translate): CoachDisclosure {
  const { profile, approvedFacts, factsUsedInLastAnswer, childFirstName, nameLimit = DEFAULT_NAME_LIMIT, now } = input;

  const fields = disclosedProfileFields(profile, now);
  const uses: string[] = [];

  uses.push(
    fields.length === 0
      ? t("elev.memdisc.profile.empty", { name: childFirstName })
      : t("elev.memdisc.profile.lead", {
          name: childFirstName,
          fields: fields.map((f) => t(`elev.memdisc.field.${f}`)).join(", "),
        }),
  );

  if (approvedFacts.length === 0) {
    // AI-23's rule, held here too: never imply memory use before a fact exists.
    uses.push(t("elev.memdisc.facts.none"));
    return { uses, fields, namedFactCount: 0 };
  }

  uses.push(t("elev.memdisc.facts.lead"));
  const named = approvedFacts.slice(0, Math.max(0, nameLimit));
  for (const f of named) uses.push(t("elev.memdisc.facts.quote", { fact: f.fact }));
  const remaining = approvedFacts.length - named.length;
  if (remaining > 0) uses.push(t("elev.memdisc.facts.more", { n: remaining }));

  // The count still matters — it is the only honest statement about which of
  // the approved facts the LAST answer leaned on (the server backfills it).
  if (typeof factsUsedInLastAnswer === "number") {
    uses.push(
      factsUsedInLastAnswer === 1
        ? t("elev.memdisc.facts.usedOne")
        : t("elev.memdisc.facts.used", { count: factsUsedInLastAnswer }),
    );
  }

  return { uses, fields, namedFactCount: named.length };
}
