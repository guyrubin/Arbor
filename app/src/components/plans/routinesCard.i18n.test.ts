/**
 * OBJ-BEH-09 — the Routines card on #/plans rendered five English literals
 * inside the Hebrew app: the section title, the empty-state sentence, the
 * "{done}/{total}" fragment, and both placeholders ("Add a step…", "New
 * routine name…"). A placeholder is the only instruction a text field gives,
 * so an untranslated one is not cosmetic.
 *
 * Law 7: EN and HE land together.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18nElevation/closeloop";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const CARD = readFileSync(path.join(SRC, "components/plans/RoutinesCard.tsx"), "utf8");

const KEYS = [
  "elev.closeloop.routines.title",
  "elev.closeloop.routines.empty",
  "elev.closeloop.routines.newName",
  "elev.closeloop.routines.addStep",
  "elev.closeloop.routines.stepsDone",
];

describe("OBJ-BEH-09 · the Routines card speaks both languages", () => {
  it("every key exists in EN and HE, transcreated", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k], `he ${k} carries no Hebrew`).toMatch(/[֐-׿]/);
      expect(he[k]).not.toBe(en[k]);
    }
  });

  it("the card renders each key", () => {
    for (const k of KEYS) {
      expect(CARD, `card does not use ${k}`).toContain(k);
    }
  });

  it("NEGATIVE CONTROL: the five literals that shipped are gone", () => {
    for (const literal of [
      "> Routines",
      "Build reusable routines like",
      'placeholder="Add a step',
      'placeholder="New routine name',
      "{done}/{r.steps.length}",
    ]) {
      expect(CARD, `still renders: ${literal}`).not.toContain(literal);
    }
  });

  it("both placeholders come from t(), not from a literal", () => {
    const placeholders = Array.from(CARD.matchAll(/placeholder=(\{[^}]*\}|"[^"]*")/g)).map((m) => m[1]);
    expect(placeholders).toHaveLength(2);
    for (const p of placeholders) {
      expect(p, `literal placeholder: ${p}`).toMatch(/^\{t\("elev\.closeloop\.routines\./);
    }
  });
});
