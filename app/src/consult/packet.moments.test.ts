import { describe, it, expect } from "vitest";
import {
  buildConsultPacket,
  buildSharedScopePacket,
  itemText,
  sectionTitle,
  serializeForExport,
  type BuildPacketInput,
} from "./packet";
import { buildMomentLog } from "../content/behaviorTaxonomy";
import { WEEK_SHARE_SCOPES } from "../lib/shareScopes";
import { he as dictHe } from "../lib/i18n";
import { en as careEn, he as careHe } from "../lib/i18nElevation/careHonesty";

/* W2-CAREPRO c2 r1 — the consult/sharing critics (product P0/P1, design P1):
 *  1. The Development snapshot was an x-of-y scoreboard ("0 of 21 milestones
 *     on the 3 years checklists", "Language & communication: 0 of 8") in every
 *     egress, the co-parent's week share included, and it contradicted its own
 *     "Observed (5)" list. Now: numerator-only, one count source.
 *  2. A joyful Moment stores its words in `trigger` (buildMomentLog), so it was
 *     exported as "What we noticed came first" and as "Moment: 12 times" beside
 *     Transition Refusal. Now: incidents only in patterns/triggers; moments are
 *     quoted as moments in their own section. */

const NOW = Date.UTC(2026, 9, 5, 12);
const DAY = 86_400_000;
const moment = (text: string, daysAgo: number) => {
  const log = buildMomentLog(text, "Home", {}, new Date(NOW - daysAgo * DAY));
  if (!log) throw new Error("fixture moment has no words");
  return log;
};

const input = (lang: "en" | "he"): BuildPacketInput => ({
  profile: { name: "Dylan", age: 3, ageMonths: 38, languages: ["Hebrew", "English"] },
  logs: [
    moment(lang === "he" ? "שיתף את המכונית האדומה עם חבר" : "Shared the red car with a friend at the park", 1),
    moment(lang === "he" ? "שר לבד את כל שיר האמבטיה" : "Sang the whole bath song on his own", 3),
    moment(lang === "he" ? "קרא למגדל בית של סבא" : "Called the tower Grandpa's house", 20),
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - 2 * DAY).toISOString(), trigger: lang === "he" ? "יציאה מהבית" : "Leaving the house" },
  ],
  milestones: [
    { domain: "language_communication", title: "Says two words together", checked: true, status: "yes", ageMonths: 24, observedAt: new Date(NOW - 4 * DAY).toISOString() },
    { domain: "social_development", title: "Notices others' feelings", checked: true, status: "yes", ageMonths: 30, observedAt: new Date(NOW - 10 * DAY).toISOString() },
    // Never asked — must not appear as a zero anywhere.
    { domain: "language_communication", title: "Talks in conversation", checked: false, ageMonths: 36 },
    { domain: "cognitive", title: "Draws a circle", checked: false, ageMonths: 36 },
  ],
  plans: [],
  memory: [],
  nowMs: NOW,
});

const DENOMINATOR = /\{\w+\}\s*(of|\/|מתוך)\s*\{\w+\}|\d+\s*(of|\/|מתוך)\s*\d+|\bof\s+\{?total\}?/i;
const render = (lang: "en" | "he", p = buildConsultPacket(input(lang))) =>
  p.sections.flatMap((s) => [sectionTitle(s, lang), ...s.items.map((i) => itemText(i, lang))]).join("\n");

