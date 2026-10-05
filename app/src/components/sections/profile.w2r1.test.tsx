/**
 * W2-GROWTH critic round 1 (#/profile) + B-GROWTH-NEW-1E/1F — rendered guards
 * with the REAL dictionaries (EN + HE):
 *  - Law 8: no stored English language name ("Hebrew", "English") and no raw
 *    behaviour type ("Moment") on the Hebrew page; each identity segment is
 *    its own bidi island.
 *  - The "Now" chapter (a joyful Moment in coral, "marked resolved") is CUT.
 *  - Law 1: the milestones chapter is a plain count — no "of {total}" / "מתוך".
 *  - The identity band quotes one kept fact (ProfileKnowsLine) instead of the
 *    telemetry row; pending facts are decided here (Keep stamped).
 *  - PhysicalGrowthCard drops its nested eyebrow inside the disclosure and its
 *    no-name fallback is keyed.
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
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: {
      id: "c1", name: h.name, age: 3, birthDate: "2023-08-01", languages: ["Hebrew", "English"],
      schoolContext: "City kindergarten, first year", challenges: [], strengths: [], interests: [],
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
});

describe("#/profile Hebrew page — no Latin chrome (Law 8)", () => {
  it("language names render in Hebrew in the identity line, the Who field and the language chapter", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(html);
    expect(s).not.toMatch(/\bHebrew\b(?! when)/); // the parent's quoted fact may say "Hebrew"
    expect(s).not.toMatch(/\bEnglish\b/);
    expect(s).toContain("עברית");
    expect(s).toContain("אנגלית");
    expect(s).not.toMatch(/\bMoment\b/);
  });
  it("each identity segment is its own bidi island (City … first year stays whole)", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const line = html.slice(html.indexOf('data-testid="profile-identity-line"'), html.indexOf("</p>", html.indexOf('data-testid="profile-identity-line"')));
    expect(line).toContain('<bdi dir="auto">City kindergarten, first year</bdi>');
    // W2-GROWTH r2 (B-33): the languages are ONE segment (with its as-of month when dated).
    expect(line).toMatch(/<bdi dir="auto">עברית · אנגלית[^<]*<\/bdi>/);
    expect(line.match(/<bdi dir="auto">/g)!.length).toBe(3);
  });
});

describe("#/profile — the cut chapter, the count and the knows line", () => {
  it("the 'Now' chapter is gone: no coral moment card, no 'marked resolved'", () => {
    h.locale = "en";
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain('data-module="profile-now"');
    expect(html).not.toContain("marked resolved");
    expect(html).not.toContain(translate("en", "cp.ch.now"));
  });
  it("the milestones chapter is a plain count with no denominator (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      h.locale = locale;
      const s = text(renderToStaticMarkup(<ChildProfile />));
      expect(s).toContain(translate(locale, "elev.profile.ms.noticedOne"));
      expect(s).not.toMatch(/\d+ of \d+ noticed|מתוך/);
    }
  });
  it("the identity band quotes one kept fact, with the month — and no count row", () => {
    h.locale = "en";
    const html = renderToStaticMarkup(<ChildProfile />);
    const band = html.slice(0, html.indexOf("</header>"));
    expect(band).toContain('data-testid="profile-knows-line"');
    // B-GROWTH-NEW-2F: the line names the child.
    expect(band).toMatch(/What Arbor knows about (⁨)?Dylan(⁩)?:/);
    expect(band).toContain("Dylan answers in Hebrew when tired");
    expect(band).toMatch(/kept since September 2026/);
    expect(band).not.toMatch(/\d+ (child|children|family members?|captured moments)/);
  });
  it("nothing approved, nothing pending: the band invites one fact (the stamped zero state)", () => {
    h.locale = "en";
    h.approved = [];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toMatch(/data-testid="profile-hero-cta" data-primary-move="approve-memory"/);
    expect(html).toContain("Tell Arbor one thing about Dylan worth remembering.");
  });
  it("pending facts are decided here: up to three, Keep / Not quite / Forget, one stamp", () => {
    h.locale = "he";
    h.pending = [1, 2, 3, 4].map((n) => ({ memoryId: `p${n}`, fact: `fact ${n}`, status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }));
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html.match(/data-testid="profile-remember-fact"/g)).toHaveLength(3);
    expect(html.match(/data-primary-move="approve-memory"/g)).toHaveLength(1);
    expect(html).toContain(translate("he", "elev.profile.remember.keep"));
    expect(html).toContain(translate("he", "elev.profile.remember.notQuite"));
    expect(html).toContain(translate("he", "elev.profile.remember.forget"));
    expect(html.indexOf('data-module="profile-remember"')).toBeLessThan(html.indexOf('data-module="profile-who"'));
  });
  it("W2-GROWTH r2 (P0): the first fold is identity → working on → the first pending fact's Keep; nothing else sits above Keep (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      h.locale = locale;
      h.pending = [{ memoryId: "p1", fact: "fact 1", status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }];
      const html = renderToStaticMarkup(<ChildProfile />);
      const keep = html.indexOf('data-testid="profile-remember-keep"');
      const above = html.slice(0, keep);
      expect(keep).toBeGreaterThan(-1);
      expect(above).toContain('data-testid="profile-identity-line"');
      expect(above).toContain('data-testid="profile-goals"');
      // the knows-line, Ask Arbor and Create hero all sit BELOW the decision
      expect(above).not.toContain('data-testid="profile-knows-line"');
      expect(html.indexOf('data-testid="profile-knows-line"')).toBeGreaterThan(keep);
      expect(above).not.toContain(translate(locale, "cp.askAbout", { name: "Dylan" }));
      expect(above).not.toContain(translate(locale, "cp.hero.subline"));
      // at lg the band is a column beside the identity (grid lines mirror in RTL)
      expect(html).toMatch(/data-testid="profile-fold" class="[^"]*lg:grid lg:grid-cols-2/);
      expect(html).toMatch(/data-module="profile-remember"[^>]*class="[^"]*lg:col-start-2 lg:row-start-1/);
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
