/**
 * W2-GROWTH critic round 1 (#/profile) + B-GROWTH-NEW-1E/1F — rendered guards
 * with the REAL dictionaries (EN + HE):
 *  - Law 8: no stored English language name ("Hebrew", "English") and no raw
 *    behaviour type ("Moment") on the Hebrew page; each Details segment is
 *    its own bidi island.
 *  - The "Now" chapter (a joyful Moment in coral, "marked resolved") is CUT.
 *  - Law 1: nothing on About is counted against a total — no "of {total}" / "מתוך".
 *  - PhysicalGrowthCard drops its nested eyebrow inside the disclosure and its
 *    no-name fallback is keyed.
 * v3 F-CHILD-3 re-pin: #/profile is About — the describe card, the eight
 * areas (each told line dated, a proposal waiting in its area with Confirm /
 * No) and one Details row. The identity band, the knows-line and the
 * milestones chapter left the page.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  locale: "he" as "en" | "he",
  pending: [] as unknown[],
  approved: [] as unknown[],
  name: "Dylan",
  factsAsOf: undefined as undefined | Record<string, string>,
  onboardingCompletedAt: undefined as undefined | string,
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: {
      id: "c1", name: h.name, age: 3, birthDate: "2023-08-01", languages: ["Hebrew", "English"],
      schoolContext: "City kindergarten, first year", challenges: [], strengths: [], interests: [],
      factsAsOf: h.factsAsOf, onboardingCompletedAt: h.onboardingCompletedAt,
    },
    milestones: [
      { id: "m1", domain: "language_communication", title: "t1", description: "d", checked: true, ageMonths: 36 },
      { id: "m2", domain: "language_communication", title: "t2", description: "d", checked: false, ageMonths: 36 },
    ],
    behaviorLogs: [{ id: "b1", timestamp: new Date().toISOString(), behaviorType: "Moment", intensity: 1, durationMinutes: 0, trigger: "", resolved: true }],
    playLogs: [], actionPlans: [],
    approvedMemoryItems: h.approved, pendingMemoryItems: h.pending,
    setActiveTab: () => {}, updateChild: async () => {}, handleMemoryDecision: async () => true, isMemoryUpdating: null,
  }),
  useArborOptional: () => null,
}));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ profiles: [{ id: "c1" }] }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Parent" } }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: h.locale, t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v) }),
}));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null, useHeroAvatar: () => ({ hasHero: true, name: "Dylan" }) }));
vi.mock("../../lib/api", () => ({ api: { listShares: () => Promise.resolve({ shares: [] }) } }));
vi.mock("../profile/ProfileEditDrawer", () => ({ default: () => null }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: async () => {}, remove: async () => {} }),
}));

import ChildProfile from "./ChildProfile";
import PhysicalGrowthCard from "./PhysicalGrowthCard";

const text = (html: string) =>
  html.replace(/<span class="msr\b[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

beforeEach(() => {
  h.locale = "he";
  h.pending = [];
  h.approved = [{ memoryId: "a1", fact: "Dylan answers in Hebrew when tired", status: "approved", createdAt: "2026-09-02T10:00:00.000Z", source: "chat", retention: "90d" }];
  h.name = "Dylan";
  h.factsAsOf = undefined;
});

const area = (html: string, id: string) => html.slice(html.indexOf(`data-testid="about-aspect-${id}"`), html.indexOf("</article>", html.indexOf(`data-testid="about-aspect-${id}"`)));
const detailsLine = (html: string) => html.slice(html.indexOf('data-testid="profile-identity-line"'), html.indexOf("</span>", html.indexOf('data-testid="profile-identity-line"')));

describe("#/profile Hebrew page — no Latin chrome (Law 8)", () => {
  it("language names render in Hebrew in the talking area's role rows", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(html);
    expect(s).not.toMatch(/\bHebrew\b(?! when)/); // the parent's quoted fact may say "Hebrew"
    expect(s).not.toMatch(/\bEnglish\b/);
    const roles = text(html.slice(html.indexOf('data-testid="about-lang-roles"'), html.indexOf("</dl>", html.indexOf('data-testid="about-lang-roles"'))));
    expect(roles).toContain(translate("he", "elev.growthTruth.lang.role.home"));
    expect(roles).toContain("עברית");
    expect(roles).toContain(translate("he", "elev.growthTruth.lang.role.second"));
    expect(roles).toContain("אנגלית");
    expect(s).not.toMatch(/\bMoment\b/);
  });
  it("each Details segment is its own bidi island (name · age · birth date)", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const line = detailsLine(html);
    expect(line).toContain('<bdi dir="auto">Dylan</bdi>');
    expect(line.match(/<bdi dir="auto">/g)!.length).toBe(3);
    expect(text(line)).toContain("2023");
  });
  it("critic r1: the h1 keeps the page direction (no dir); the name is isolated inside the sentence", () => {
    for (const loc of ["en", "he"] as const) {
      h.locale = loc;
      const html = renderToStaticMarkup(<ChildProfile />);
      const h1 = html.slice(html.indexOf("<h1"), html.indexOf("</h1>"));
      expect(h1).not.toMatch(/\sdir=/);
      expect(h1).toContain(loc === "he" ? "⁨Dylan⁩" : "Dylan");
    }
  });
  it("critic r1 (B-GROWTH-35 seam): the school setting carries its day in both locales", () => {
    h.factsAsOf = { schoolContext: "2026-09-01T10:00:00.000Z" };
    for (const loc of ["en", "he"] as const) {
      h.locale = loc;
      const school = text(area(renderToStaticMarkup(<ChildProfile />), "school")).replace(/\s+/g, " ");
      expect(school).toContain("City kindergarten, first year");
      expect(school).toMatch(loc === "en" ? /In your words · Sep 1, 2026/ : /מהמילים שלכם · [^·]*2026/);
    }
  });
});

describe("critic r1 (P0) → v3 F-CHILD-3 — a pending inference is Arbor's proposal, never 'you wrote'", () => {
  for (const loc of ["en", "he"] as const) {
    it(`${loc}: the proposal waits in its area, labelled as Arbor's, with Confirm / No; nothing is counted`, () => {
      h.locale = loc;
      h.pending = [{ memoryId: "p1", fact: "Mornings go smoother when his bag is packed the night before.", status: "pending", createdAt: "2026-10-05T10:00:00.000Z", source: "chat", retention: "90d" }];
      const html = renderToStaticMarkup(<ChildProfile />);
      expect(html.match(/data-testid="about-aspect-pending"/g)).toHaveLength(1);
      const routine = area(html, "routine");
      const box = text(routine.slice(routine.indexOf(">", routine.indexOf('data-testid="about-aspect-pending"')) + 1)).replace(/\s+/g, " ").trim();
      expect(box.startsWith(translate(loc, "companion.about.pending").trim())).toBe(true);
      expect(box).toContain("Mornings go smoother");
      expect(box).toContain(translate(loc, "companion.about.confirm"));
      expect(box).toContain(translate(loc, "companion.about.dismiss"));
      expect(text(html)).not.toMatch(/From what you wrote|ממה שכתבתם/);
      expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
      const doorAt = html.indexOf('data-testid="profile-remember-check"');
      const door = text(html.slice(html.indexOf(">", doorAt) + 1, html.indexOf("</button>", doorAt)));
      expect(door).not.toMatch(/\d/);
    });
  }
});

describe("#/profile — the cut chapters, the count line and the dated areas", () => {
  it("the 'Now' chapter is gone: no coral moment card, no 'marked resolved'", () => {
    h.locale = "en";
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain('data-module="profile-now"');
    expect(html).not.toContain("marked resolved");
    expect(html).not.toContain(translate("en", "cp.ch.now"));
  });
  it("the milestones chapter left About (Milestones owns it); nothing carries a denominator (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      h.locale = locale;
      const html = renderToStaticMarkup(<ChildProfile />);
      const s = text(html);
      expect(html).not.toContain('data-module="profile-milestones"');
      expect(s).not.toContain(translate(locale, "elev.profile.ms.noticedOne"));
      expect(s).not.toMatch(/\d+ of \d+|\bof 8\b|מתוך|%/);
    }
  });
  it("a kept fact is quoted once, in its area, with its day — and no count row", () => {
    h.locale = "en";
    const html = renderToStaticMarkup(<ChildProfile />);
    const lang = text(area(html, "lang")).replace(/\s+/g, " ");
    expect(lang).toContain("Dylan answers in Hebrew when tired");
    expect(lang).toContain("Noted · Sep 2, 2026");
    expect(html.split("Dylan answers in Hebrew when tired").length - 1).toBe(1);
    expect(html).not.toMatch(/\d+ (child|children|family members?|captured moments)/);
  });
  it("nothing approved, nothing pending: the voice door is the stamped zero state; the count line counts told areas only", () => {
    h.locale = "en";
    h.approved = [];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toMatch(/data-testid="about-voice" data-primary-move="capture-moment"/);
    expect(html).toContain(translate("en", "companion.about.voice"));
    // languages + the school setting are told; neither carries a day here
    expect(text(html.replace(/&#x27;/g, "'")).replace(/\s+/g, " ")).toContain(translate("en", "companion.about.toldManyUndated", { n: 2 }));
  });
  it("many proposals: still one stamp, one memory door; a proposal that names no area stays on #/memory", () => {
    h.locale = "he";
    h.pending = [1, 2, 3, 4].map((n) => ({ memoryId: `p${n}`, fact: `fact ${n}`, status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }));
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain('data-testid="about-aspect-pending"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="about-voice" data-primary-move="capture-moment"/);
    expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
    expect(html.split("Dylan answers in Hebrew when tired").length - 1).toBe(1);
  });
  it("the first fold is the describe card → the eight areas → Details (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      h.locale = locale;
      h.pending = [{ memoryId: "p1", fact: "fact 1", status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }];
      const html = renderToStaticMarkup(<ChildProfile />);
      const order = ['data-module="about-describe"', 'data-testid="about-told-line"', 'data-testid="about-voice"', 'data-testid="about-write"', 'data-module="about-aspects"', 'data-testid="profile-remember-check"', 'data-module-disclosure="about-details"'].map((m) => html.indexOf(m));
      expect(order.every((at) => at > -1)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(html).not.toContain(translate(locale, "cp.askAbout", { name: "Dylan" }));
      expect(html).not.toContain('data-testid="profile-goals"');
    }
  });
});

describe("PhysicalGrowthCard inside the Measurements disclosure", () => {
  it("drops the nested eyebrow when embedded; keeps it standalone", () => {
    h.locale = "en";
    const eyebrow = translate("en", "growth.eyebrow");
    expect(text(renderToStaticMarkup(<PhysicalGrowthCard embedded />))).not.toContain(eyebrow);
    expect(text(renderToStaticMarkup(<PhysicalGrowthCard />))).toContain(eyebrow);
  });
  it("the no-name fallback is keyed (Hebrew, never 'your child')", () => {
    h.locale = "he";
    h.name = "";
    const s = text(renderToStaticMarkup(<PhysicalGrowthCard embedded />));
    expect(s).not.toContain("your child");
  });
});

describe("P1-NEXTLEVEL critic r2 — Profile never counts the approval queue", () => {
  it("no profile remembers/check string carries a {n} (EN + HE); the count lives on #/memory", async () => {
    const dict = await import("../../lib/i18nElevation/careprofile");
    for (const table of [dict.en, dict.he]) {
      const keys = Object.keys(table).filter((k) => k.startsWith("elev.profile.remembers."));
      expect(keys.length).toBeGreaterThan(2);
      for (const k of keys) expect(table[k], k).not.toContain("{n}");
    }
    expect(dict.he["elev.profile.remembers.title"]).toBe("דברים שארבור זוכרת"); // one grammatical gender with "ארבור יודעת"
  });
});

describe("P1-NEXTLEVEL critic r2 — an identity fact is never undated", () => {
  it("a legacy profile (no factsAsOf) dates school + languages from onboarding, EN + HE", () => {
    h.factsAsOf = undefined;
    h.onboardingCompletedAt = "2026-06-10T10:00:00.000Z";
    try {
      for (const loc of ["en", "he"] as const) {
        h.locale = loc;
        const html = renderToStaticMarkup(<ChildProfile />);
        const lead = translate(loc, "companion.milestones.srcWords", { date: "@@" }).split("@@")[0];
        for (const id of ["school", "lang"]) {
          const src = text(area(html, id)).replace(/\s+/g, " ");
          expect(src, id).toContain(lead.trim());
          expect(src, id).toMatch(/2026/);
        }
        // every told area is dated, so the count line says so
        expect(text(html.replace(/&#x27;/g, "'")).replace(/\s+/g, " ")).toContain(translate(loc, "companion.about.toldMany", { n: 2 }));
      }
    } finally {
      h.onboardingCompletedAt = undefined;
    }
  });
});