describe("W2-CAREPRO c2 r1 — the snapshot is numerator-only", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no denominator in the packet, any preset export, or the week share`, () => {
      expect(render(lang)).not.toMatch(DENOMINATOR);
      for (const audience of ["pediatrician", "slp", "behavioral_health", "therapist"] as const) {
        const md = serializeForExport(audience, buildConsultPacket(input(lang)), new Set(), "", "", lang);
        expect(md, audience).not.toMatch(DENOMINATOR);
      }
      const shared = buildSharedScopePacket(WEEK_SHARE_SCOPES, false, input(lang));
      expect(render(lang, shared)).not.toMatch(DENOMINATOR);
    });
  }

  it("the count heading the section equals the length of the observed list it heads", () => {
    const dev = buildConsultPacket(input("en")).sections.find((s) => s.id === "development")!;
    const ids = dev.items.map((i) => i.id);
    expect(ids).toEqual(["dev-noticed", "dev-observed"]);
    expect(dev.items[0].text).toBe("2 milestones noticed so far (most recent 2026-10-01).");
    expect(dev.items[1].text.startsWith("Observed (2):")).toBe(true);
  });

  it("no packet dictionary key carries a denominator (EN + HE)", () => {
    const keys = Object.keys(careEn).filter((k) => k.startsWith("elev.packet."));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      expect(DENOMINATOR.test(careEn[k]), `en ${k}`).toBe(false);
      expect(careHe[k], `he twin ${k}`).toBeTruthy();
      expect(DENOMINATOR.test(careHe[k]), `he ${k}`).toBe(false);
    }
    for (const k of ["elev.packet.item.devOverall", "elev.packet.item.devOverallTotal", "elev.packet.item.devDomain"]) {
      expect(k in careEn, k).toBe(false);
      expect(k in careHe, k).toBe(false);
    }
  });

  it("HE dates read as Hebrew dates, never a raw ISO day inside an RTL line", () => {
    expect(render("he")).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("NEGATIVE CONTROL: the pre-fix lines trip the scan", () => {
    for (const pre of [
      "0 of 21 milestones on the 3 years checklists noticed so far (5 noticed in total).",
      "Language & communication: 0 of 8 noticed.",
      "{done} מתוך {total} אבני דרך",
      "0 מתוך 21",
      "{done} of {total} milestones",
    ]) expect(DENOMINATOR.test(pre), pre).toBe(true);
  });
});

describe("W2-CAREPRO c2 r1 — joy stays joy", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: a seeded Moment yields zero trigger-* items and zero 'Moment:' pattern rows`, () => {
      const p = buildConsultPacket(input(lang));
      const ids = p.sections.flatMap((s) => s.items.map((i) => i.id));
      const triggers = p.sections.find((s) => s.id === "triggers")!;
      expect(triggers.items.map((i) => i.id)).toEqual(["trigger-0"]);
      expect(ids.filter((id) => id.startsWith("trigger-"))).toHaveLength(1);
      const patterns = p.sections.find((s) => s.id === "patterns")!;
      expect(patterns.items).toHaveLength(1);
      const text = render(lang, p);
      expect(text).not.toMatch(/^Moment:/m);
      expect(text).not.toMatch(new RegExp(`^${dictHe["beh.type.moment"] ?? "רגע"}:`, "m"));
      expect(triggers.items.map((i) => itemText(i, lang)).join(" ")).not.toMatch(/red car|המכונית/);
    });

    it(`${lang}: moments are quoted as moments — newest first, inside the window, with a count`, () => {
      const p = buildConsultPacket(input(lang));
      const s = p.sections.find((x) => x.id === "moments")!;
      expect(s.items.map((i) => i.id)).toEqual(["moments-count", "moment-0", "moment-1", "moment-2"]);
      expect(s.items[1].text).toMatch(lang === "he" ? /המכונית האדומה/ : /Shared the red car/);
      expect(itemText(s.items[0], lang)).toMatch(/3/);
    });
  }

  it("the week share releases the moments section on a 7-day window (the story timeline)", () => {
    const shared = buildSharedScopePacket(WEEK_SHARE_SCOPES, false, input("en"));
    const s = shared.sections.find((x) => x.id === "moments")!;
    expect(s.items[0].text).toBe("2 moments kept in the last 7 days.");
    expect(s.items.map((i) => i.id)).toEqual(["moments-count", "moment-0", "moment-1"]);
    const patterns = shared.sections.find((x) => x.id === "patterns")!;
    expect(patterns.title).toBe("What we've been seeing (last 7 days)");
  });

  it("a non-clinician share drops a quote that trips the diagnosis scan instead of blocking the whole share", () => {
    const base = input("en");
    const withTerm = { ...base, logs: [...base.logs, moment("Teacher wondered about autism today", 0)] };
    const shared = buildSharedScopePacket(WEEK_SHARE_SCOPES, false, withTerm);
    const text = render("en", shared);
    expect(text).not.toMatch(/autism/i);
    expect(text).toMatch(/Shared the red car/);
  });
});
