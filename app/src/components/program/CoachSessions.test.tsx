import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-10 — the guided tier (E3). Flag off → no coach surface at all (the
   program page and Care); flag on → "Your coach: {name}", four slots (week 1
   kick-off · week 3 · week 6 · wrap-up), "Book" opens the external link,
   a booked row reads "Booked for {date}" from the parent's `coachSessions`
   doc, and after the day one line asks "What did you agree to try?". Copy
   pins: the canon sentence EN + HE carries no "treat", "therapy",
   "diagnosis" or "clinical" (nor their Hebrew). Zero model calls. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", rows: {} as Record<string, unknown[]>, flag: null as string | null }));

vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "child-1", name: "Dylan", gender: "boy", dateOfBirth: "2024-05-01" }, actionLoop: [] }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_c: string, name: string) => ({
    items: state.rows[name] ?? [], loaded: true, error: false, remote: false,
    upsert: async () => undefined, remove: async () => undefined, replaceAll: async () => undefined,
  }),
}));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));

import CoachSessions, { agreeToTry, bookCoachSession, COACH_SLOTS, sessionHeld, type CoachSessionDoc } from "./CoachSessions";
import ProgramPage from "./ProgramPage";
import { GUIDED_TIER_COACH, GUIDED_TIER_FLAG_KEY, guidedTierOn } from "../../lib/entitlementsGuided";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const ENROLMENT = { id: "talk-together.2026-09-09", programId: "talk-together" };
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const noop = () => undefined;
const booked = (slot: CoachSessionDoc["slot"], day: string, agreed?: string): CoachSessionDoc => ({
  ...bookCoachSession(ENROLMENT, slot, day, undefined, NOW)!,
  ...(agreed ? { agreed } : {}),
});

const render = (lang: "en" | "he", sessions: CoachSessionDoc[] = [], onBook: (u: string) => void = noop) => {
  state.lang = lang;
  return renderToStaticMarkup(
    <CoachSessions coach={GUIDED_TIER_COACH} enrolment={ENROLMENT} sessions={sessions} now={NOW} onBook={onBook} onSave={noop} onAgree={noop} />,
  );
};

const FORBIDDEN_EN = /\btreat|\btherap|\bdiagnos|\bclinic/i;
const FORBIDDEN_HE = /טיפול|תרפי|אבחון|אבחנ|קליני/;
const COPY_KEYS = [
  "elev.program.care.guided",
  "elev.program.coach.title",
  "elev.program.coach.lede",
  ...COACH_SLOTS.map((s) => `elev.program.coach.slot.${s}`),
  "elev.program.coach.book",
  "elev.program.coach.when",
  "elev.program.coach.booked",
  "elev.program.coach.agree.q",
  "elev.program.coach.agree.saved",
  "elev.program.coach.makeGoal",
];

describe("B-PROG-10 — the flag", () => {
  const store = (v: string | null) => ({ getItem: (k: string) => (k === GUIDED_TIER_FLAG_KEY ? v : null) });
  it("off by default, on by the pilot flag or a server entitlement, fails closed", () => {
    expect(guidedTierOn({ storage: store(null) })).toBe(false);
    expect(guidedTierOn({ storage: store("0") })).toBe(false);
    expect(guidedTierOn({ storage: store("1") })).toBe(true);
    expect(guidedTierOn({ entitlement: { guidedTier: true }, storage: store(null) })).toBe(true);
    expect(guidedTierOn({ entitlement: { guidedTier: "yes" }, storage: null })).toBe(false);
    expect(guidedTierOn({ storage: { getItem: () => { throw new Error("blocked"); } } })).toBe(false);
  });

  it("the coach's name and link are documented placeholders until GUY row P6-G3", () => {
    expect(GUIDED_TIER_COACH.placeholder).toBe(true);
    expect(GUIDED_TIER_COACH.bookingUrl).toMatch(/^https:\/\//);
    expect(GUIDED_TIER_COACH.name.en).toBeTruthy();
    expect(GUIDED_TIER_COACH.name.he).toBeTruthy();
  });
});

describe("B-PROG-10 — flag off: no coach surface at all", () => {
  const install = (flag: string | null) => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === GUIDED_TIER_FLAG_KEY ? flag : null), setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0 } as unknown as Storage);
  };
  const ACTIVE = { ...ENROLMENT, startedAt: "2026-09-09", enrolledAt: "t", currentWeek: 5, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: "t" };

  it("the program page shows no coach without the flag, and the four slots with it", () => {
    state.lang = "en";
    state.rows = { programs: [ACTIVE] };
    install(null);
    const off = renderToStaticMarkup(<ProgramPage />);
    expect(off).toContain('data-testid="program-page"');
    expect(off).not.toContain('data-testid="coach-sessions"');
    expect(text(off)).not.toMatch(/coach/i);
    install("1");
    const on = renderToStaticMarkup(<ProgramPage />);
    expect((on.match(/data-testid="coach-slot"/g) || []).length).toBe(4);
    expect((on.match(/data-primary-move=/g) || []).length).toBe(1); // the coach adds no second move
    vi.unstubAllGlobals();
  });

  it("Care shows the guided sentence only when the flag is on (source pin)", () => {
    const s = readFileSync(path.resolve(__dirname, "../tabs/ConsultTab.tsx"), "utf8");
    expect(s).toMatch(/guidedTierOn\(\)\s*&&[\s\S]{0,400}elev\.program\.care\.guided/);
  });
});

