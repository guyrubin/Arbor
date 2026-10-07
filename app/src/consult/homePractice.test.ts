/**
 * B-CAREPRO-20 · the packet names the practice worlds that work the referred
 * domain — the pure matcher (audience → professions → registry domains →
 * worlds' declared domains). The rendered EN+HE panel and the "exported text
 * unchanged" check live in components/sections/consultHomePractice.test.tsx.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIENCE_PROFESSIONS, HOME_PRACTICE_MAX, domainsForAudience, homePracticeWorlds, openHomePracticeWorld } from "./homePractice";
import { EXPORT_AUDIENCES } from "./packet";
import { SPLIT_CLINICIAN_AUDIENCES } from "../content/consultPresets";
import { STUDIO_WORLDS } from "../components/practice/studioWorlds";
import { DOMAIN_IDS, isDomainId } from "../lib/domains/registry";
import { translate } from "../lib/i18n";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("B-CAREPRO-20 · worlds that work the referred domain", () => {
  it("SLP → talking → exactly Sound Lab and Word World (EN + HE names)", () => {
    expect(domainsForAudience("slp")).toEqual(["talking"]);
    const worlds = homePracticeWorlds("slp");
    expect(worlds.map((w) => w.id)).toEqual(["speech", "word-world"]);
    expect(worlds.map((w) => translate("en", w.kidNameKey))).toEqual(["Sound Lab", "Word World"]);
    expect(worlds.map((w) => translate("he", w.kidNameKey))).toEqual(["מעבדת הצלילים", "עולם המילים"]);
  });

  it("every professional audience gets two or three worlds; teacher and my-records get none", () => {
    for (const a of EXPORT_AUDIENCES) {
      const n = homePracticeWorlds(a).length;
      if (a === "teacher" || a === "self") expect(n, a).toBe(0);
      else {
        expect(n, a).toBeGreaterThanOrEqual(2);
        expect(n, a).toBeLessThanOrEqual(HOME_PRACTICE_MAX);
      }
    }
    expect(homePracticeWorlds("behavioral_health").map((w) => w.id)).toEqual(["feelings", "adventures"]);
    expect(homePracticeWorlds("pediatrician").map((w) => w.id)).toEqual(["beat", "pose"]);
  });

  it("a world whose primary domain matches ranks first; the cap holds on a wide match", () => {
    const wide = [...STUDIO_WORLDS].reverse();
    const ids = homePracticeWorlds("behavioral_health", wide).map((w) => w.id);
    expect(ids[0]).toBe("feelings"); // primary feelings beats Story Quest's secondary feelings
    expect(homePracticeWorlds("therapist").length).toBeLessThanOrEqual(HOME_PRACTICE_MAX);
  });

  it("every studio world declares at least one registry domain (spine §7b)", () => {
    expect(STUDIO_WORLDS).toHaveLength(10);
    for (const w of STUDIO_WORLDS) {
      expect(w.domains.length, w.id).toBeGreaterThan(0);
      for (const d of w.domains) expect(isDomainId(d), `${w.id}: ${d}`).toBe(true);
    }
    // B-CAREPRO-42: the audience step + the three split presets (their own chips).
    expect(Object.keys(AUDIENCE_PROFESSIONS).sort()).toEqual([...EXPORT_AUDIENCES, ...SPLIT_CLINICIAN_AUDIENCES].sort());
    expect(DOMAIN_IDS).toContain("talking");
  });

  it("tap opens the world: its own route when it has one, else Kid Mode", () => {
    const calls: string[] = [];
    const seams = { setActiveTab: (t: string) => calls.push(`tab:${t}`), openKidMode: () => calls.push("kid") };
    for (const w of homePracticeWorlds("slp")) openHomePracticeWorld(w, seams);
    expect(calls).toEqual(["tab:speech", "tab:language"]);
    calls.length = 0;
    openHomePracticeWorld(STUDIO_WORLDS.find((w) => w.id === "pose")!, seams);
    expect(calls).toEqual(["kid"]);
  });

  it("never exported: the packet serializer knows nothing about worlds", () => {
    const packetSrc = readFileSync(path.join(HERE, "packet.ts"), "utf8");
    expect(packetSrc).not.toMatch(/homePractice|STUDIO_WORLDS|studioWorlds|kidNameKey/);
  });
});
