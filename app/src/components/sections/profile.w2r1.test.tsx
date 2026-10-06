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
  it("critic r1: the h1 keeps the page direction (no dir), only the name is isolated", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const h1 = html.slice(html.indexOf("<h1"), html.indexOf("</h1>"));
    expect(h1).not.toMatch(/\sdir=/);
    expect(h1).toContain("<bdi>Dylan</bdi>");
  });
  it("critic r1 (B-GROWTH-35 seam): the school setting carries its as-of month in both locales", () => {
    h.factsAsOf = { schoolContext: "2026-09-01T10:00:00.000Z" };
    for (const loc of ["en", "he"] as const) {
      h.locale = loc;
      const html = renderToStaticMarkup(<ChildProfile />);
      const line = html.slice(html.indexOf('data-testid="profile-identity-line"'), html.indexOf("</p>", html.indexOf('data-testid="profile-identity-line"')));
      expect(line).toMatch(loc === "en" ? /City kindergarten, first year[⁨⁩]* \(as of [^)]+\)/ : /City kindergarten, first year[⁨⁩]* \(נכון ל[^)]+\)/);
    }
  });
});

describe("critic r1 (P0) → B-SHELL-26 — a pending inference is Arbor's, never 'you wrote', and never decided on Profile", () => {
  for (const loc of ["en", "he"] as const) {
    it(`${loc}: one quiet line says Arbor has a thought to check; the inference's words stay on #/memory`, () => {
      h.locale = loc;
      h.pending = [{ memoryId: "p1", fact: "Mornings go smoother when his bag is packed the night before.", status: "pending", createdAt: "2026-10-05T10:00:00.000Z", source: "chat", retention: "90d" }];
      const html = renderToStaticMarkup(<ChildProfile />);
      // P1-NEXTLEVEL critic r2: the line NAMES the newest inference by its
      // topic and never counts (no digit); the words stay on #/memory.
      const at = html.indexOf('data-testid="profile-remember-check"');
      const line = text(html.slice(html.indexOf(">", at) + 1, html.indexOf("</button>", at))).trim();
      const lead = translate(loc, "elev.profile.remembers.noticedAbout", { topic: "@@" }).split("@@")[0].replace(/[⁨⁩]/g, "");
      expect(line.startsWith(lead) || line.includes(translate(loc, "elev.profile.remembers.noticed")), line).toBe(true);
      expect(line).not.toMatch(/\d/);
      expect(html).toContain('data-testid="profile-remember-check"');
      expect(text(html)).not.toContain("Mornings go smoother");
      expect(text(html)).not.toMatch(/From what you wrote|ממה שכתבתם/);
    });
  }
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
  it("nothing approved, nothing pending: the door invites one fact (the stamped zero state)", () => {
    h.locale = "en";
    h.approved = [];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toMatch(/data-testid="profile-hero-cta" data-primary-move="capture-moment"/);
    expect(html).toContain("Tell Arbor one thing about Dylan worth remembering.");
    expect(html).not.toContain('data-module="profile-remember"');
  });
  it("B-SHELL-26: pending inferences are not decided here — no Keep / Not quite, one quiet line, one stamp", () => {
    h.locale = "he";
    h.pending = [1, 2, 3, 4].map((n) => ({ memoryId: `p${n}`, fact: `fact ${n}`, status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }));
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain('data-testid="profile-remember-fact"');
    expect(html).not.toContain('data-testid="profile-remember-keep"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="profile-hero-cta" data-primary-move="capture-moment"/);
    expect(html).not.toContain(translate("he", "elev.profile.remember.keep"));
    expect(html).not.toContain(translate("he", "elev.profile.remember.notQuite"));
    expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
    // P1-NEXTLEVEL critic r2: the one kept fact is the knows-line quote, so
    // the list (which starts after it) is empty — the fact renders ONCE.
    expect(html).not.toContain('data-testid="profile-remembered-forget"');
    expect(html.split("Dylan answers in Hebrew when tired").length - 1).toBe(1);
    expect(html.indexOf('data-module="profile-remember"')).toBeLessThan(html.indexOf('data-module="profile-who"'));
  });
  it("W2-GROWTH r2 → B-SHELL-26: the first fold is identity → working on → the knows-line → the one door (EN + HE)", () => {
    for (const locale of ["en", "he"] as const) {
      h.locale = locale;
      h.pending = [{ memoryId: "p1", fact: "fact 1", status: "pending", createdAt: "2026-10-02T10:00:00.000Z", source: "chat", retention: "90d" }];
      const html = renderToStaticMarkup(<ChildProfile />);
      const door = html.indexOf('data-testid="profile-hero-cta"');
      const above = html.slice(0, door);
      expect(door).toBeGreaterThan(-1);
      expect(above).toContain('data-testid="profile-identity-line"');
      expect(above).toContain('data-testid="profile-goals"');
      expect(above).toContain('data-testid="profile-knows-line"');
      expect(above).not.toContain(translate(locale, "cp.askAbout", { name: "Dylan" }));
      expect(above).not.toContain(translate(locale, "cp.hero.subline"));
      // at lg the remembered band is a column beside the identity (grid lines mirror in RTL)
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
        const line = html.slice(html.indexOf('data-testid="profile-identity-line"'), html.indexOf("</p>", html.indexOf('data-testid="profile-identity-line"')));
        const asOf = loc === "en" ? /\(as of [^)]+\)/g : /\(נכון ל[^)]+\)/g;
        expect(line.match(asOf), line).toHaveLength(2);
      }
    } finally {
      h.onboardingCompletedAt = undefined;
    }
  });
});
