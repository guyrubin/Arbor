import { describe, it, expect } from "vitest";
import framework from "../../framework.json";
import {
  DOMAINS,
  DOMAIN_COUNT,
  DOMAIN_IDS,
  DEVELOPMENTAL_DOMAIN_IDS,
  FINE_MOTOR_ACTIVITY_IDS,
  VOCAB_IDS,
  domainLabel,
  domainLabelEn,
  toDomains,
  translate,
  type Vocab,
} from "./registry";
import { en as namesEn, he as namesHe } from "../i18nElevation/domains";
import { translate as t18n } from "../i18n";
import { DOMAIN_LABEL as SCREEN_DOMAIN_LABEL } from "../screening";
import { DOMAIN_META } from "../../practice/content";
import { PLAY_ACTIVITIES, playDomainLabel } from "../../playbank/content";
import { CANONICAL_BEHAVIOR_TYPES } from "../../content/behaviorTaxonomy";
import { MONITORED_DOMAINS, monitoredDomainToPlayHint } from "../monitoring";

/* B-GROWTH-26 — one domain registry (spine §2, Guy D1 = 8 domains, D2 =
   professions are output lenses). */

describe("B-GROWTH-26 — the registry", () => {
  it("has 8 domains in spine order with unique ids, and DOMAIN_COUNT = DOMAINS.length", () => {
    expect(DOMAIN_IDS).toEqual(["talking", "moving", "hands", "thinking", "playing", "feelings", "body", "family"]);
    expect(new Set(DOMAIN_IDS).size).toBe(DOMAINS.length);
    expect(DOMAIN_COUNT).toBe(DOMAINS.length);
    expect(DOMAIN_COUNT).toBe(8);
  });

  it("every domain is named in EN and HE (HE carries no Latin), inline form too", () => {
    for (const d of DOMAINS) {
      for (const key of [d.labelKey, d.inlineKey]) {
        expect(namesEn[key], key).toBeTruthy();
        expect(namesHe[key], key).toBeTruthy();
        expect(namesHe[key], key).not.toMatch(/[A-Za-z]/);
        // and the merged dictionaries resolve them (module registered)
        expect(t18n("en", key)).toBe(namesEn[key]);
        expect(t18n("he", key)).toBe(namesHe[key]);
      }
      expect(d.professions.length, d.id).toBeGreaterThan(0);
      expect(d.subAreas.length, d.id).toBeGreaterThan(0);
    }
  });

  it("DEVELOPMENTAL_DOMAIN_IDS is framework.json's domain list, in order (8 rows)", () => {
    expect([...DEVELOPMENTAL_DOMAIN_IDS]).toEqual((framework as { domains: { id: string }[] }).domains.map((d) => d.id));
    expect(DEVELOPMENTAL_DOMAIN_IDS.length).toBe(8);
  });
});

describe("B-GROWTH-26 — exhaustive: every id of the four vocabularies + behaviour types maps to ≥1 of the 8", () => {
  const vocabs: Record<Vocab, string[]> = {
    developmental: (framework as { domains: { id: string }[] }).domains.map((d) => d.id),
    screen: Object.keys(SCREEN_DOMAIN_LABEL),
    practice: Object.keys(DOMAIN_META),
    play: [...new Set(PLAY_ACTIVITIES.map((a) => a.domain))],
    behavior: [...CANONICAL_BEHAVIOR_TYPES],
  };

  for (const [vocab, ids] of Object.entries(vocabs) as [Vocab, string[]][]) {
    it(`${vocab}: ${ids.length} ids, each → ≥1 registry domain, and the table covers exactly them`, () => {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        const doms = toDomains(vocab, id);
        expect(doms.length, `${vocab}:${id}`).toBeGreaterThanOrEqual(1);
        for (const d of doms) expect(DOMAIN_IDS).toContain(d);
      }
      expect([...VOCAB_IDS[vocab]].sort()).toEqual([...ids].sort());
    });
  }

  it("behaviour cross-tags: Sensory Overload → [6, 3]; Sleep Meltdown / Food Refusal → [6, 7]; the rest → 6", () => {
    expect(toDomains("behavior", "Sensory Overload")).toEqual(["feelings", "hands"]);
    expect(toDomains("behavior", "Sleep Meltdown")).toEqual(["feelings", "body"]);
    expect(toDomains("behavior", "Food Refusal")).toEqual(["feelings", "body"]);
    for (const b of ["Transition Refusal", "Screentime Dispute", "Sibling Conflict"]) {
      expect(toDomains("behavior", b)).toEqual(["feelings"]);
    }
  });

  it("PlayDomain motor splits by activity id (default moving = 2; fine-motor activities → hands = 3)", () => {
    expect(toDomains("play", "motor")).toEqual(["moving"]);
    expect(toDomains("play", "motor", { activityId: "motor-big-ball-kick" })).toEqual(["moving"]);
    expect(toDomains("play", "motor", { activityId: "motor-scissor-snip" })).toEqual(["hands"]);
    // the split only ever applies to motor
    expect(toDomains("play", "language", { activityId: "motor-scissor-snip" })).toEqual(["talking"]);
  });

  it("every FINE_MOTOR_ACTIVITY_IDS entry is a real motor activity in the playbank", () => {
    const motor = new Set(PLAY_ACTIVITIES.filter((a) => a.domain === "motor").map((a) => a.id));
    for (const id of FINE_MOTOR_ACTIVITY_IDS) expect(motor.has(id), id).toBe(true);
  });

  it("unknown / custom ids map to nothing (no guess) and label with their fallback", () => {
    expect(toDomains("developmental", "made_up")).toEqual([]);
    expect(toDomains("developmental", "toString")).toEqual([]);
    expect(domainLabel("developmental", "made_up", (k) => k, "Custom")).toBe("Custom");
  });
});

