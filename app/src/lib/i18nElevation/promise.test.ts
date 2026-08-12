/**
 * Masterplan 1.6 — i18nElevation/promise module contract.
 *
 * 1. en/he key parity (a missing Hebrew key would silently render English).
 * 2. All keys live in the mandatory "elev.promise." namespace (index.ts merges
 *    elevation modules UNDER the base dictionaries — non-namespaced keys lose).
 * 3. De-jargon guard: NO "AI-powered"/AI/tech framing in either language
 *    (the masterplan 1.6 hard rule), and the Hebrew strings are actually Hebrew.
 * 4. The data-lock line ships VERBATIM from the mockup (Row-2 #2 green lock).
 * 5. promiseText() interpolates {name} like translate() and falls back
 *    key-for-key like the app-wide convention.
 */
import { describe, it, expect } from "vitest";
import { en, he, promiseText } from "./promise";

describe("promise i18n module", () => {
  it("en and he expose the exact same key set", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it("every key is namespaced elev.promise.*", () => {
    for (const key of Object.keys(en)) {
      expect(key.startsWith("elev.promise.")).toBe(true);
    }
  });

  it("covers the full promise screenful: headline, three rhythms, lock line", () => {
    for (const key of [
      "elev.promise.headline",
      "elev.promise.daily.label", "elev.promise.daily",
      "elev.promise.weekly.label", "elev.promise.weekly",
      "elev.promise.months.label", "elev.promise.months",
      "elev.promise.lock",
    ]) {
      expect(en[key], key).toBeTruthy();
      expect(he[key], key).toBeTruthy();
    }
  });

  it('no "AI-powered" / AI / tech jargon in either language (masterplan 1.6)', () => {
    const all = [...Object.values(en), ...Object.values(he)].join(" ");
    expect(all).not.toMatch(/\bAI\b|A\.I\.|artificial intelligence|AI-powered|algorithm|machine learning|model|בינה מלאכותית|אלגוריתם/i);
  });

  it("no clinical-firewall breaches (scores/verdicts/diagnosis framing)", () => {
    const all = [...Object.values(en), ...Object.values(he)].join(" ");
    expect(all).not.toMatch(/%|\bscore\b|\bdiagnos|verdict|אבחון|ציון/i);
  });

  it("Hebrew strings contain Hebrew characters", () => {
    for (const [key, value] of Object.entries(he)) {
      expect(value, key).toMatch(/[֐-׿]/);
    }
  });

  it("the Hebrew data-lock line is VERBATIM from the mockup", () => {
    expect(he["elev.promise.lock"]).toBe("המידע שלכם מאובטח — לא משתפים מידע אישי");
  });

  it("promiseText interpolates {name} in both languages", () => {
    expect(promiseText("elev.promise.headline", false, { name: "Mia" })).toContain("Mia");
    expect(promiseText("elev.promise.headline", false, { name: "Mia" })).not.toContain("{name}");
    expect(promiseText("elev.promise.headline", true, { name: "מיה" })).toContain("מיה");
    expect(promiseText("elev.promise.headline", true, { name: "מיה" })).not.toContain("{name}");
  });

  it("promiseText falls back key-for-key on a missing key (app convention)", () => {
    expect(promiseText("elev.promise.nope", false)).toBe("elev.promise.nope");
    expect(promiseText("elev.promise.nope", true)).toBe("elev.promise.nope");
  });
});
