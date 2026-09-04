/* Wave L i18nElevation module guard — evening · aierrors · childmemory ·
 * memorydisclosure.
 *
 * Same parity discipline lib/i18n.test.ts enforces on the registered
 * dictionaries, plus the de-jargon and clinical-firewall rules, applied to the
 * four new modules AND to their registration: a module that is written but
 * never added to index.ts resolves to its own key on screen.
 */
import { describe, it, expect } from "vitest";
import * as aierrors from "./aierrors";
import * as childmemory from "./childmemory";
import * as evening from "./evening";
import * as memorydisclosure from "./memorydisclosure";
import { elevationEn, elevationHe } from "./index";
import { translate } from "../i18n";

const MODULES = [
  { name: "aierrors", ns: "elev.aierrors.", mod: aierrors },
  { name: "childmemory", ns: "elev.childmem.", mod: childmemory },
  { name: "evening", ns: "elev.evening.", mod: evening },
  { name: "memorydisclosure", ns: "elev.memdisc.", mod: memorydisclosure },
];

describe("Wave L i18n modules — parity, namespacing, registration", () => {
  for (const { name, ns, mod } of MODULES) {
    it(`${name}: en and he carry exactly the same key set`, () => {
      expect(Object.keys(mod.he).sort()).toEqual(Object.keys(mod.en).sort());
    });

    it(`${name}: every key is namespaced ${ns}* (registry-safe)`, () => {
      for (const k of Object.keys(mod.en)) expect(k.startsWith(ns), `bad namespace: ${k}`).toBe(true);
    });

    it(`${name}: no empty values, and Hebrew is actually Hebrew`, () => {
      for (const [k, v] of Object.entries(mod.en)) expect(v.trim().length, `empty en ${k}`).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(mod.he)) {
        expect(v.trim().length, `empty he ${k}`).toBeGreaterThan(0);
        expect(/[֐-׿]/.test(v), `he["${k}"] carries no Hebrew script: "${v}"`).toBe(true);
      }
    });

    it(`${name}: interpolation placeholders match across languages`, () => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      for (const k of Object.keys(mod.en)) expect(vars(mod.he[k]), `placeholder drift on ${k}`).toEqual(vars(mod.en[k]));
    });

    it(`${name}: is REGISTERED — every key resolves through t() in both languages`, () => {
      for (const k of Object.keys(mod.en)) {
        expect(elevationEn[k], `unregistered: ${k}`).toBe(mod.en[k]);
        expect(elevationHe[k], `unregistered (he): ${k}`).toBe(mod.he[k]);
        // translate() is the real render-site path; an unregistered key would
        // come back as the key itself.
        expect(translate("en", k)).not.toBe(k);
        expect(translate("he", k)).not.toBe(k);
      }
    });
  }

  it("NEGATIVE CONTROL — an unregistered elev.* key really does resolve to itself", () => {
    expect(translate("en", "elev.evening.nudge.NOPE")).toBe("elev.evening.nudge.NOPE");
  });
});

describe("Wave L i18n modules — register rules", () => {
  const values = MODULES.flatMap(({ mod }) => [...Object.values(mod.en), ...Object.values(mod.he)]);

  it("no marketing/tech jargon (mirror of i18n.jargon.test.ts, no allowlist here)", () => {
    const banned = [
      /\bAI[- ]powered\b/i, /\bpowered by\b/i, /\bengine\b/i, /\balgorithm(s|ic)?\b/i,
      /\bLLM(s)?\b/, /\bchat ?bot(s)?\b/i, /\bmachine[- ]learning\b/i,
      /מנוע/, /אלגורית/, /מבוסס(ת)?[ -]בינה מלאכותית/, /למידת מכונה/, /צ'?אטבוט/,
    ];
    for (const v of values) for (const re of banned) expect(re.test(v), `jargon ${re} in "${v}"`).toBe(false);
  });

  it("clinical firewall: no score, band, percentage, verdict or trend delta about the child", () => {
    for (const v of values) {
      expect(v).not.toMatch(/\d+\s?%/);
      expect(v).not.toMatch(/\bscore\b|\bpercentile\b|\bon track\b|\bfalling behind\b|\bdelayed\b|\bnormal for\b/i);
      expect(v).not.toMatch(/ציון|אחוזון|בפיגור|תקין לגיל/);
    }
  });

  it("no raw HTTP status codes or server jargon reach the parent (AI-06's whole point)", () => {
    for (const v of values) {
      expect(v).not.toMatch(/\b(429|451|402|409|5\d\d)\b/);
      expect(v).not.toMatch(/\bHTTP\b|\bAPI\b|\bstatus code\b|\bendpoint\b|\brate[- ]limit/i);
    }
  });

  it("the 429 and 451 messages are genuinely different sentences", () => {
    expect(aierrors.en["elev.aierrors.quota.title"]).not.toBe(aierrors.en["elev.aierrors.consent.title"]);
    expect(aierrors.en["elev.aierrors.quota.body"]).not.toBe(aierrors.en["elev.aierrors.consent.body"]);
    expect(aierrors.he["elev.aierrors.quota.body"]).not.toBe(aierrors.he["elev.aierrors.consent.body"]);
    // …and neither is the generic one the old card showed for both.
    for (const k of ["elev.aierrors.quota.body", "elev.aierrors.consent.body", "elev.aierrors.offline.body"]) {
      expect(aierrors.en[k]).not.toBe(aierrors.en["elev.aierrors.generic.body"]);
    }
  });

  it("every memdisc field label exists for every field the disclosure can name", () => {
    for (const f of [
      "name", "age", "ageLabel", "languages", "schoolContext", "strengths",
      "challenges", "activeGoals", "interests", "preterm", "gender",
    ]) {
      expect(memorydisclosure.en[`elev.memdisc.field.${f}`], `missing label for ${f}`).toBeTruthy();
      expect(memorydisclosure.he[`elev.memdisc.field.${f}`], `missing he label for ${f}`).toBeTruthy();
    }
  });
});
