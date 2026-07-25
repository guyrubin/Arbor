import { describe, expect, it } from "vitest";
import { CONTENT_CONCERNS } from "./governance";
import {
  CHILD_NAME_TOKEN,
  hardMomentCards,
  publishedHardMomentCards,
  renderSayThis,
  sharedEscalation,
} from "./hardMomentCards";

describe("hard moment content pack", () => {
  it("contains 25 unique bilingual governed cards", () => {
    expect(hardMomentCards).toHaveLength(25);
    expect(new Set(hardMomentCards.map((item) => item.id)).size).toBe(25);
    for (const item of hardMomentCards) {
      expect(item.locales).toEqual(expect.arrayContaining(["en", "he"]));
      expect(item.title.en.trim().length).toBeGreaterThan(3);
      expect(item.title.he.trim().length).toBeGreaterThan(3);
      for (const field of [item.doNow, item.sayThis, item.avoid, item.observe, item.escalation]) {
        expect(field.en.trim().length).toBeGreaterThan(10);
        expect(field.he.trim().length).toBeGreaterThan(5);
      }
      expect(item.reviewStatus).toBe("draft");
      expect(item.reviewedBy).toBe(""); // drafts carry no named-reviewer stamp
    }
  });

  it("keeps unreviewed drafts out of product surfaces", () => {
    expect(publishedHardMomentCards).toHaveLength(0);
  });

  it("CONT-6 — every card carries >=1 concern from the controlled vocabulary and a moment", () => {
    const vocabulary = new Set<string>(CONTENT_CONCERNS);
    for (const item of hardMomentCards) {
      expect(item.concerns.length, `${item.id} has no concerns`).toBeGreaterThanOrEqual(1);
      for (const concern of item.concerns) {
        expect(vocabulary.has(concern), `${item.id} carries off-vocabulary concern "${concern}"`).toBe(true);
      }
      expect(item.moment, `${item.id} has no moment`).toBeTruthy();
    }
  });

  it("CONT-6 — concern labels are never diagnostic-shaped", () => {
    // Firewall ruling: 'separation', never 'separation-anxiety'; no condition names.
    const diagnostic = /anxiety|disorder|adhd|autism|spd|arfid|delay/i;
    for (const concern of CONTENT_CONCERNS) {
      expect(concern, `diagnostic-shaped concern label "${concern}"`).not.toMatch(diagnostic);
    }
  });

  it("CONT-3a — every card has >=1 ageBand and the bands are honest to the register", () => {
    for (const item of hardMomentCards) {
      expect(item.ageBands.length, `${item.id} has no ageBands`).toBeGreaterThanOrEqual(1);
    }
    // The three cards whose copy serves school-age children claim 6-12, not 2-5.
    for (const id of ["homework", "screen-ending", "losing-game"]) {
      const found = hardMomentCards.find((item) => item.id === id)!;
      expect(found.ageBands).toEqual(["6-9", "10-12"]);
    }
    // Toddler/preschool-register scripts no longer over-claim 6-9/10-12.
    for (const id of ["separation", "leaving-play", "toothbrushing", "clinging", "sharing"]) {
      const found = hardMomentCards.find((item) => item.id === id)!;
      expect(found.ageBands, `${id} over-claims older bands`).toEqual(["2-5"]);
    }
  });

  it("CONT-5 — no Latin proper names remain in any HE field", () => {
    // Strip the allowed personalization token, then reject any residual Latin
    // run of 2+ letters in Hebrew copy (bidi-mixed lines the parent must
    // mentally rewrite — the 'Dylan' class of defect).
    for (const item of hardMomentCards) {
      for (const field of [item.title, item.doNow, item.sayThis, item.avoid, item.observe, item.escalation]) {
        const he = field.he.split(CHILD_NAME_TOKEN).join("");
        expect(he, `Latin text in HE copy of ${item.id}`).not.toMatch(/[A-Za-z]{2,}/);
      }
    }
  });

  it("CONT-5 — no literal stranger names remain in EN say-this scripts", () => {
    for (const item of hardMomentCards) {
      expect(item.sayThis.en).not.toMatch(/\b(Dylan|Maya|Ms\.\s?Lee)\b/);
      expect(item.sayThis.he).not.toMatch(/מאיה/);
    }
  });

  it("CONT-5 — renderSayThis substitutes the active child's name in both locales", () => {
    const notListening = hardMomentCards.find((item) => item.id === "not-listening")!;
    const rendered = renderSayThis(notListening, "Noa");
    expect(rendered.en).toBe("Noa, feet on the floor, please.");
    expect(rendered.he).toBe("Noa, רגליים על הרצפה בבקשה.");
    expect(rendered.en).not.toContain(CHILD_NAME_TOKEN);
    expect(rendered.he).not.toContain(CHILD_NAME_TOKEN);
  });

  it("CONT-5 — renderSayThis falls back to neutral phrasing without a child profile", () => {
    const notListening = hardMomentCards.find((item) => item.id === "not-listening")!;
    for (const rendered of [renderSayThis(notListening), renderSayThis(notListening, "   ")]) {
      expect(rendered.en).toBe("Feet on the floor, please.");
      expect(rendered.he).toBe("רגליים על הרצפה בבקשה.");
    }
    // Cards without the token render unchanged.
    const tantrum = hardMomentCards.find((item) => item.id === "tantrum")!;
    expect(renderSayThis(tantrum, "Noa")).toEqual(tantrum.sayThis);
  });

  it("CONT-4 — >=8 higher-stakes cards carry unique moment-specific escalation in both locales", () => {
    const overridden = hardMomentCards.filter(
      (item) => item.escalation.en !== sharedEscalation.en || item.escalation.he !== sharedEscalation.he,
    );
    expect(overridden.length).toBeGreaterThanOrEqual(8);
    for (const item of overridden) {
      expect(item.escalation.en).not.toBe(sharedEscalation.en);
      expect(item.escalation.he).not.toBe(sharedEscalation.he);
      expect(item.escalation.en.trim().length).toBeGreaterThan(40);
      expect(item.escalation.he.trim().length).toBeGreaterThan(40);
      // Escalation is still clinical content: stays draft, fails closed (GD-10).
      expect(item.reviewStatus).toBe("draft");
    }
    // Escalation texts are unique per moment among the overridden set.
    expect(new Set(overridden.map((item) => item.escalation.en)).size).toBe(overridden.length);
    expect(new Set(overridden.map((item) => item.escalation.he)).size).toBe(overridden.length);
  });

  it("CONT-4 — hitting/public-meltdown/separation are not the shared fallback", () => {
    for (const id of ["hitting", "public-meltdown", "separation"]) {
      const found = hardMomentCards.find((item) => item.id === id)!;
      expect(found.escalation.en, `${id} still uses the shared fallback`).not.toBe(sharedEscalation.en);
      expect(found.escalation.he, `${id} still uses the shared fallback`).not.toBe(sharedEscalation.he);
    }
  });

  it("CONT-4 — escalation copy stays observational: no condition names or verdicts", () => {
    const banned = /\b(autism|adhd|anxiety|spd|arfid|disorder|diagnos\w*|delay(ed)?|abnormal|on[\s-]?track|behind)\b/i;
    for (const item of hardMomentCards) {
      expect(item.escalation.en, `banned token in ${item.id} escalation`).not.toMatch(banned);
    }
  });
});
