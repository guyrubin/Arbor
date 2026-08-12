/**
 * Masterplan 3.5 — de-jargon guard. The blind mom-test's first-impression
 * killer was "too much AI-tech talk", so marketing/feature copy must speak in
 * outcomes ("Arbor's coach", "built from what you've captured"), never in
 * tech ("AI-powered", "engine", "algorithm", model names).
 *
 * ALLOWLIST RATIONALE — transparency surfaces MUST name the technology:
 *  - coach.aiDisclosure / coach.coachStatus  → EU AI Act Art. 50 persistent
 *    AI-interaction disclosure (Council 2026-07-18: honest-AI, no doctor
 *    honorific, no live-human signal). Softening these would be deceptive.
 *  - coach.contract.* / elev.coachcontract.* → the coach data contract
 *    ("what the coach sees") — factual disclosure.
 *  - airail.*                                → trust panel engine-disclosure rail.
 *  - trust.*                                 → trust/consent surfaces (e.g. "the
 *    original photo is never used to train AI").
 *  - keys containing consent/provenance/synthid/c2pa → consent + content-
 *    provenance labels (factual, legally load-bearing).
 *  - elev.safety.guard.* / elev.wow.aiNote   → GDPR child-data guardrails and
 *    the Art. 50 note where AI features are introduced.
 *  - set.admin.* / admin.* / dev.*           → internal admin/dev surfaces,
 *    not parent-facing.
 * The allowlist permits ACCURATE AI naming there; it is not a jargon license —
 * marketing superlatives ("smart AI", "powered by") stay banned everywhere.
 *
 * Audit note (2026-08-11): the sweep found ZERO violations in the shipped
 * dictionaries — every AI mention in values already sits on a disclosure
 * surface. This test exists so jargon can't creep back.
 */
import { describe, expect, it } from "vitest";
import { en as baseEn, he as baseHe } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation";
import * as planclarity from "./i18nElevation/planclarity";

type Dict = Record<string, string>;

/** Marketing-jargon patterns for EN values. `\bengine\b` deliberately does not
 *  match "engineer"; bare "model" is NOT banned because "Model it:" is the
 *  developmental-psych verb (the parent demonstrates) — only tech-model
 *  compounds are. */
const BANNED_EN: ReadonlyArray<{ term: string; re: RegExp }> = [
  { term: "AI-powered", re: /\bAI[- ]powered\b/i },
  { term: "powered by", re: /\bpowered by\b/i },
  { term: "AI coach", re: /\bAI coach\b/i },
  { term: "smart AI", re: /\bsmart AI\b/i },
  { term: "engine", re: /\bengine\b/i },
  { term: "algorithm", re: /\balgorithm(s|ic)?\b/i },
  { term: "AI/language model", re: /\b(AI|language|foundation) model(s)?\b/i },
  { term: "GPT", re: /\bGPT\b/ },
  { term: "Gemini", re: /\bGemini\b/ },
  { term: "LLM", re: /\bLLM(s)?\b/ },
  { term: "neural", re: /\bneural\b/i },
  { term: "machine learning", re: /\bmachine[- ]learning\b/i },
  { term: "chatbot", re: /\bchat ?bot(s)?\b/i },
];

/** Hebrew jargon: substring match (JS \b is Latin-centric). Bare
 *  "בינה מלאכותית" stays ALLOWED — it is the honest Hebrew term on disclosure
 *  surfaces; the banned form is the marketing framing "מבוסס(ת) בינה מלאכותית". */
const BANNED_HE: ReadonlyArray<{ term: string; re: RegExp }> = [
  { term: "מנוע", re: /מנוע/ },
  { term: "אלגוריתם", re: /אלגורית/ },
  { term: "מבוסס בינה מלאכותית", re: /מבוסס(ת)?[ -]בינה מלאכותית/ },
  { term: "למידת מכונה", re: /למידת מכונה/ },
  { term: "רשת נוירונים", re: /רשת נוירונים/ },
  { term: "צ'אטבוט", re: /צ'?אטבוט/ },
];

/** Keys whose values may name the technology accurately (see header). */
const ALLOWLIST: ReadonlyArray<RegExp> = [
  /^coach\.contract\./,
  /^coach\.aiDisclosure$/,
  /^coach\.coachStatus$/,
  /^airail\./,
  /^trust\./,
  /consent/i,
  /provenance|synthid|c2pa/i,
  /^elev\.coachcontract\./,
  /^elev\.safety\.guard\./,
  /^elev\.wow\.aiNote$/,
  /^(set\.)?admin\./,
  /^dev\./,
];

const isAllowlisted = (key: string): boolean => ALLOWLIST.some((re) => re.test(key));

function findJargon(dict: Dict, banned: ReadonlyArray<{ term: string; re: RegExp }>): string[] {
  const hits: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    if (isAllowlisted(key)) continue;
    for (const { term, re } of banned) {
      if (re.test(value)) hits.push(`${key}: banned "${term}" in "${value}"`);
    }
  }
  return hits;
}

describe("i18n de-jargon guard (masterplan 3.5)", () => {
  it("base EN dictionary has no marketing tech-jargon outside disclosure surfaces", () => {
    expect(findJargon(baseEn, BANNED_EN)).toEqual([]);
  });

  it("base HE dictionary has no marketing tech-jargon outside disclosure surfaces", () => {
    expect(findJargon(baseHe, BANNED_HE)).toEqual([]);
    // EN-origin terms (GPT/LLM/engine…) must not leak into HE values either.
    expect(findJargon(baseHe, BANNED_EN)).toEqual([]);
  });

  it("elevation modules (merged) are jargon-free in both languages", () => {
    expect(findJargon(elevationEn, BANNED_EN)).toEqual([]);
    expect(findJargon(elevationHe, BANNED_HE)).toEqual([]);
    expect(findJargon(elevationHe, BANNED_EN)).toEqual([]);
  });

  it("planclarity module (not yet index-registered) is jargon-free", () => {
    expect(findJargon(planclarity.en, BANNED_EN)).toEqual([]);
    expect(findJargon(planclarity.he, BANNED_HE)).toEqual([]);
  });

  // ── Negative controls: prove the scanner actually catches offenders. ───────
  it("catches a jargony EN value (negative control)", () => {
    const hits = findJargon(
      { "feature.pitch": "Our AI-powered engine's algorithm analyzes your child with GPT" },
      BANNED_EN,
    );
    // Four distinct banned terms in one sentence — all must be reported.
    expect(hits).toHaveLength(4);
  });

  it("catches a jargony HE value (negative control)", () => {
    const hits = findJargon(
      { "feature.pitch": "מנוע האלגוריתם שלנו, מבוסס בינה מלאכותית" },
      BANNED_HE,
    );
    expect(hits).toHaveLength(3);
  });

  it("allowlisted disclosure keys may name the technology (allowlist control)", () => {
    expect(
      findJargon({ "trust.avatar.stores.1": "never used to train an AI model" }, BANNED_EN),
    ).toEqual([]);
    // ...but the SAME value on a marketing key is flagged.
    expect(
      findJargon({ "hub.pitch": "never used to train an AI model" }, BANNED_EN),
    ).toHaveLength(1);
  });
});
