import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hardMomentCards } from "./hardMomentCards";
import { HARD_MOMENT_PILOT, computePilotDigest } from "./pilotRelease";
import { isPublicGuidePath, publicGuideCards, publicGuideContext, publicGuidePath, publicGuideShareUrl, readPublicGuideQuery } from "./publicHardMoments";
import { en, he } from "../lib/i18nElevation/publicGuides";

const NOW = new Date("2026-10-08T12:00:00Z");
const query = { locale: "en" as const, age: null };

describe("public hard-moment guides retain the content release boundary", () => {
  it("publishes exactly the original 25 bilingual cards, without altering any digest", () => {
    expect(hardMomentCards).toHaveLength(25);
    for (const locale of ["en", "he"] as const) {
      expect(publicGuideCards({ ...query, locale }, NOW).map((card) => card.id)).toEqual(hardMomentCards.map((card) => card.id));
    }
    for (const card of hardMomentCards) expect(computePilotDigest(card)).toBe(HARD_MOMENT_PILOT.entries[card.id]);
  });

  it("does not publish the draft pilot before its release or at/after expiry", () => {
    expect(publicGuideCards(query, new Date("2026-09-03T23:59:59Z"))).toEqual([]);
    expect(publicGuideCards(query, new Date(HARD_MOMENT_PILOT.expiresAt))).toEqual([]);
    expect(publicGuideCards(query, new Date("2027-01-01"))).toEqual([]);
  });

  it("withdrawal removes the card and withdrawal of the pack removes all cards", () => {
    expect(publicGuideCards(query, NOW, { ...HARD_MOMENT_PILOT, withdrawnIds: ["tantrum"] }).some((card) => card.id === "tantrum")).toBe(false);
    expect(publicGuideCards(query, NOW, { ...HARD_MOMENT_PILOT, status: "withdrawn" })).toEqual([]);
  });

  it("honors the reader's broad age filter instead of widening an authored age band", () => {
    expect(publicGuideCards({ ...query, age: "6-9" }, NOW).some((card) => card.id === "tantrum")).toBe(false);
    expect(publicGuideCards({ ...query, age: "2-5" }, NOW).some((card) => card.id === "homework")).toBe(false);
    expect(publicGuideCards({ ...query, age: "6-9" }, NOW).some((card) => card.id === "homework")).toBe(true);
    expect(publicGuideCards({ ...query, age: "10-12" }, NOW).some((card) => card.id === "homework")).toBe(true);
    expect(publicGuideContext(hardMomentCards[0], query, NOW).ageMonths).toBe(24);
  });
});

describe("public guide links carry generic content only", () => {
  it("drops all family, attribution, token and hash fields from the supplied origin", () => {
    const url = publicGuideShareUrl("tantrum", "he", "https://arborparentingapp.com/child/private?name=Noa&childId=123&token=secret&utm_source=private#record-456");
    expect(url).toBe("https://arborparentingapp.com/guides/tantrum?lang=he");
    expect(new URL(url!).searchParams.size).toBe(1);
    expect(publicGuideShareUrl("t-biting", "he", "https://arborparentingapp.com")).toBeNull();
    expect(publicGuideShareUrl("unknown", "en", "https://arborparentingapp.com")).toBeNull();
  });

  it("recognizes public routes without hijacking another route or accepting extra path segments", () => {
    expect(isPublicGuidePath("/guides")).toBe(true);
    expect(isPublicGuidePath("/guides/tantrum")).toBe(true);
    expect(isPublicGuidePath("/guides-extra")).toBe(false);
    expect(readPublicGuideQuery("/guides/tantrum/private", "?name=Noa&age=4&lang=fr", "he")).toEqual({ id: "unavailable", age: null, locale: "en" });
    expect(readPublicGuideQuery("/guides/", "", "he-IL")).toEqual({ id: null, age: null, locale: "he" });
    expect(readPublicGuideQuery("/guides/homework", "?lang=he&age=6-9")).toEqual({ id: "homework", age: "6-9", locale: "he" });
    expect(publicGuidePath({ id: "tantrum", locale: "he", age: "2-5" })).toBe("/guides/tantrum?lang=he&age=2-5");
  });

  it("takes the public render branch before auth-backed rendering or demo-family hydration", () => {
    const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(main).toContain("if (isPublicGuidePath(window.location.pathname)) void renderPublicGuides();");
    expect(main.indexOf("if (isPublicGuidePath")).toBeLessThan(main.indexOf("else if (firebaseEnabled) renderApp()"));
    expect(main).not.toMatch(/^import App /m);
    const surface = readFileSync(new URL("../components/behaviors/PublicGuides.tsx", import.meta.url), "utf8");
    expect(surface).not.toMatch(/useAuth|useArbor|childProfile|childName|signIn|upsert|fetch\(/);
    const share = readFileSync(new URL("../components/behaviors/PublicGuideShare.tsx", import.meta.url), "utf8");
    expect(share).toContain("await navigator.clipboard.writeText(url)");
    expect(share).not.toMatch(/childProfile|childName|parentName|behaviorLogs|actionLoop/);
  });

  it("keeps English and Hebrew chrome complete", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const value of Object.values(he)) expect(value.trim()).not.toBe("");
  });
});
