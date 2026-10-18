/**
 * v3 EXTRA-CARE — the Care landing (#/consult), rendered at the real
 * ConsultTab in EN and HE.
 *
 * v4 re-pin (Care, together is ONE screen, no tabs). Three modules: the next
 * visit with its three prep steps (the packet, which holds the route's ONE
 * move, build-share-packet; its head now carries the door to Appointments and
 * its builder the Visit summary | Teacher brief template), the aside (Help and
 * safety, the page's way into #/safety) and what is shared (Who sees what,
 * Past exports, the trust line). The v3 doors (School brief, Appointments,
 * Care summary) are gone: each has a home on this screen. #/handoff keeps the
 * builder alone. Who sees what lists live grants only; nothing is a
 * directory. Counts only, no verdicts.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { ShareGrant } from "../../types";

const DAY = 86_400_000;
const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  tab: "consult",
  signedIn: true,
  appts: [] as unknown[],
  contacts: [] as unknown[],
}));

vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams("") }));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    // invented example family
    childProfile: { id: "c-care", name: "Mika", age: 4, languages: ["English"], schoolContext: "Gan", challenges: [], strengths: ["curious"], interests: [] },
    activeTab: harness.tab,
    behaviorLogs: [
      { id: "m1", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 2 * DAY).toISOString(), trigger: "Built a tall tower" },
      { id: "m2", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 4 * DAY).toISOString(), trigger: "Sang in the bath" },
    ],
    milestones: [],
    actionPlans: [],
    approvedMemoryItems: [],
    setActiveTab: vi.fn(),
    requestConsultPrefill: vi.fn(),
    pendingConsultPrefill: null,
    consumeConsultPrefill: vi.fn(),
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: harness.signedIn ? { uid: "synthetic-parent" } : null }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => ({
    items: name === "appointments" ? harness.appts : name === "contacts" ? harness.contacts : [],
    loaded: true,
    error: false,
    confirmed: true,
    isCurrent: () => true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../sections/Reports", () => ({ REPORTS: [], useReportExport: () => vi.fn(), useConsultPdf: () => vi.fn() }));
// v4: #/school-brief renders the inline School Brief, whose review sheet portals to document.body.
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import ConsultTab from "../tabs/ConsultTab";
import { initialOf, PastExports, pastExportRows, WhoSeesWhat } from "./CareShared";
import { daysUntil, inDaysLabel } from "./CareVisitHead";
import { listExports, recordExport } from "../../consult/exportHistory";
import { isLiveGrant, liveGrantRows } from "../../lib/shareGrants";

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

/** A speech-therapist visit at noon, three calendar days from today. */
function visitIn3() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 3);
  return { id: "v3", who: "", role: "Speech therapist", profession: "slp", whenIso: d.toISOString(), when: "", mode: "In person", status: "confirmed" };
}

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const textOf = (html: string, id: string) => {
  const m = new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</(?:p|span|h1)>`).exec(html);
  return m ? decode(m[1].replace(/<[^>]+>/g, "")).trim() : null;
};
const modulesOf = (html: string) => [...html.matchAll(/data-module="([^"]+)"/g)].map((m) => m[1]);
const sliceModule = (html: string, id: string, next?: string) =>
  html.slice(html.indexOf(`data-module="${id}"`), next ? html.indexOf(`data-module="${next}"`) : undefined);

const LANDING_KEYS = [
  "elev.consult.kicker", "elev.consult.sub", "elev.consult.visit.kicker",
  "elev.consult.inDays.zero", "elev.consult.inDays.one", "elev.consult.inDays.two",
  "elev.consult.step.bring", "elev.consult.step.preview", "elev.consult.step.share",
  "elev.consult.bring.label", "elev.consult.bring.moments", "elev.consult.bring.moments.one",
  "elev.consult.bring.development", "elev.consult.bring.words", "elev.consult.bring.steps",
  "elev.consult.preview.note", "elev.consult.aside.label", "elev.consult.aside.safety",
  "elev.consult.aside.sharing", "elev.consult.aside.manage", "elev.consult.aside.openSafety",
  "elev.consult.sharing.none", "elev.consult.sharing.unavailable", "elev.consult.sharing.loading",
  // v4: the template, the shared cards and the visit head's Appointments door
  "elev.consult.template.label", "elev.consult.template.aria", "elev.consult.template.visit",
  "elev.consult.template.teacher", "elev.consult.template.note.visit", "elev.consult.template.note.teacher",
  "elev.consult.shared.label", "elev.consult.who.sub", "elev.consult.who.add", "elev.consult.who.until",
  "elev.consult.who.noEnd", "elev.consult.past.title", "elev.consult.past.sub", "elev.consult.past.none",
  "elev.consult.past.audience", "elev.consult.past.again", "elev.consult.past.record",
  "elev.consult.visit.appointments", "elev.consult.visit.none", "elev.consult.visit.add",
  "elev.consult.trust", "elev.consult.visitOutcome.saveError",
  "elev.consult.visitOutcome.saving", "elev.consult.visitOutcome.queued", "elev.consult.visitOutcome.held",
];

/** The index of the tag that closes the element opening at `start`. */
function closeOf(html: string, start: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}
/** [open, close) of the element carrying data-testid={id}. */
function spanOf(html: string, id: string, tag: string): [number, number] {
  const at = html.lastIndexOf(`<${tag}`, html.indexOf(`data-testid="${id}"`));
  return [at, closeOf(html, at, tag)];
}

beforeEach(() => {
  harness.locale = "en";
  harness.tab = "consult";
  harness.signedIn = true;
  harness.appts = [];
  harness.contacts = [];
  installLocalStorage();
});

describe("v3 EXTRA-CARE · the Care landing", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: kicker, a visit-named H1, the visit card "In 3 days" and the three prep steps`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const html = renderToStaticMarkup(<ConsultTab />);
      expect(textOf(html, "consult-kicker")).toBe(translate(locale, "elev.consult.kicker"));
      expect(textOf(html, "consult-sub")).toBe(translate(locale, "elev.consult.sub"));
      const h1 = decode(/<h1 data-testid="consult-h1"[^>]*>([^<]*)<\/h1>/.exec(html)![1]);
      expect(h1).toContain(translate(locale, "elev.careNet.appt.profession.slp"));
      expect(html.indexOf('data-testid="consult-kicker"')).toBeLessThan(html.indexOf('data-testid="consult-h1"'));
      // the visit card heads the packet module, with the day count in neutral ink
      const packet = sliceModule(html, "consult-packet", "consult-aside");
      expect(packet.indexOf('data-testid="consult-visit-head"')).toBeGreaterThan(0);
      expect(packet.indexOf('data-testid="consult-visit-head"')).toBeLessThan(packet.indexOf('data-testid="consult-audience-step"'));
      expect(textOf(html, "consult-visit-in")).toBe(translate(locale, "elev.consult.inDays", { n: 3 }));
      // ONE primary card in the packet: its head (the visit, then the since
      // counts) directly followed by steps 1-3; the home program follows it
      const page = decode(html);
      const [cardAt, cardEnd] = spanOf(page, "consult-visit-card", "section");
      expect(cardAt).toBeGreaterThan(page.indexOf('data-module="consult-packet"'));
      expect(cardEnd).toBeLessThan(page.indexOf('data-module="consult-aside"'));
      const at = (id: string) => page.indexOf(`data-testid="${id}"`);
      for (const id of ["consult-visit-card-head", "consult-visit-head", "consult-since-head", "consult-audience-step", "consult-review-export"]) {
        expect(at(id), id).toBeGreaterThan(cardAt);
        expect(at(id), id).toBeLessThan(cardEnd);
      }
      const [headAt, headEnd] = spanOf(page, "consult-visit-card-head", "div");
      expect(at("consult-visit-head")).toBeGreaterThan(headAt);
      expect(at("consult-since-head")).toBeGreaterThan(at("consult-visit-head"));
      expect(at("consult-since-head")).toBeLessThan(headEnd);
      expect(at("consult-audience-step")).toBeGreaterThan(headEnd);
      expect(page.indexOf(translate(locale, "elev.pilot.i.have.recommendations.for.home"))).toBeGreaterThan(cardEnd);
      // the numbered step headings, in order: 1 bring, 2 preview, 3 share
      const numbered = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
        .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).trim())
        .filter((text) => /^[123]/.test(text));
      expect(numbered).toEqual([
        `1${translate(locale, "elev.consult.step.bring")}`,
        `2${translate(locale, "elev.consult.step.preview")}`,
        `3${translate(locale, "elev.consult.step.share")}`,
      ]);
      expect(textOf(html, "consult-preview-note")).toBe(translate(locale, "elev.consult.preview.note"));
    });

    it(`${locale}: exactly three modules and ONE move — on Build, never in the aside or the shared cards`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const html = renderToStaticMarkup(<ConsultTab />);
      expect(modulesOf(html)).toEqual(["consult-packet", "consult-aside", "consult-shared"]);
      expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
      const build = /<button[^>]*data-testid="consult-build"[^>]*>/.exec(html)![0];
      expect(build).toContain('data-primary-move="build-share-packet"');
      expect(sliceModule(html, "consult-aside", "consult-shared")).not.toContain("data-primary-move");
      expect(sliceModule(html, "consult-shared")).not.toContain("data-primary-move");
      // one gradient on the page: Build's
      expect((html.match(/gradient-cta|arbor-gradient-primary/g) ?? []).length).toBe(1);
    });

    it(`${locale}: "what to bring" chips are 44 px toggles (aria-pressed); the moments chip is a count`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const html = renderToStaticMarkup(<ConsultTab />);
      // Include the opening tag: role/aria attributes may precede data-testid.
      const row = /<div\b[^>]*data-testid="consult-bring-row"[^>]*>[\s\S]*?<\/div>/.exec(html)![0];
      expect(row).toContain('role="group"');
      const chips: string[] = row.match(/<button[^>]*data-testid="consult-bring-chip"[^>]*>/g) ?? [];
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        expect(chip).toMatch(/aria-pressed="(?:true|false)"/);
        expect(chip).toContain("min-h-[44px]");
      }
      const moments = chips.find((c) => c.includes('data-bring="moments"'));
      expect(moments).toContain('aria-pressed="true"');
      expect(decode(row)).toContain(translate(locale, "elev.consult.bring.moments.other", { n: 2 }));
      // counts only: no share, ratio or "n of m" about the child
      expect(decode(row)).not.toMatch(/%|\d\s*\/\s*\d|\bof\b|מתוך/);
    });

    it(`${locale}: Help and safety — tel: links from Safety's directory, the first contact, last reviewed`, () => {
      harness.locale = locale;
      harness.contacts = [{ id: "k1", name: "Aunt Lea", phone: "+31 6 0000 0000" }];
      localStorage.setItem("arbor.safetyReviewed.c-care", new Date(2026, 8, 30, 12).toISOString());
      const html = renderToStaticMarkup(<ConsultTab />);
      const aside = sliceModule(html, "consult-aside", "consult-shared");
      const calls = [...aside.matchAll(/data-testid="care-aside-call" data-line="([^"]+)" href="tel:([^"]+)"/g)].map((m) => [m[1], m[2]]);
      // ONE way into Safety; with no talk line for the region it says what
      // Safety's by-country list is for
      const safety = /<button[^>]*data-testid="care-aside-open-safety"[^>]*>([\s\S]*?)<\/button>/.exec(aside)!;
      expect((aside.match(/data-testid="care-aside-open-safety"/g) ?? []).length).toBe(1);
      expect(aside).not.toContain('data-testid="care-aside-find-line"');
      if (locale === "en") {
        // EN: the EU emergency number; no foreign talk line, Safety's by-country list instead
        expect(calls).toEqual([["eu_112", "112"]]);
        expect(safety[0]).toContain('data-find-line="true"');
        expect(decode(safety[1].replace(/<[^>]+>/g, "")).trim()).toBe(translate(locale, "elev.safety.crisis.findLine"));
      } else {
        // HE: MDA 101 and ERAN 1201
        expect(calls).toEqual([["il_mda", "101"], ["il_eran", "1201"]]);
        expect(safety[0]).not.toContain("data-find-line");
        expect(decode(safety[1].replace(/<[^>]+>/g, "")).trim()).toBe(translate(locale, "elev.consult.aside.openSafety"));
      }
      expect(aside).toMatch(/data-testid="care-aside-first-contact" href="tel:\+31600000000"/);
      expect(decode(aside)).not.toContain(translate(locale, "elev.safety.review.notYet"));
      expect(aside).toContain('data-testid="care-aside-reviewed"');
      expect(aside).toContain('data-testid="care-aside-open-safety"');
      for (const a of aside.match(/<(?:a|button) [^>]*>/g) ?? []) expect(a).toMatch(/min-h-\[44px\]/);
    });

    it(`${locale}: Who sees what — signed in it reads the roster; signed out no one can hold a grant`, () => {
      harness.locale = locale;
      const loading = sliceModule(renderToStaticMarkup(<ConsultTab />), "consult-shared");
      expect(loading).toMatch(/data-testid="care-aside-sharing"[^>]*aria-busy="true"/);
      expect(decode(loading)).toContain(translate(locale, "elev.consult.sharing.loading"));
      expect(loading).not.toContain('data-testid="care-aside-sharing-none"');
      // while the roster is unknown (loading, or a failed read that says "Open Manage") the door reads Manage, never "Add someone"
      const pending = /<button[^>]*data-testid="care-aside-manage"[^>]*>([\s\S]*?)<\/button>/.exec(loading)![1];
      expect(decode(pending.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "")).trim()).toBe(translate(locale, "elev.consult.aside.manage"));
      harness.signedIn = false;
      const out = sliceModule(renderToStaticMarkup(<ConsultTab />), "consult-shared");
      expect(textOf(out, "care-aside-sharing-none")).toBe(translate(locale, "elev.consult.sharing.none"));
      // with no one yet, the roster door reads "Add someone"
      expect(out).toContain('data-testid="care-aside-manage"');
      const manage = /<button[^>]*data-testid="care-aside-manage"[^>]*>([\s\S]*?)<\/button>/.exec(out)![1];
      expect(decode(manage.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "")).trim()).toBe(translate(locale, "elev.consult.who.add"));
    });

    it(`${locale}: v4 — Who sees what and Past exports side by side, then the trust line; no doors, never a directory`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      const shared = sliceModule(html, "consult-shared");
      expect(shared.indexOf('data-testid="care-aside-sharing"')).toBeGreaterThan(-1);
      expect(shared.indexOf('data-testid="care-past-exports"')).toBeGreaterThan(shared.indexOf('data-testid="care-aside-sharing"'));
      // each card names itself with the brand gradient chip
      expect((shared.match(/data-brand-chip="/g) ?? []).length).toBe(2);
      // nothing exported from this device yet: an honest empty state, and the full record stays one tap away
      expect(textOf(shared, "care-past-none")).toBe(translate(locale, "elev.consult.past.none"));
      expect(shared).toContain('data-testid="care-past-record"');
      for (const b of shared.match(/<button [^>]*>/g) ?? []) expect(b).toContain("min-h-[44px]");
      const trust = shared.slice(shared.indexOf('data-testid="consult-trust-line"'));
      expect(decode(trust)).toContain(translate(locale, "elev.consult.trust"));
      expect(shared.indexOf('data-testid="consult-trust-line"')).toBeGreaterThan(shared.indexOf('data-testid="care-past-exports"'));
      // the v3 doors are gone: each has its home on this one screen
      expect(html).not.toContain('data-testid="care-door"');
      expect(html).not.toContain('data-module="consult-doors"');
      // never a directory or a way to find someone new
      const landing = decode(sliceModule(html, "consult-aside"));
      expect(landing).not.toMatch(/find-pro|directory|Find a professional|Verified professionals|אנשי מקצוע מאומתים/i);
    });

    it(`${locale}: v4 — Appointments lives under the visit head; with no visit the head says so and offers to add one`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const booked = renderToStaticMarkup(<ConsultTab />);
      const head = booked.slice(booked.indexOf('data-testid="consult-visit-head"'), booked.indexOf('data-testid="consult-audience-step"'));
      expect(head).toContain('data-visit="booked"');
      expect(decode(head)).toContain(translate(locale, "elev.consult.visit.appointments"));
      expect(head).toMatch(/<button[^>]*data-testid="consult-visit-appointments"[^>]*min-h-\[44px\]/);
      harness.appts = [];
      const none = renderToStaticMarkup(<ConsultTab />);
      expect(none).toContain('data-visit="none"');
      expect(textOf(none, "consult-visit-none")).toBe(translate(locale, "elev.consult.visit.none"));
      expect(decode(none)).toContain(translate(locale, "elev.consult.visit.add"));
    });

    it(`${locale}: v4 — the builder's template: Visit summary is the clinical audience row (no teacher chip), Teacher brief is the teacher`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      const row = /<div[^>]*data-testid="consult-template-row"[^>]*>[\s\S]*?<\/div>/.exec(html)![0];
      expect([...row.matchAll(/data-template="([^"]+)"/g)].map((m) => m[1])).toEqual(["visit", "teacher"]);
      expect(row).toMatch(/aria-checked="true"[^>]*data-template="visit"/);
      expect(textOf(html, "consult-template-note")).toBe(translate(locale, "elev.consult.template.note.visit"));
      const audiences = /<div[^>]*data-testid="consult-audience-row"[^>]*>[\s\S]*?<\/div>/.exec(html)![0];
      expect(decode(audiences)).not.toContain(translate(locale, "elev.carehonesty.consult.audience.teacher"));
      harness.tab = "school-brief";
      const brief = renderToStaticMarkup(<ConsultTab />);
      expect(brief).toMatch(/aria-checked="true"[^>]*data-template="teacher"/);
      expect(textOf(brief, "consult-template-note")).toBe(translate(locale, "elev.consult.template.note.teacher"));
      expect(brief).toContain('data-testid="consult-teacher-branch"');
      expect(brief).not.toContain('data-testid="consult-audience-row"');
    });
  }

  it("#/handoff keeps the builder alone: no kicker, visit card, chips, template, aside or shared cards", () => {
    harness.tab = "handoff";
    harness.appts = [visitIn3()];
    const html = renderToStaticMarkup(<ConsultTab />);
    expect(modulesOf(html)).toEqual(["consult-packet"]);
    for (const id of ["consult-kicker", "consult-sub", "consult-visit-card", "consult-visit-card-head", "consult-visit-head", "consult-bring-row", "consult-preview-note", "consult-trust-line", "consult-template-row"]) {
      expect(html, id).not.toContain(`data-testid="${id}"`);
    }
    expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
    expect(html).toContain('data-primary-move="copy-handoff-brief"');
  });

  it("every landing string exists in EN and HE, and the HE copy carries no Latin", () => {
    for (const key of LANDING_KEYS) {
      expect(translate("en", key), key).not.toBe(key);
      const he = translate("he", key);
      expect(he, key).not.toBe(key);
      expect(he.replace(/\{[a-z]+\}/g, ""), key).not.toMatch(/[A-Za-z]/);
    }
    expect(translate("he", "elev.consult.inDays", { n: 5 })).not.toMatch(/[A-Za-z]/);
  });
});