describe("B-PROG-10 — flag on: four slots, Book opens the link, a booked row renders", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: "Your coach: {name}", the four slots in order, each with Book`, () => {
      const html = render(lang);
      expect(text(html)).toContain(translate(lang, "elev.program.coach.title", { name: GUIDED_TIER_COACH.name[lang] }));
      expect((html.match(/data-slot="(\w+)"/g) || []).map((m) => m.slice(11, -1))).toEqual(["kickoff", "week3", "week6", "wrapup"]);
      expect((html.match(/data-testid="coach-book"/g) || []).length).toBe(4);
      expect(loopFirewallHits(text(html))).toEqual([]);
    });

    it(`${lang}: a booked slot reads "Booked for {date}"; after the day, the agree line opens`, () => {
      const html = render(lang, [booked("kickoff", "2026-09-10"), booked("week3", "2026-10-20")]);
      const kick = html.split('data-slot="kickoff"')[1].split('data-testid="coach-slot"')[0];
      const wk3 = html.split('data-slot="week3"')[1].split('data-testid="coach-slot"')[0];
      expect(text(wk3)).toContain(lang === "en" ? "Booked for" : "נקבע ל-");
      expect(wk3).not.toContain('data-testid="coach-agree"');
      expect(kick).toContain('data-testid="coach-agree"');
      expect(text(kick)).toContain(translate(lang, "elev.program.coach.agree.q"));
      expect((html.match(/data-testid="coach-book"/g) || []).length).toBe(2);
    });
  }

  it("the agreed line is kept verbatim and shown as the family's words", () => {
    const doc = agreeToTry(booked("kickoff", "2026-09-10"), "  Wait five seconds   at bath time ", NOW);
    expect(doc.agreed).toBe("Wait five seconds at bath time");
    expect(agreeToTry(doc, "   ", NOW)).toBe(doc);
    const html = render("en", [doc]);
    expect(html).toContain('data-testid="coach-agreed"');
    expect(text(html)).toContain("Wait five seconds at bath time");
  });

  it("Book calls the opener with the configured link; the container opens it in a new browser tab", () => {
    const s = readFileSync(path.resolve(__dirname, "./CoachSessions.tsx"), "utf8");
    expect(s).toContain("props.onBook(props.coach.bookingUrl)");
    const page = readFileSync(path.resolve(__dirname, "./ProgramPage.tsx"), "utf8");
    expect(page).toMatch(/window\.open\(url, "_blank", "noopener,noreferrer"\)/);
    expect(page).toContain('useChildCollection<CoachSessionDoc>(childId, "coachSessions")');
  });

  it("the doc model: one per enrolment per slot, a valid local day, held the day after", () => {
    expect(bookCoachSession(ENROLMENT, "week6", "10/20/2026", undefined, NOW)).toBeNull();
    const d = bookCoachSession(ENROLMENT, "week6", "2026-10-20", undefined, NOW)!;
    expect(d.id).toBe("talk-together.2026-09-09.week6");
    expect(sessionHeld(d, NOW)).toBe(false);
    expect(sessionHeld(d, new Date(2026, 9, 21, 9))).toBe(true);
    expect(sessionHeld({ bookedFor: "2026-10-10" }, NOW)).toBe(false);
  });
});

describe("B-PROG-10 — copy pins: the canon sentence and the coach strings, EN + HE", () => {
  it("the Care sentence names the four sessions, the named coach and no marketplace", () => {
    const en = translate("en", "elev.program.care.guided", { name: "Dylan" });
    expect(en).toContain("four short sessions in each program");
    expect(en).toContain("named Arbor coach");
    expect(en).toContain("no marketplace");
    const he = translate("he", "elev.program.care.guided", { name: "Dylan" });
    expect(he).toContain("ארבע פגישות קצרות בכל תוכנית");
    expect(he).toContain("אין כאן שוק של אנשי מקצוע");
  });

  for (const key of COPY_KEYS) {
    it(`${key}: no treat / therapy / diagnosis / clinical, EN + HE`, () => {
      const en = translate("en", key, { name: "X", date: "1 Oct 2026" });
      const he = translate("he", key, { name: "X", date: "1 Oct 2026" });
      expect(en).not.toBe(key);
      expect(he).not.toBe(key);
      expect(en).not.toMatch(FORBIDDEN_EN);
      expect(he).not.toMatch(FORBIDDEN_HE);
      expect(loopFirewallHits(en + " " + he)).toEqual([]);
    });
  }

  it("negative control: the forbidden patterns fire", () => {
    expect(FORBIDDEN_EN.test("a claim to treat")).toBe(true);
    expect(FORBIDDEN_EN.test("therapy sessions")).toBe(true);
    expect(FORBIDDEN_HE.test("טיפול")).toBe(true);
    expect(FORBIDDEN_HE.test("אבחון")).toBe(true);
  });
});
