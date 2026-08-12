/**
 * W0.5 + W0.6 — i18nElevation/syncstatus module contract.
 *
 * 1. en/he key parity (a missing Hebrew key would silently render English).
 * 2. All keys live in the mandatory "elev.sync." namespace (index.ts merges
 *    elevation modules UNDER the base dictionaries — non-namespaced keys lose).
 * 3. Register guard: no technical jargon in user-facing strings, and the
 *    Hebrew strings are actually Hebrew.
 */
import { describe, it, expect } from "vitest";
import { en, he } from "./syncstatus";

describe("syncstatus i18n module", () => {
  it("en and he expose the exact same key set", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it("every key is namespaced elev.sync.*", () => {
    for (const key of Object.keys(en)) {
      expect(key.startsWith("elev.sync.")).toBe(true);
    }
  });

  it("no technical jargon in user-facing strings (calm parent register)", () => {
    const all = [...Object.values(en), ...Object.values(he)].join(" ");
    expect(all).not.toMatch(/firestore|firebase|listener|snapshot|sync engine|cache/i);
  });

  it("Hebrew strings contain Hebrew characters", () => {
    for (const value of Object.values(he)) {
      expect(value).toMatch(/[֐-׿]/);
    }
  });

  it("the two banner states are distinct messages", () => {
    expect(en["elev.sync.offline"]).toBeTruthy();
    expect(en["elev.sync.error"]).toBeTruthy();
    expect(en["elev.sync.offline"]).not.toBe(en["elev.sync.error"]);
    expect(he["elev.sync.offline"]).not.toBe(he["elev.sync.error"]);
  });
});
