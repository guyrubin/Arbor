import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { watchSignals, type WatchInput } from "./watch";
import { domainBands } from "./signals";

/* OBJ-GROWTH-06 (supersedes GP-21, "still reproduces") — the "worth a
   conversation" rows on #/copilot were built from a LABEL STRING. watch.ts
   re-derived the domain from that string with a regex whose fallback was
   "language", so a check flagging Independence and Sensory produced two rows
   both sub-labelled "Language", each evidenced by the English literal "Flagged
   in your latest Development Check" — a verdict word (law 1) in one language
   only (law 7), against the wrong domain.

   Two guards, because the defect had two halves:
     (a) VOCABULARY — the strings watch.ts emits carry no verdict word, and the
         parent-facing sentences are i18n keys, not English literals.
     (b) CORRECTNESS — a screening area keeps its OWN domain, and the two
         screening domains with no practice counterpart resolve to `null`
         rather than being silently relabelled.
   Each is paired with the pre-fix source as a negative control. */

const SRC = path.resolve(__dirname, "..");
const VERDICT_WORDS = /flagged|behind|delayed|at risk/i;

/** String and template literals only — comments and identifiers (`wasFlagged`,
 *  a guard's own regex) are not what a parent reads. */
function stringLiterals(src: string): string[] {
  const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...withoutComments.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
}

const base: WatchInput = {
  age: 5,
  screeningWatchLabels: [],
  logs: [],
  stats: [],
  bands: domainBands([], [], [], []),
  missions: [],
  adventureScenes: 0,
  adventureCorrect: 0,
};

describe("OBJ-GROWTH-06 (a) — watch.ts emits no verdict vocabulary", () => {
  it("no string literal in practice/watch.ts carries a verdict word", () => {
    const src = readFileSync(path.join(SRC, "practice", "watch.ts"), "utf8");
    const offenders = stringLiterals(src).filter((s) => VERDICT_WORDS.test(s));
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL — the pre-fix screening block and speech literals fail the same scan", () => {
    // Verbatim pre-fix source (watch.ts:63, 77, 128-146 at 7208d0db).
    const preFix = `
      area: "Speech sounds behind typical ages",
      plan: ["Several sounds are behind their typical window - a speech-language professional assesses this well."],
      const domain: PracticeDomain =
        /language/i.test(label) ? "language" :
        /social/i.test(label) ? "social" : "language";
      evidence: [
        "Flagged in your latest Development Check",
      ],
    `;
    const offenders = stringLiterals(preFix).filter((s) => VERDICT_WORDS.test(s));
    expect(offenders.length).toBeGreaterThanOrEqual(3);
  });

  it("every parent-facing sentence the module emits is an i18n key or a count line", () => {
    const signals = watchSignals({
      ...base,
      screeningWatchLabels: [
        { domain: "independence_adaptive_skills", label: "Independence & daily skills" },
        { domain: "sensory_motor_patterns", label: "Sensory & movement" },
      ],
    });
    for (const s of signals) {
      expect(s.evidence[0]).toBe("elev.growthTruth.watch.fromCheck");
      expect(VERDICT_WORDS.test([s.area, s.domainLabel, ...s.evidence, ...s.plan].join(" "))).toBe(false);
    }
  });
});

describe("OBJ-GROWTH-06 (b) — a screening area keeps its own domain", () => {
  it("independence and sensory rows are never relabelled 'language'", () => {
    const signals = watchSignals({
      ...base,
      screeningWatchLabels: [
        { domain: "independence_adaptive_skills", label: "Independence & daily skills" },
        { domain: "sensory_motor_patterns", label: "Sensory & movement" },
      ],
    });
    expect(signals).toHaveLength(2);
    for (const s of signals) {
      expect(s.domain).toBeNull();
      expect(s.domainLabel).not.toBe("Language");
    }
    expect(signals.map((s) => s.domainLabel).sort()).toEqual([
      "Independence & daily skills",
      "Sensory & movement",
    ]);
  });

  it("a mappable screening domain still reaches its practice counterpart", () => {
    const [s] = watchSignals({
      ...base,
      screeningWatchLabels: [{ domain: "social_development", label: "Social development" }],
    });
    expect(s.domain).toBe("social");
    expect(s.domainLabel).toBe("Social development");
  });

  it("NEGATIVE CONTROL — the pre-fix regex map sends both to 'language'", () => {
    const preFixMap = (label: string): string =>
      /language/i.test(label)
        ? "language"
        : /social/i.test(label)
          ? "social"
          : /attach|regul/i.test(label)
            ? "emotional"
            : /think|attention|cognit/i.test(label)
              ? "cognition"
              : "language";
    expect(preFixMap("Independence & daily skills")).toBe("language");
    expect(preFixMap("Sensory & movement")).toBe("language");
  });

  it("day-0 (no check answered) still fires nothing", () => {
    expect(watchSignals(base)).toHaveLength(0);
  });
});