describe("v3 EXTRA-CARE · Who sees what lists live grants only", () => {
  const grant = (over: Partial<ShareGrant>): ShareGrant => ({
    id: "g", ownerUid: "o", ownerEmail: null, childId: "c-care", childName: null, recipientEmail: "someone@example.test",
    role: "professional", scopes: ["milestones"], createdAt: "2026-10-01T10:00:00.000Z", expiresAt: null, revokedAt: null, ...over,
  });
  const future = new Date(Date.now() + 30 * DAY).toISOString();
  const past = new Date(Date.now() - DAY).toISOString();
  const grants: ShareGrant[] = [
    grant({ id: "live-pro", recipientEmail: "therapist@example.test", createdAt: "2026-10-05T10:00:00.000Z", expiresAt: future }),
    grant({ id: "revoked", recipientEmail: "revoked@example.test", revokedAt: "2026-10-02T10:00:00.000Z" }),
    grant({ id: "expired", recipientEmail: "expired@example.test", expiresAt: past }),
    grant({ id: "co", role: "co_parent", accessMode: "family_workspace", scopes: [], recipientEmail: "partner@example.test", createdAt: "2026-10-03T10:00:00.000Z" }),
  ];

  it("unit: revoked and expired grants never count as live", () => {
    expect(isLiveGrant(grants[0])).toBe(true);
    expect(isLiveGrant(grants[1])).toBe(false);
    expect(isLiveGrant(grants[2])).toBe(false);
    expect(isLiveGrant(grants[3])).toBe(true);
  });

  it("unit: rows are newest first; the shared family workspace names itself, never a scope list", () => {
    const t = (key: string) => translate("en", key);
    const rows = liveGrantRows(grants, t, "Shared family workspace");
    expect(rows.map((r) => r.id)).toEqual(["live-pro", "co"]);
    expect(rows[0].what).toEqual([translate("en", "share.scope.milestones")]);
    expect(rows[0].roleKey).toBe("share.role.professional");
    expect(rows[1].what).toEqual(["Shared family workspace"]);
  });

  it("drift: the roster (TrustedSharing) applies the same live rule", () => {
    const rule = "!g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now())";
    expect(readFileSync("src/components/sections/TrustedSharing.tsx", "utf8")).toContain(`const isLiveGrant = (g: ShareGrant) => ${rule};`);
    expect(readFileSync("src/lib/shareGrants.ts", "utf8")).toContain(`return ${rule};`);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: rendered rows — at most three, the rest as "and n more"; ended grants never appear`, () => {
      harness.locale = locale;
      const t = (key: string) => translate(locale, key);
      const more = [1, 2, 3].map((i) => grant({ id: `extra-${i}`, recipientEmail: `extra${i}@example.test`, createdAt: `2026-09-2${i}T10:00:00.000Z` }));
      const html = renderToStaticMarkup(<WhoSeesWhat state="ready" rows={liveGrantRows([...grants, ...more], t, "workspace")} />);
      expect((html.match(/data-testid="care-aside-grant"/g) ?? []).length).toBe(3);
      expect(html).toContain("therapist@example.test");
      expect(html).not.toContain("revoked@example.test");
      expect(html).not.toContain("expired@example.test");
      expect(html).toContain(translate(locale, "elev.consult.sharing.more", { n: 2 }));
      expect(html).toContain('<bdi dir="ltr"');
    });

    it(`${locale}: an unreadable roster says so instead of claiming no one has access`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<WhoSeesWhat state="failed" rows={[]} />);
      expect(html).toContain('data-testid="care-aside-sharing-unavailable"');
      expect(html).not.toContain('data-testid="care-aside-sharing-none"');
    });
  }
});

describe("v3 EXTRA-CARE · units and source pins", () => {
  it("daysUntil counts calendar days in local time; past or unreadable dates give none", () => {
    const now = new Date(2026, 9, 12, 23, 30).getTime();
    expect(daysUntil(new Date(2026, 9, 12, 23, 45).toISOString(), now)).toBe(0);
    expect(daysUntil(new Date(2026, 9, 13, 0, 15).toISOString(), now)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 15, 9, 0).toISOString(), now)).toBe(3);
    expect(daysUntil(new Date(2026, 9, 11, 9, 0).toISOString(), now)).toBeNull();
    expect(daysUntil("not a date", now)).toBeNull();
    expect(daysUntil(undefined, now)).toBeNull();
  });

  it("inDaysLabel: today, tomorrow, two days, then a count", () => {
    expect(inDaysLabel(0)).toEqual({ key: "elev.consult.inDays.zero" });
    expect(inDaysLabel(1)).toEqual({ key: "elev.consult.inDays.one" });
    expect(inDaysLabel(2)).toEqual({ key: "elev.consult.inDays.two" });
    expect(inDaysLabel(9)).toEqual({ key: "elev.consult.inDays", vars: { n: 9 } });
    expect(translate("en", "elev.consult.inDays", { n: 9 })).toBe("In 9 days");
  });

  it("v4: Past exports reads this device's history newest first — audiences and the weekly record, nothing else", () => {
    installLocalStorage();
    recordExport("c-care", "slp", "2026-09-12T10:00:00.000Z");
    recordExport("c-care", "reports-weekly", "2026-10-02T10:00:00.000Z");
    recordExport("c-care", "not-an-audience", "2026-10-05T10:00:00.000Z");
    recordExport("c-care", "clinician", "2026-08-01T10:00:00.000Z");
    expect(listExports("c-care").map((e) => e.audience)).toEqual(["not-an-audience", "reports-weekly", "slp", "clinician"]);
    // the legacy "clinician" reads as the therapist ceiling; an unknown slot is left out
    expect(pastExportRows(listExports("c-care"))).toEqual([
      { kind: "record", at: "2026-10-02T10:00:00.000Z" },
      { kind: "audience", audience: "slp", at: "2026-09-12T10:00:00.000Z" },
      { kind: "audience", audience: "therapist", at: "2026-08-01T10:00:00.000Z" },
    ]);
    expect(listExports("someone-else")).toEqual([]);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: v4 Past exports rows — a professional's row prepares an update, the weekly row opens the full record`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<PastExports rows={[{ kind: "audience", audience: "slp", at: "2026-09-12T10:00:00.000Z" }, { kind: "record", at: "2026-10-02T10:00:00.000Z" }]} />);
      expect([...html.matchAll(/data-testid="care-past-row" data-export="([^"]+)"/g)].map((m) => m[1])).toEqual(["slp", "record"]);
      expect(decode(html)).toContain(translate(locale, "elev.consult.past.audience", { audience: translate(locale, "elev.carehonesty.consult.audience.slp") }));
      expect(decode(html)).toContain(translate(locale, "elev.consult.past.again"));
      expect(decode(html)).toContain(translate(locale, "elev.consult.past.record"));
      expect(html).not.toContain('data-testid="care-past-none"');
    });
  }

  it("v4: a grant row's initial is the address's first letter or digit", () => {
    expect(initialOf("therapist@example.test")).toBe("T");
    expect(initialOf("  _dani@example.test")).toBe("D");
    expect(initialOf("9lives@example.test")).toBe("9");
    expect(initialOf("")).toBe("·");
  });

  it("ConsultTab stamps one module literal; the aside and the shared cards stamp their own, and no move", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    const consult = strip(readFileSync("src/components/tabs/ConsultTab.tsx", "utf8"));
    expect(consult.match(/\bdata-module\b(?!-)/g) ?? []).toHaveLength(1);
    const aside = strip(readFileSync("src/components/care/CareAside.tsx", "utf8"));
    const shared = strip(readFileSync("src/components/care/CareShared.tsx", "utf8"));
    expect(aside).toContain('data-module="consult-aside"');
    expect(shared).toContain('data-module="consult-shared"');
    for (const src of [aside, shared, strip(readFileSync("src/components/care/CareVisitHead.tsx", "utf8"))]) {
      expect(src).not.toContain("data-primary-move");
      expect(src).not.toMatch(/gradient-cta|arbor-gradient-primary/);
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toMatch(/\b(?:margin|padding)-(?:left|right)\b|\b(?:ml|mr|pl|pr|left|right)-\d/);
    }
  });
});
