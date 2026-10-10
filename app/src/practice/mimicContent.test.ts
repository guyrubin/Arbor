import { describe, expect, it } from "vitest";
import { MIMIC_PACKS } from "./content";
import { localizedMimicPacks } from "./mimicContent";
import { translate } from "../lib/i18n";
import { en, he } from "../lib/i18nElevation/mimicContent";

const keys = MIMIC_PACKS.flatMap((pack) => [
  ...["title", "blurb"].map((field) => `elev.mimic.content.pack.${pack.id}.${field}`),
  ...pack.prompts.flatMap((prompt) => ["title", "instruction", "focus"].map((field) => `elev.mimic.content.prompt.${prompt.id}.${field}`)),
]);
const identity = (packs: typeof MIMIC_PACKS) => packs.map(({ id, emoji, prompts }) => ({
  id, emoji, prompts: prompts.map(({ id, emoji }) => ({ id, emoji })),
}));

describe("Mimic display-only localization", () => {
  it("covers all four packs and 24 prompts in both dictionaries without fallback or orphan keys", () => {
    expect(keys).toHaveLength(80);
    for (const dict of [en, he]) {
      expect(Object.keys(dict).filter((key) => key.startsWith("elev.mimic.content.")).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(dict[key].trim(), key).toBeTruthy();
    }
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const key of keys) {
      expect(he[key], key).toMatch(/[א-ת]/);
      expect(translate("he", key), key).toBe(he[key]);
      expect(translate("en", key), key).toBe(en[key]);
    }
  });

  it("names the syllable activity without an on-track verdict", () => {
    expect(translate("he", "elev.mimic.content.pack.power-syllables.title")).toBe("משחק הברות");
    expect(translate("en", "elev.mimic.content.pack.power-syllables.title")).toBe("Power Syllables");
  });

  it("keeps every English field verbatim and leaves the canonical bank untouched", () => {
    const before = structuredClone(MIMIC_PACKS);
    const english = localizedMimicPacks((key) => translate("en", key));
    const hebrew = localizedMimicPacks((key) => translate("he", key));
    expect(english).toEqual(before);
    expect(MIMIC_PACKS).toEqual(before);
    expect(hebrew).not.toBe(MIMIC_PACKS);
    hebrew.forEach((pack, i) => {
      expect(pack).not.toBe(MIMIC_PACKS[i]);
      pack.prompts.forEach((prompt, j) => expect(prompt).not.toBe(MIMIC_PACKS[i].prompts[j]));
    });
  });

  it("preserves stable IDs, order, round counts, emoji and object shape in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      const packs = localizedMimicPacks((key) => translate(lang, key));
      expect(identity(packs)).toEqual(identity(MIMIC_PACKS));
      for (const [i, pack] of packs.entries()) {
        expect(Object.keys(pack)).toEqual(Object.keys(MIMIC_PACKS[i]));
        for (const [j, prompt] of pack.prompts.entries()) expect(Object.keys(prompt)).toEqual(Object.keys(MIMIC_PACKS[i].prompts[j]));
      }
    }
  });

  it("retains the existing practice targets instead of changing the phoneme exercises into Hebrew words", () => {
    const targets: Record<string, string[]> = {
      lion: ["ROAAAR"], snake: ["sssssss"], cow: ["mmmooooo"], bee: ["zzzzzz"], horse: ["brrrrr"], owl: ["hoo-hoo, hoo-hoo"],
      bababa: ["ba-ba-ba, BA-BA-BA"], mamama: ["ma-ma-ma"], dadada: ["da-da-da-da"], pataka: ["pa-ta-ka, pa-ta-ka"], weewoo: ["Wee-woo wee-woo"], lalala: ["la-la-la-laaaa"],
      more: ["more", "mmm-ore"], up: ["UP"], go: ["GO"], bye: ["bye-bye"], uhoh: ["uh-oh"], no: ["no-no-no"],
    };
    for (const [id, sounds] of Object.entries(targets)) {
      const key = `elev.mimic.content.prompt.${id}.instruction`;
      for (const sound of sounds) {
        expect(en[key], key).toContain(sound);
        expect(he[key], key).toContain(`\u2068${sound}\u2069`);
      }
    }
    expect(he["elev.mimic.content.prompt.tongue-out.instruction"]).toContain("שלוש פעמים");
    expect(he["elev.mimic.content.prompt.big-smile.instruction"]).toContain("חיוך, נשיקה, חיוך, נשיקה");
    for (const [id, target] of [["snake", "S"], ["cow", "M + OO"], ["bee", "Z"], ["owl", "H + OO"], ["tongue-up", "L, T, D"], ["big-smile", "EE/OO"], ["puffy-cheeks", "P, B"]]) {
      expect(he[`elev.mimic.content.prompt.${id}.focus`]).toContain(`\u2068${target}\u2069`);
    }
  });
});