describe("B-GROWTH-26 — the four ad-hoc maps are reproduced THROUGH the registry", () => {
  it("milestone → practice (was MILESTONE_DOMAIN_MAP)", () => {
    const pre: Record<string, string | undefined> = {
      language_communication: "language",
      cognition_executive_function: "cognition",
      social_development: "social",
      attachment_regulation: "emotional",
      independence_adaptive_skills: undefined,
      sensory_motor_patterns: undefined,
      ecosystem_stressors: undefined,
      health_sleep_feeding: undefined,
    };
    for (const [id, want] of Object.entries(pre)) expect(translate("developmental", id, "practice"), id).toBe(want);
  });

  it("screening → practice (was SCREEN_TO_PRACTICE)", () => {
    const pre: Record<string, string | undefined> = {
      language_communication: "language",
      social_development: "social",
      attachment_regulation: "emotional",
      cognition_executive_function: "cognition",
      independence_adaptive_skills: undefined,
      sensory_motor_patterns: undefined,
    };
    for (const [id, want] of Object.entries(pre)) expect(translate("screen", id, "practice"), id).toBe(want);
  });

  it("monitored → play hint (was monitoredDomainToPlayHint's map; independence now → motor via hands)", () => {
    const want: Record<string, string> = {
      attachment_regulation: "regulation",
      language_communication: "language",
      cognition_executive_function: "cognitive",
      social_development: "social",
      independence_adaptive_skills: "motor",
      sensory_motor_patterns: "motor",
    };
    for (const d of MONITORED_DOMAINS) expect(monitoredDomainToPlayHint(d), d).toBe(want[d]);
  });

  it("play domain label (was PLAY_DOMAIN_LABEL) = the registry's in-sentence name, EN + HE", () => {
    expect(playDomainLabel("regulation", "en")).toBe("feelings and behaviour");
    expect(playDomainLabel("motor", "en")).toBe("moving");
    expect(playDomainLabel("motor", "en", "motor-scissor-snip")).toBe("hands, senses and self-care");
    for (const p of ["regulation", "language", "motor", "cognitive", "social"] as const) {
      expect(playDomainLabel(p, "he"), p).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("B-GROWTH-26 — one name per domain, wherever it is printed", () => {
  it("a framework id, a screening id and the same practice id print the same name", () => {
    const en = (k: string) => t18n("en", k);
    const he = (k: string) => t18n("he", k);
    expect(domainLabel("developmental", "language_communication", en)).toBe(domainLabel("screen", "language_communication", en));
    expect(domainLabel("developmental", "language_communication", en)).toBe(domainLabel("practice", "language", en));
    expect(domainLabel("developmental", "attachment_regulation", he)).toBe(domainLabel("practice", "emotional", he));
    expect(domainLabel("developmental", "sensory_motor_patterns", en)).toBe("Moving · Hands, senses & self-care");
    expect(domainLabel("practice", "speech", en)).toBe("Talking & understanding · speech sounds");
    expect(domainLabelEn("practice", "speech")).toBe("Talking & understanding · speech sounds");
  });
});
