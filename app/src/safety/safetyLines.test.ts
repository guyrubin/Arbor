/**
 * v3 EXTRA-CARE — the Care landing's "Help and safety" card offers the SAME
 * lines Safety does (safety/safetyLines mirrors SafetyTab's selection; this
 * file fails the moment the two drift).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { HELPLINE_DIRECTORY, dangerLineFor, helplineOrderFor } from "./escalation";
import { careSafetyLines, dialablePhone, firstDialableContact, readSafetyReviewed, safetyHint, safetyLinesFor, safetyReviewedKey } from "./safetyLines";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Pick<Storage, "getItem" | "setItem"> }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  };
});

describe("careSafetyLines — the emergency line and the family's own talk line", () => {
  it("EN (no market): the EU emergency number; no foreign talk line, the by-country list instead", () => {
    expect(careSafetyLines("en")).toEqual({ emergency: HELPLINE_DIRECTORY.find((h) => h.id === "eu_112"), talk: null, findLine: true });
  });

  it("HE: MDA 101 for an emergency and ERAN 1201 to talk", () => {
    const lines = careSafetyLines("he");
    expect(lines.emergency?.id).toBe("il_mda");
    expect(lines.emergency?.tel).toBe("101");
    expect(lines.talk?.id).toBe("il_eran");
    expect(lines.talk?.tel).toBe("1201");
    expect(lines.findLine).toBe(false);
  });

  it("an attribution market names the region before the UI language (NL family, EN interface)", () => {
    store.set("arbor.attribution", JSON.stringify({ market: "nl", source: "direct" }));
    expect(safetyHint("en")).toBe("nl");
    const lines = careSafetyLines("en");
    expect(lines.talk?.id).toBe("nl_113");
    expect(lines.emergency?.id).toBe("eu_112");
    // a market Safety does not name a region by (uk) leaves the UI language
    store.set("arbor.attribution", JSON.stringify({ market: "uk", source: "direct" }));
    expect(safetyHint("he")).toBe("he");
  });

  it("matches Safety's own selection for every hint", () => {
    for (const hint of ["en", "he", "nl", "be", "us", "fr"]) {
      const order = helplineOrderFor(hint);
      const primary = HELPLINE_DIRECTORY.find((h) => h.region === order[0])!;
      const expected = safetyLinesFor(hint);
      expect(expected.order).toEqual(order);
      expect(expected.primary).toEqual(primary);
      expect(expected.danger).toEqual(dangerLineFor(order, primary));
    }
  });
});

describe("the first saved contact and the reviewed note", () => {
  it("firstDialableContact: the first row only, with a dialable phone", () => {
    expect(firstDialableContact([])).toBeNull();
    expect(firstDialableContact([{ name: "Aunt Lea", phone: "" }, { name: "Neighbour", phone: "050 000 0000" }])).toBeNull();
    expect(firstDialableContact([{ name: " Aunt Lea ", phone: "+31 6 0000 0000" }])).toEqual({ name: "Aunt Lea", phone: "+31 6 0000 0000", tel: "+31600000000" });
    expect(dialablePhone("(050) 000-0000")).toBe("0500000000");
  });

  it("reads the device-local note Safety writes", () => {
    expect(readSafetyReviewed("c1")).toBeNull();
    store.set(safetyReviewedKey("c1"), "2026-10-01T10:00:00.000Z");
    expect(readSafetyReviewed("c1")).toBe("2026-10-01T10:00:00.000Z");
  });
});

describe("drift with SafetyTab", () => {
  const safety = readFileSync("src/components/tabs/SafetyTab.tsx", "utf8");
  it("the same reviewed key, the same market hint, every directory region", () => {
    expect(safety).toContain("`arbor.safetyReviewed.${childProfile.id}`");
    expect(safetyReviewedKey("X")).toBe("arbor.safetyReviewed.X");
    expect(safety).toContain('const hint = market && ["il", "nl", "be"].includes(market) ? market : uiLang;');
    expect(safety).toContain('const HELPLINE_GROUPS: readonly HelplineRegion[] = ["il", "eu", "nl", "be", "us"];');
    expect([...new Set(HELPLINE_DIRECTORY.map((h) => h.region))].sort()).toEqual(["be", "eu", "il", "nl", "us"]);
    expect(safety).toContain("const primaryHelpline = HELPLINE_DIRECTORY.find((h) => h.region === helplineOrder[0]) ?? HELPLINE_DIRECTORY[0];");
    expect(safety).toContain("const dangerLine = dangerLineFor(helplineOrder, primaryHelpline);");
  });
});
