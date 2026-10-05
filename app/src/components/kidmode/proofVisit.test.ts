/**
 * B-GAME-07d (g) — the one-step proof link works ONLY on the local machine.
 */
import { describe, expect, it } from "vitest";
import { applyProofVisit, initProofVisit, isProofHost, proofVisit, readProofVisit } from "./proofVisit";

const store = () => {
  const m = new Map<string, string>();
  return { m, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("proof visit — host check", () => {
  it("only the exact local host names", () => {
    expect(isProofHost("localhost")).toBe(true);
    expect(isProofHost("127.0.0.1")).toBe(true);
    expect(isProofHost("LOCALHOST")).toBe(true);
    for (const h of ["arborparentingapp.com", "localhost.evil.com", "evil-localhost", "127.0.0.2", "0.0.0.0", "[::1]", "192.168.1.10", "", null, undefined]) {
      expect(isProofHost(h as string), String(h)).toBe(false);
    }
  });

  it("on any other host the parameter does nothing", () => {
    expect(readProofVisit({ hostname: "arborparentingapp.com", search: "?proof=sneak&lang=he&age=5" })).toBeNull();
    const s = store();
    expect(initProofVisit({ hostname: "staging.example.app", search: "?proof=sneak" }, s)).toBeNull();
    expect(s.m.size).toBe(0);
    expect(proofVisit()).toBeNull();
  });

  it("without the parameter nothing changes, even locally", () => {
    for (const search of ["", "?cb=3", "?proof=other", "?proof="]) {
      const s = store();
      expect(initProofVisit({ hostname: "localhost", search }, s)).toBeNull();
      expect(s.m.size).toBe(0);
    }
  });
});

describe("proof visit — what it applies", () => {
  it("sets the flag and opens Kid Mode in the game; lang and age are optional and validated", () => {
    expect(readProofVisit({ hostname: "localhost", search: "?proof=sneak" })).toEqual({ game: "sneak", lang: null, age: null });
    expect(readProofVisit({ hostname: "127.0.0.1", search: "?proof=sneak&lang=he&age=5" })).toEqual({ game: "sneak", lang: "he", age: 5 });
    expect(readProofVisit({ hostname: "localhost", search: "?proof=sneak&lang=fr&age=99" })).toEqual({ game: "sneak", lang: null, age: null });
    expect(readProofVisit({ hostname: "localhost", search: "?proof=sneak&age=4.5" })?.age).toBeNull();
    const s = store();
    const v = initProofVisit({ hostname: "localhost", search: "?proof=sneak&lang=he&age=4" }, s);
    expect(v).toEqual({ game: "sneak", lang: "he", age: 4 });
    expect(proofVisit()).toEqual(v);
    expect(s.m.get("arbor.flags.sneakFreeze")).toBe("1");
    expect(JSON.parse(s.m.get("arbor.kidmode.active") as string)).toEqual({ open: true, view: "arcade", worldId: "sneak" });
    expect(s.m.get("arbor.uiLang")).toBe("he");
    // No language given: the app's language is left alone.
    const t = store();
    applyProofVisit({ game: "sneak", lang: null, age: null }, t);
    expect(t.m.has("arbor.uiLang")).toBe(false);
    initProofVisit(null, null);
  });
});
