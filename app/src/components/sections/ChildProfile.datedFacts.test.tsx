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
  name: "Dylan",
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
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null, useHeroAvatar: () => ({ hasHero: true, name: "Dylan" }) }));
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
  h.name = "Dylan";
  h.factsAsOf = undefined;
});

describe("B-GROWTH-35 — a fact with a relative time carries the day it was written", () => {
  it("EN: 'written 10 Jun 2026:' before the fact; the fact is unchanged", () => {
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(html).replace(/\s+/g, " ");
    expect(html).toContain('data-testid="profile-fact-written"');
    expect(s).toContain("written Jun 10, 2026:");
    expect(s).toContain("Entering Bilingual Kindergarten in 3 months");
    // the "kept since" suffix gives way to the written date (one date, not two)
    expect(s).not.toContain("kept since");
  });

  it("HE: 'נכתב ב־…' before a Hebrew fact with בעוד", () => {
    h.locale = "he";
    h.approved = [{ memoryId: "a2", fact: "דילן מתחיל גן חדש בעוד חודשיים", status: "approved", createdAt: "2026-06-10T10:00:00.000Z", source: "chat", retention: "90d" }];
    const html = renderToStaticMarkup(<ChildProfile />);
    const s = text(html).replace(/\s+/g, " ");
    expect(html).toContain('data-testid="profile-fact-written"');
    expect(s).toContain("נכתב ב־");
    expect(s).toContain("ביוני 2026");
    expect(s).toContain("דילן מתחיל גן חדש בעוד חודשיים");
  });

  it("a fact without a relative time renders as before (no written date)", () => {
    h.approved = [{ memoryId: "a3", fact: "Dylan answers in Hebrew when tired", status: "approved", createdAt: "2026-06-10T10:00:00.000Z", source: "chat", retention: "90d" }];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain('data-testid="profile-fact-written"');
  });
});

describe("B-GROWTH-35 — the relative-time pattern list (EN + HE)", () => {
  it("detects the listed phrases and nothing else", () => {
    for (const yes of ["Entering kindergarten in 3 months", "starts daycare next week", "moving next month", "in a few weeks she starts", "two weeks from now", "בעוד שלושה חודשים", "מתחיל גן בשבוע הבא", "עוברים דירה בחודש הבא", "בשנה הבאה לכיתה א"]) {
      expect(hasRelativeTime(yes), yes).toBe(true);
    }
    for (const no of ["Dylan answers in Hebrew when tired", "loves trains", "in the morning he is slow", "אוהב רכבות", "Born in 2023"]) {
      expect(hasRelativeTime(no), no).toBe(false);
    }
  });
});
