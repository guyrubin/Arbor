/**
 * OBJ-JOURNAL-01 / TJB-22 — one label per behaviour type, on every hub.
 *
 * Behaviors rendered `behaviorTypeLabel(log.behaviorType, t)`; the Journal and
 * Story rows rendered `signal.refTitle`, which IS `log.behaviorType`, raw. The
 * same saved moment therefore had two names, and on a Hebrew screen one of
 * them was English. Two of the four seeded ledger entries carry legacy free
 * labels ("Sensory Meltdown", "Sibling Dispute / Screentime Refusal"), so this
 * was not a theoretical case — it is what a demo account shows.
 *
 * Coverage here is over the values a ledger actually holds: every canonical
 * type, every legacy label shipped in initialData, and an unmappable label.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { en, he } from "../lib/i18n";
import { BEHAVIOR_TYPES, CANONICAL_BEHAVIOR_TYPES, behaviorTypeLabel } from "./behaviorTaxonomy";
import { buildTimeline, signalTitle, type TranslateFn } from "../lib/signalTimeline";
import type { BehaviorLog } from "../types";

const SRC = path.resolve(__dirname, "..");
const tEn = (k: string) => en[k] ?? k;
const tHe = (k: string) => he[k] ?? k;

/** Every behaviorType value the seeded ledger ships with. */
const SEEDED = Array.from(
  readFileSync(path.join(SRC, "initialData.ts"), "utf8").matchAll(/behaviorType:\s*"([^"]+)"/g),
).map((m) => m[1]);

const log = (behaviorType: string): BehaviorLog => ({
  id: `b-${behaviorType}`, childId: "c", behaviorType, intensity: 3, durationMinutes: 5,
  trigger: "t", response: "r", context: "Home", notes: "", timestamp: new Date().toISOString(),
  resolved: false,
} as BehaviorLog);

describe("behaviorTypeLabel — canonical coverage", () => {
  it("every canonical type has a real EN and HE label in both variants", () => {
    for (const type of CANONICAL_BEHAVIOR_TYPES) {
      for (const variant of ["short", "full"] as const) {
        for (const [name, t] of [["en", tEn], ["he", tHe]] as const) {
          const label = behaviorTypeLabel(type, t, variant);
          expect(label, `${name}/${variant} ${type}`).toBeTruthy();
          // Not a leaked key, and not the stored English enum value.
          expect(label, `${name}/${variant} ${type} leaked a key`).not.toMatch(/^(beh|ql)\.type\./);
          if (name === "he") expect(label, `he ${type} is still English`).toMatch(/[֐-׿]/);
        }
      }
    }
  });
});

describe("behaviorTypeLabel — the labels a real ledger holds", () => {
  it("the seeded ledger contains legacy free labels (this is not hypothetical)", () => {
    expect(SEEDED).toContain("Sensory Meltdown");
    expect(SEEDED.some((s) => s.startsWith("Sibling Dispute"))).toBe(true);
  });

  it("every seeded label renders in Hebrew on a Hebrew screen", () => {
    for (const type of SEEDED) {
      expect(behaviorTypeLabel(type, tHe), `seeded "${type}"`).toMatch(/[֐-׿]/);
    }
  });

  it("the two named legacy labels land on their canonical siblings", () => {
    expect(behaviorTypeLabel("Sensory Meltdown", tHe)).toBe(he["ql.type.sensory"]);
    expect(behaviorTypeLabel("Sibling Dispute / Screentime Refusal", tHe)).toBe(he["ql.type.screen"]);
    expect(behaviorTypeLabel("Sensory Meltdown", tEn, "full")).toBe(en["beh.type.sensory"]);
  });

  it("an unmappable label still renders the parent's own words, never a blank", () => {
    expect(behaviorTypeLabel("Old Free Label", tHe)).toBe("Old Free Label");
    expect(behaviorTypeLabel("", tHe)).toBe("");
  });

  it("NEGATIVE CONTROL: the pre-fix lookup left legacy labels in English", () => {
    // Exactly what behaviorTypeLabel did before OBJ-JOURNAL-01.
    const prefix = (type: string, t: (k: string) => string) => {
      const entry = BEHAVIOR_TYPES.find((b) => b.value === type);
      return entry ? t(entry.shortLabelKey) : type;
    };
    expect(prefix("Sensory Meltdown", tHe)).toBe("Sensory Meltdown");
    expect(prefix("Sensory Meltdown", tHe)).not.toMatch(/[֐-׿]/);
  });
});

describe("one label per type across the hubs", () => {
  const t: TranslateFn = (key) => tHe(key);

  it("the Journal/Story row title equals the Behaviors label for the same log", () => {
    for (const type of [...CANONICAL_BEHAVIOR_TYPES, ...SEEDED]) {
      const [row] = buildTimeline({ behaviorLogs: [log(type)] });
      expect(signalTitle(row, t), `row title for "${type}"`).toBe(behaviorTypeLabel(type, tHe));
    }
  });

  it("a log with no stored type still falls back to the timeline's own key", () => {
    const [row] = buildTimeline({ behaviorLogs: [log("")] });
    expect(signalTitle(row, t)).toBe(tHe("timeline.title.moment"));
  });
});
