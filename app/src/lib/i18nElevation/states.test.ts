/* Masterplan 4.3 — i18nElevation/states module guard.
 *
 * Same parity discipline lib/i18n.test.ts enforces on the registered
 * dictionaries, applied directly to this module so it is safe BEFORE its
 * index.ts registration (that file is owned by another workstream): key
 * parity, namespacing, non-empty values, Hebrew actually in Hebrew, and the
 * de-jargon rules (i18n.jargon.test.ts) pre-applied so registration cannot
 * introduce a violation. */

import { describe, expect, it } from "vitest";
import { en, he, statesText, withStates } from "./states";

describe("i18nElevation/states — en/he parity + namespacing", () => {
  it("en and he carry exactly the same key set", () => {
    const enKeys = Object.keys(en).sort();
    const heKeys = Object.keys(he).sort();
    expect(heKeys).toEqual(enKeys);
  });

  it("every key is namespaced elev.states.* (registry-safe)", () => {
    for (const k of Object.keys(en)) {
      expect(k.startsWith("elev.states."), `bad namespace: ${k}`).toBe(true);
    }
  });

  it("no empty values in either language", () => {
    for (const [k, v] of [...Object.entries(en), ...Object.entries(he)]) {
      expect(v.trim().length, `empty value for ${k}`).toBeGreaterThan(0);
    }
  });

  it("Hebrew values actually carry Hebrew script", () => {
    for (const [k, v] of Object.entries(he)) {
      expect(/[֐-׿]/.test(v), `he["${k}"] carries no Hebrew script: "${v}"`).toBe(true);
    }
  });

  it("interpolation placeholders match across languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en)) {
      expect(vars(he[k]), `placeholder drift on ${k}`).toEqual(vars(en[k]));
    }
  });
});

describe("i18nElevation/states — register rules", () => {
  const values = [...Object.values(en), ...Object.values(he)];

  it("no marketing/tech jargon (mirror of i18n.jargon.test.ts, no allowlist here)", () => {
    const bannedEn = [/\bAI[- ]powered\b/i, /\bpowered by\b/i, /\bengine\b/i, /\balgorithm(s|ic)?\b/i, /\bLLM(s)?\b/, /\bchat ?bot(s)?\b/i, /\bmachine[- ]learning\b/i];
    const bannedHe = [/מנוע/, /אלגורית/, /מבוסס(ת)?[ -]בינה מלאכותית/, /למידת מכונה/, /צ'?אטבוט/];
    for (const v of values) {
      for (const re of [...bannedEn, ...bannedHe]) {
        expect(re.test(v), `jargon "${re}" in "${v}"`).toBe(false);
      }
    }
  });

  it("clinical firewall: no %, verdicts, or trend deltas in state copy", () => {
    for (const v of values) {
      expect(v.includes("%"), `% in "${v}"`).toBe(false);
      expect(/\b(on track|behind|ahead|delayed|at risk)\b/i.test(v), `verdict language in "${v}"`).toBe(false);
    }
  });

  it("never celebrates zeros: no zero-count exclamations", () => {
    for (const v of values) {
      expect(/\b0\b|\bzero\b|אפס/i.test(v), `zero-count copy in "${v}"`).toBe(false);
    }
  });
});

describe("statesText / withStates — t() contract", () => {
  it("resolves en/he and interpolates {var} tokens", () => {
    expect(statesText("elev.states.retry", false)).toBe(en["elev.states.retry"]);
    expect(statesText("elev.states.retry", true)).toBe(he["elev.states.retry"]);
    const out = statesText("elev.states.journal.body", false, { name: "Mia" });
    expect(out).toContain("Mia");
    expect(out).not.toContain("{name}");
  });

  it("missing key falls back to the key itself (app-wide convention)", () => {
    expect(statesText("elev.states.nope", false)).toBe("elev.states.nope");
  });

  it("missing var stays as-is (never crashes)", () => {
    const out = statesText("elev.states.comics.body", false);
    expect(out).toContain("{name}");
  });

  it("withStates routes elev.states.* keys here and everything else to t()", () => {
    const t = (key: string) => `base:${key}`;
    const wrapped = withStates(t, false);
    expect(wrapped("elev.states.retry")).toBe(en["elev.states.retry"]);
    expect(wrapped("journal.title")).toBe("base:journal.title");
  });
});
