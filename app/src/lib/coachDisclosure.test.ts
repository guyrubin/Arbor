/* GP-14 — "what the coach sees" names WHICH, not just HOW MANY.
 *
 * The panel reported "Memory facts you approved (3 used in the last answer)".
 * A parent cannot check, correct or withdraw a fact they are never shown, so
 * the disclosure asked for trust while withholding the thing that earns it.
 *
 * The load-bearing test here is the DRIFT GUARD: lib/coachDisclosure mirrors
 * ai/prompts MODEL_PROFILE_FIELDS (it cannot import it — that module reaches
 * @google/genai through contracts/coach, which must never enter the browser
 * bundle), so this file imports the REAL allow-list and the REAL projector and
 * fails the moment the disclosure and the wire disagree.
 */
import { describe, it, expect } from "vitest";
import { MODEL_PROFILE_FIELDS, promptProfile } from "../ai/prompts";
import { DISCLOSED_PROFILE_FIELDS, coachDisclosure, disclosedProfileFields } from "./coachDisclosure";

/** Echo translator: returns the key, with {params} substituted, so assertions
 *  can see both the key that was chosen and the values interpolated into it. */
const t = (key: string, vars?: Record<string, string | number>) => {
  let out = key;
  for (const [k, v] of Object.entries(vars ?? {})) out += ` ${k}=${v}`;
  return out;
};

const PROFILES: Array<{ label: string; profile: Record<string, unknown> }> = [
  { label: "empty", profile: {} },
  { label: "name only", profile: { name: "Dylan Rubin" } },
  {
    label: "rich",
    profile: {
      id: "child-1",
      name: "Dylan",
      age: 4,
      birthDate: "2022-01-10",
      languages: ["Hebrew", "English"],
      schoolContext: "Gan, mornings",
      strengths: ["curious"],
      challenges: ["transitions"],
      activeGoals: [{ label: "Calmer mornings", domainId: "regulation" }],
      interests: ["dinosaurs"],
      preterm: { gestationalWeeks: 34 },
      gender: "boy",
      // Banned upstream by promptProfile — must never appear here either.
      riskLevel: "elevated",
      photoUrl: "data:image/png;base64,AAAA",
    },
  },
  { label: "blank-ish", profile: { name: "   ", languages: [], strengths: [""], activeGoals: [{}] } },
];

describe("GP-14 — the disclosure list cannot drift from the wire", () => {
  it("mirrors MODEL_PROFILE_FIELDS exactly, in order", () => {
    expect([...DISCLOSED_PROFILE_FIELDS]).toEqual([...MODEL_PROFILE_FIELDS]);
  });

  it("for every fixture, the fields NAMED are exactly the fields promptProfile SENDS", () => {
    for (const { label, profile } of PROFILES) {
      const sent = Object.keys(promptProfile(profile) ?? {}).sort();
      const named = [...disclosedProfileFields(profile)].sort();
      expect(named, `drift on the "${label}" profile`).toEqual(sent);
    }
  });

  it("NEGATIVE CONTROL — naming every allow-listed field regardless of the profile WOULD drift", () => {
    // The tempting shortcut: "just list the allow-list". It over-claims on a
    // sparse profile, which is the failure this guard exists to catch.
    const naive = [...MODEL_PROFILE_FIELDS].sort();
    const sent = Object.keys(promptProfile({ name: "Dylan" }) ?? {}).sort();
    expect(naive).not.toEqual(sent);
    expect([...disclosedProfileFields({ name: "Dylan" })].sort()).toEqual(sent);
  });

  it("a banned field can never be named, because it is never sent", () => {
    const named = disclosedProfileFields(PROFILES[2].profile) as string[];
    for (const banned of ["riskLevel", "photoUrl", "avatar", "id"]) {
      expect(named).not.toContain(banned);
    }
  });
});

describe("GP-14 — the approved facts are actually named", () => {
  const facts = [
    { memoryId: "m1", fact: "Dylan sleeps better with the hall light on" },
    { memoryId: "m2", fact: "Transitions out of the park are the hardest part of the day" },
    { memoryId: "m3", fact: "Grandma picks him up on Tuesdays" },
    { memoryId: "m4", fact: "He is scared of the vacuum" },
    { memoryId: "m5", fact: "Loves dinosaurs" },
    { memoryId: "m6", fact: "Started a new gan in September" },
  ];

  it("FAILS WITHOUT THE CHANGE — the fact TEXT appears, not only a count", () => {
    const { uses } = coachDisclosure(
      { profile: { name: "Dylan" }, approvedFacts: facts.slice(0, 2), factsUsedInLastAnswer: 2, childFirstName: "Dylan" },
      t,
    );
    const joined = uses.join("\n");
    expect(joined).toContain("Dylan sleeps better with the hall light on");
    expect(joined).toContain("Transitions out of the park are the hardest part of the day");
    // The count survives — it is the only honest statement about the LAST answer.
    expect(joined).toContain("elev.memdisc.facts.used count=2");
  });

  it("names the fact verbatim — never reworded, never truncated by this module", () => {
    const long = "He needs the same three books, in the same order, or bedtime restarts from the beginning";
    const { uses } = coachDisclosure(
      { profile: {}, approvedFacts: [{ memoryId: "m", fact: long }], childFirstName: "Dylan" },
      t,
    );
    expect(uses.join("\n")).toContain(long);
  });

  it("folds the tail into a '+N more' pointer instead of dumping the ledger", () => {
    const { uses, namedFactCount } = coachDisclosure(
      { profile: {}, approvedFacts: facts, childFirstName: "Dylan", nameLimit: 4 },
      t,
    );
    expect(namedFactCount).toBe(4);
    expect(uses.join("\n")).toContain("elev.memdisc.facts.more n=2");
    expect(uses.join("\n")).not.toContain("Started a new gan in September");
  });

  it("day 0: says none are sent, and never implies memory use (the AI-23 rule, held here too)", () => {
    const { uses } = coachDisclosure({ profile: {}, approvedFacts: [], childFirstName: "Dylan" }, t);
    const joined = uses.join("\n");
    expect(joined).toContain("elev.memdisc.facts.none");
    expect(joined).not.toContain("elev.memdisc.facts.lead");
    expect(joined).not.toContain("elev.memdisc.facts.used");
  });

  it("singular reads as singular", () => {
    const { uses } = coachDisclosure(
      { profile: {}, approvedFacts: facts.slice(0, 1), factsUsedInLastAnswer: 1, childFirstName: "Dylan" },
      t,
    );
    expect(uses.join("\n")).toContain("elev.memdisc.facts.usedOne");
  });

  it("clinical firewall: the disclosure grades nothing — no score, band, %, or verdict", () => {
    const { uses } = coachDisclosure(
      { profile: PROFILES[2].profile, approvedFacts: facts, factsUsedInLastAnswer: 3, childFirstName: "Dylan" },
      t,
    );
    const joined = uses.join("\n");
    expect(joined).not.toMatch(/%|\bscore\b|\bpercentile\b|\bon track\b|\bbehind\b|\brisk\b|\bdelay(ed)?\b/i);
    // and no profile VALUE is disclosed — only the names of the fields
    expect(joined).not.toContain("elevated");
    expect(joined).not.toContain("Gan, mornings");
  });
});
