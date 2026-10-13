/**
 * B-GROWTH-35 — Profile headline facts with a time in them carry a date:
 * a kept fact whose words hold a relative time ("in 3 months", "next week",
 * "בעוד") renders after "written {date}:" (EN + HE); the words are unchanged.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  locale: "he" as "en" | "he",
  pending: [] as unknown[],
  approved: [] as unknown[],
  name: "Noa",
  factsAsOf: undefined as undefined | Record<string, string>,
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: {
      id: "c1", name: h.name, age: 3, birthDate: "2023-08-01", languages: ["Hebrew", "English"],
      schoolContext: "City kindergarten, first year", challenges: [], strengths: [], interests: [],
      factsAsOf: h.factsAsOf,
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
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null, useHeroAvatar: () => ({ hasHero: true, name: "Noa" }) }));
vi.mock("../../lib/api", () => ({ api: { listShares: () => Promise.resolve({ shares: [] }) } }));
vi.mock("../profile/ProfileEditDrawer", () => ({ default: () => null }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: async () => {}, remove: async () => {} }),
}));

import ChildProfile from "./ChildProfile";
import { hasRelativeTime } from "../../lib/record/datedFact";

const text = (html: string) =>
  html.replace(/<span class="msr\b[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

beforeEach(() => {
  h.locale = "en";
  h.pending = [];
  h.approved = [{ memoryId: "a1", fact: "Entering Bilingual Kindergarten in 3 months", status: "approved", createdAt: "2026-06-10T10:00:00.000Z", source: "chat", retention: "90d" }];
  h.name = "Noa";
  h.factsAsOf = undefined;
});

// v3 F-CHILD-3 re-pin: on About every kept fact carries the day it was told
// in its area's source line ("Noted · {day}"), so a relative time ("in 3
// months") is never read as today — the "written {day}:" prefix gave way to
// the card's one date. The words are never rewritten.
const area = (html: string, id: string) => html.slice(html.indexOf(`data-testid="about-aspect-${id}"`), html.indexOf("</article>", html.indexOf(`data-testid="about-aspect-${id}"`)));

describe("B-GROWTH-35 — a fact with a relative time carries the day it was written", () => {
  it("EN: the fact sits in its area with 'Noted · Jun 10, 2026'; the fact is unchanged", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(area(html, "school")).replace(/\s+/g, " ");
    expect(s).toContain("Entering Bilingual Kindergarten in 3 months");
    expect(s).toContain("Noted · Jun 10, 2026");
    // one date, not two
    expect(s).not.toContain("kept since");
    expect(html).not.toContain('data-testid="profile-fact-written"');
  });

  it("HE: 'נרשם · …ביוני 2026' beside a Hebrew fact with בעוד", () => {
    h.locale = "he";
    h.approved = [{ memoryId: "a2", fact: "נועה מתחילה גן חדש בעוד חודשיים", status: "approved", createdAt: "2026-06-10T10:00:00.000Z", source: "chat", retention: "90d" }];
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(area(html, "school")).replace(/\s+/g, " ");
    expect(s).toContain("נרשם ·");
    expect(s).toContain("ביוני 2026");
    expect(s).toContain("נועה מתחילה גן חדש בעוד חודשיים");
  });

  it("a fact without a relative time is dated the same way (every told line carries its day)", () => {
    h.approved = [{ memoryId: "a3", fact: "Noa answers in Hebrew when tired", status: "approved", createdAt: "2026-06-10T10:00:00.000Z", source: "chat", retention: "90d" }];
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(area(html, "lang")).replace(/\s+/g, " ");
    expect(s).toContain("Noa answers in Hebrew when tired");
    expect(s).toContain("Noted · Jun 10, 2026");
    expect(html).not.toContain('data-testid="profile-fact-written"');
  });
});

describe("B-GROWTH-35 — the relative-time pattern list (EN + HE)", () => {
  it("detects the listed phrases and nothing else", () => {
    for (const yes of ["Entering kindergarten in 3 months", "starts daycare next week", "moving next month", "in a few weeks she starts", "two weeks from now", "בעוד שלושה חודשים", "מתחיל גן בשבוע הבא", "עוברים דירה בחודש הבא", "בשנה הבאה לכיתה א"]) {
      expect(hasRelativeTime(yes), yes).toBe(true);
    }
    for (const no of ["Noa answers in Hebrew when tired", "loves trains", "in the morning he is slow", "אוהב רכבות", "Born in 2023"]) {
      expect(hasRelativeTime(no), no).toBe(false);
    }
  });
});
