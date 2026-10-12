/**
 * v3 EXTRA-CARE — the Care landing (#/consult), rendered at the real
 * ConsultTab in EN and HE.
 *
 * Three modules: the next visit with its three prep steps (the packet, which
 * holds the route's ONE move, build-share-packet), the aside (Help and
 * safety, Who sees what) and the doors with the trust line. #/handoff keeps
 * the builder alone. Who sees what lists live grants only; the doors are the
 * Care pages, never a directory. Counts only, no verdicts.
 *
 * v3 F-CARE-1 (the landing as the mock, plus 390 px): the H1 is the door's
 * sentence and the visit is named in the card head; the three steps are a
 * stepper over one body; a visit folds the audience row; the aside carries
 * Safety's crisis words; the doors are rows with a chevron below sm.
 *
 * r2 (review r1): the route's ONE stamp, and the one gradient, ride the SHOWN
 * step's way on (Build, Continue or the empty state's "Log a moment", Copy),
 * pinned per step; a caller's reason is said in step 1 on arrival; the card
 * does not clip the stepper's focus ring; the Appointments door reads
 * ConsultTab's own collections; the crisis line keeps body type.
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
  topic: null as unknown,
  // r2: the route's query (#/consult?intake=), a caller's prefill, the
  // record's moments (null = the two below) and the visits' follow-ups
  query: "",
  prefill: null as unknown,
  logs: null as unknown[] | null,
  followUps: [] as unknown[],
}));

vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(harness.query) }));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    // invented example family
    childProfile: { id: "c-care", name: "Mika", age: 4, languages: ["English"], schoolContext: "Gan", challenges: [], strengths: ["curious"], interests: [] },
    activeTab: harness.tab,
    behaviorLogs: harness.logs ?? [
      { id: "m1", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 2 * DAY).toISOString(), trigger: "Built a tall tower" },
      { id: "m2", behaviorType: "Moment", intensity: 1, timestamp: new Date(Date.now() - 4 * DAY).toISOString(), trigger: "Sang in the bath" },
    ],
    milestones: [],
    actionPlans: [],
    approvedMemoryItems: [],
    activeFamilyTopic: harness.topic,
    setActiveTab: vi.fn(),
    requestConsultPrefill: vi.fn(),
    pendingConsultPrefill: harness.prefill,
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
    items: name === "appointments" ? harness.appts : name === "contacts" ? harness.contacts : name === "apptFollowUps" ? harness.followUps : [],
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

import ConsultTab from "../tabs/ConsultTab";
import { consultStampSite } from "../sections/AskSpecialist";
import { fmtDayShort } from "../../lib/formatDate";
import { WhoSeesWhat } from "./CareAside";
import { careDoors } from "./CareDoors";
import { daysUntil, inDaysLabel } from "./CareVisitHead";
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
  "elev.consult.doors.label", "elev.consult.door.schoolBrief", "elev.consult.door.appointments",
  "elev.consult.door.summary", "elev.consult.trust", "elev.consult.visitOutcome.saveError",
  "elev.consult.visitOutcome.saving", "elev.consult.visitOutcome.queued", "elev.consult.visitOutcome.held",
  // v3 F-CARE-1
  "elev.consult.title", "elev.consult.visit.none", "elev.consult.stepper.label",
  "elev.consult.step.bring.d", "elev.consult.step.preview.d", "elev.consult.step.share.d",
  "elev.consult.preview.cta", "elev.consult.next", "elev.consult.audience.change", "elev.consult.fullRecord",
  "elev.consult.door.appointments.next", "elev.consult.door.appointments.past.one", "elev.consult.door.appointments.past.other",
  "elev.consult.visitOutcome.q",
  // v3 F-CARE-1 r2
  "elev.consult.reason.carried",
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
  harness.topic = null;
  harness.query = "";
  harness.prefill = null;
  harness.logs = null;
  harness.followUps = [];
  installLocalStorage();
});

describe("v3 EXTRA-CARE · the Care landing", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: kicker, the door's H1, the visit named in the card "In 3 days" and the three prep steps`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const html = renderToStaticMarkup(<ConsultTab />);
      expect(textOf(html, "consult-kicker")).toBe(translate(locale, "elev.consult.kicker"));
      expect(textOf(html, "consult-sub")).toBe(translate(locale, "elev.consult.sub"));
      // v3 F-CARE-1 re-pin: the landing H1 is the door's own sentence, never
      // "for {name}" and never the visit; the visit is named in the card head.
      const h1 = decode(/<h1 data-testid="consult-h1"[^>]*>([^<]*)<\/h1>/.exec(html)![1]);
      expect(h1).toBe(translate(locale, "elev.consult.title"));
      expect(h1).not.toContain(translate(locale, "elev.careNet.appt.profession.slp"));
      {
        const named = decode(html);
        const header = named.slice(0, named.indexOf('data-testid="consult-landing"'));
        expect(header).not.toContain(translate(locale, "elev.consult.forName", { name: "Mika" }));
        const [vAt, vEnd] = spanOf(named, "consult-visit-head", "div");
        expect(named.slice(vAt, vEnd)).toContain(translate(locale, "elev.careNet.appt.profession.slp"));
        expect(named.slice(vAt, vEnd)).toContain('data-visit="booked"');
      }
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
      // v3 F-CARE-1 re-pin: the outcome form and the home-program entry moved
      // to #/appointments (care/VisitOutcome); the landing holds neither.
      expect(page).not.toContain(translate(locale, "elev.pilot.i.have.recommendations.for.home"));
      expect(page).not.toContain('data-testid="consult-visit-outcome"');
      expect(page).not.toContain('data-testid="consult-home-program-choice"');
      // the numbered step headings stay in reading order (read, not drawn,
      // under the stepper): 1 bring, 2 preview, 3 share
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

    it(`${locale}: exactly three modules and ONE move — on Build, never in the aside or the doors`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const html = renderToStaticMarkup(<ConsultTab />);
      expect(modulesOf(html)).toEqual(["consult-packet", "consult-aside", "consult-doors"]);
      expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
      const build = /<button[^>]*data-testid="consult-build"[^>]*>/.exec(html)![0];
      expect(build).toContain('data-primary-move="build-share-packet"');
      expect(sliceModule(html, "consult-aside", "consult-doors")).not.toContain("data-primary-move");
      expect(sliceModule(html, "consult-doors")).not.toContain("data-primary-move");
      // one gradient on the page: Build's
      expect((html.match(/gradient-cta|arbor-gradient-primary/g) ?? []).length).toBe(1);
      // v3 F-CARE-1: from xl a 1.6fr | 1fr grid — the visit card and the
      // sticky aside side by side, the doors full width under both
      expect(/<div[^>]*data-testid="consult-landing"[^>]*>/.exec(html)![0]).toContain("xl:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]");
      const aside = /<aside[^>]*data-module="consult-aside"[^>]*>/.exec(html)![0];
      expect(aside).toContain("xl:grid-cols-1");
      expect(aside).toContain("xl:sticky");
      expect(/<nav[^>]*data-module="consult-doors"[^>]*>/.exec(html)![0]).toContain("xl:col-span-2");
      const card = /<section[^>]*data-testid="consult-visit-card"[^>]*>/.exec(html)![0];
      expect(card).toContain("arbor-depth-primary");
      // r2: no overflow clip on the card, so the stepper's focus ring
      // (2 px outline, 2 px offset, index.css) stays whole at its edge
      expect(card).not.toContain("overflow-hidden");
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

    // ── v3 F-CARE-1: the visit card as the mock ─────────────────────────────
    const openTag = (html: string, id: string) => new RegExp(`<[a-z0-9]+ [^>]*\\bid="${id}"[^>]*>`).exec(html)![0];

    it(`${locale}: the three steps are a stepper — three 44 px tabs under the head, step 1 open, ONE body shown`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const page = decode(renderToStaticMarkup(<ConsultTab />));
      const [cardAt, cardEnd] = spanOf(page, "consult-visit-card", "section");
      const [, headEnd] = spanOf(page, "consult-visit-card-head", "div");
      const [navAt, navEnd] = spanOf(page, "consult-stepper", "nav");
      expect(navAt).toBeGreaterThan(headEnd);
      expect(navEnd).toBeLessThan(page.indexOf('data-testid="consult-audience-step"'));
      expect(navEnd).toBeLessThan(cardEnd);
      expect(navAt).toBeGreaterThan(cardAt);
      const nav = page.slice(navAt, navEnd);
      expect(nav).toContain(`aria-label="${translate(locale, "elev.consult.stepper.label")}"`);
      const tabs: string[] = nav.match(/<button[^>]*data-testid="consult-step"[^>]*>/g) ?? [];
      expect(tabs.map((b) => /data-step="(\d)"/.exec(b)![1])).toEqual(["1", "2", "3"]);
      expect(tabs.filter((b) => b.includes('aria-current="step"'))).toHaveLength(1);
      expect(tabs[0]).toContain('aria-current="step"');
      for (const b of tabs) {
        expect(b).toContain("min-h-[56px]");
        expect(b).not.toMatch(/\sdisabled=""/);
      }
      for (const key of ["elev.consult.step.bring", "elev.consult.step.preview", "elev.consult.step.share"]) {
        expect(nav).toContain(translate(locale, key));
      }
      // centred on a phone; the step's line joins from sm
      expect(tabs[0]).toMatch(/\bitems-center\b[^"]*\bsm:items-start\b/);
      expect(nav).toContain(translate(locale, "elev.consult.step.bring.d"));
      // a choice of step, never a progress bar or a count of steps
      expect(nav).not.toMatch(/role="progressbar"|\d\s*\/\s*\d|\bof\s+\d|מתוך/);
      // ONE body: step 1 shown; step 2 and step 3 mounted but hidden
      expect(openTag(page, "consult-step-1")).not.toMatch(/\shidden=""/);
      expect(openTag(page, "consult-step-2")).toMatch(/\shidden=""/);
      expect(openTag(page, "consult-review-export")).toMatch(/\shidden=""/);
      // the builder's lg two-pane fold does not apply inside the stepper
      expect(/<div[^>]*data-testid="consult-panes"[^>]*>/.exec(page)![0]).not.toContain("lg:grid");
      expect(openTag(page, "consult-review-export")).not.toContain("lg:sticky");
      // Build opens step 2 ("Preview the summary"); Next opens step 3; neither is a second move
      const build = /<button[^>]*data-testid="consult-build"[^>]*>([\s\S]*?)<\/button>/.exec(page)!;
      expect(build[1].replace(/<[^>]+>/g, "").trim()).toBe(translate(locale, "elev.consult.preview.cta"));
      const next = /<button[^>]*data-testid="consult-next"[^>]*>([\s\S]*?)<\/button>/.exec(page)!;
      expect(next[0]).not.toContain("data-primary-move");
      expect(next[0]).toContain("min-h-[44px]");
      expect(next[1].replace(/<[^>]+>/g, "")).toContain(translate(locale, "elev.consult.next"));
      expect(next[1]).toMatch(/class="msr rtl:-scale-x-100"[^>]*>arrow_forward</);
      // Next closes step 2's body (after the packet), before step 3 opens
      const [s2At] = spanOf(page, "consult-reason-section", "section");
      expect(page.indexOf('data-testid="consult-next"')).toBeGreaterThan(s2At);
      expect(page.indexOf('data-testid="consult-next"')).toBeLessThan(page.indexOf('id="consult-review-export"'));
    });

    it(`${locale}: step 3 keeps the reviewed gate and the verbs, then "Your full record (PDF)" to Reports`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const page = decode(renderToStaticMarkup(<ConsultTab />));
      const [rAt, rEnd] = spanOf(page, "consult-review-export", "div");
      const step3 = page.slice(rAt, rEnd);
      for (const id of ["consult-preview", "consult-reviewed", "consult-copy", "consult-pdf", "consult-send-trusted", "consult-full-record"]) {
        expect(step3, id).toContain(`data-testid="${id}"`);
      }
      expect(step3.indexOf('data-testid="consult-full-record"')).toBeGreaterThan(step3.indexOf('data-testid="consult-send-trusted"'));
      const full = /<button[^>]*data-testid="consult-full-record"[^>]*>([\s\S]*?)<\/button>/.exec(step3)!;
      expect(full[0]).toContain("min-h-[44px]");
      expect(full[0]).not.toContain("data-primary-move");
      expect(full[1].replace(/<[^>]+>/g, "")).toContain(translate(locale, "elev.consult.fullRecord"));
      expect(full[1]).toContain(">history<");
    });

    it(`${locale}: a visit names the audience — the radio row folds behind one line`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      const page = decode(renderToStaticMarkup(<ConsultTab />));
      const [s1At, s1End] = spanOf(page, "consult-audience-step", "section");
      const step1 = page.slice(s1At, s1End);
      expect(step1).toContain('data-audience="slp"');
      expect(step1).not.toContain('role="radio"');
      expect(step1).not.toContain('data-testid="consult-audience-row"');
      const change = /<button[^>]*data-testid="consult-audience-change"[^>]*>([\s\S]*?)<\/button>/.exec(step1)!;
      expect(change[0]).toContain("min-h-[44px]");
      expect(change[1].replace(/<[^>]+>/g, "")).toContain(translate(locale, "elev.consult.audience.change"));
      // no visit: the parent chooses, so the row shows
      harness.appts = [];
      const open = decode(renderToStaticMarkup(<ConsultTab />));
      expect(open).toContain('data-testid="consult-audience-row"');
      expect(open).toContain('role="radio"');
      expect(open).not.toContain('data-testid="consult-audience-change"');
      expect(open).toContain('data-visit="none"');
      expect(open).toContain(translate(locale, "elev.consult.visit.none"));
    });

    it(`${locale}: "Our question" is the second chip; a chip that is in reads as chosen with a filled check`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      harness.topic = { id: "topic-1", childId: "c-care", title: locale === "he" ? "איך עושים את הבקרים רגועים יותר?" : "How do we make mornings calmer?", status: "active" };
      const page = decode(renderToStaticMarkup(<ConsultTab />));
      const row = /<div\b[^>]*data-testid="consult-bring-row"[^>]*>[\s\S]*?<\/div>/.exec(page)![0];
      const order = [...row.matchAll(/data-testid="(consult-bring-chip|consult-include-topic)"(?: data-bring="([^"]+)")?/g)].map((m) => m[2] ?? m[1]);
      expect(order[0]).toBe("moments");
      expect(order[1]).toBe("consult-include-topic");
      const moments = /<button[^>]*data-bring="moments"[^>]*>([\s\S]*?)<\/button>/.exec(row)!;
      expect(moments[0]).toContain("var(--arbor-sky-wash)");
      expect(moments[1]).toMatch(/'FILL' 1[^>]*>check_circle</);
      // off by default: the quiet outline and its own glyph
      const topic = /<button[^>]*data-testid="consult-include-topic"[^>]*>([\s\S]*?)<\/button>/.exec(row)!;
      expect(topic[0]).toContain('aria-pressed="false"');
      expect(topic[0]).not.toContain("var(--arbor-sky-wash)");
      expect(topic[1]).toContain(translate(locale, "elev.consult.topic.include"));
      expect(topic[1]).not.toContain(">check_circle<");
    });

    it(`${locale}: Help and safety — tel: links from Safety's directory, the first contact, last reviewed`, () => {
      harness.locale = locale;
      harness.contacts = [{ id: "k1", name: "Aunt Lea", phone: "+31 6 0000 0000" }];
      localStorage.setItem("arbor.safetyReviewed.c-care", new Date(2026, 8, 30, 12).toISOString());
      const html = renderToStaticMarkup(<ConsultTab />);
      const aside = sliceModule(html, "consult-aside", "consult-doors");
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
      // v3 F-CARE-1: Safety's own crisis words under the accent rule, from sm,
      // before the one way into Safety; no "Message" action, no move
      const crisis = /<p[^>]*data-testid="care-aside-crisis"[^>]*>([\s\S]*?)<\/p>/.exec(aside)!;
      expect(crisis[0]).toMatch(/class="hidden sm:block arbor-accent-rule\b/);
      // r2: body type, never the "say" register: Safety's own crisis words
      // keep SafetyTab's upright sans (parentScriptTypography)
      expect(crisis[0]).not.toContain("arbor-type-say");
      expect(crisis[0]).toContain("font-family:var(--font-sans)");
      expect(crisis[0]).toContain("font-style:normal");
      expect(decode(crisis[1])).toBe(translate(locale, "elev.safety.crisis.script"));
      expect(aside.indexOf('data-testid="care-aside-crisis"')).toBeLessThan(aside.indexOf('data-testid="care-aside-open-safety"'));
      expect(aside).not.toMatch(/sms:|data-testid="care-aside-message"/);
      expect(aside).not.toContain("data-primary-move");
    });

    it(`${locale}: Who sees what — signed in it reads the roster; signed out no one can hold a grant`, () => {
      harness.locale = locale;
      const loading = sliceModule(renderToStaticMarkup(<ConsultTab />), "consult-aside", "consult-doors");
      expect(loading).toMatch(/data-testid="care-aside-sharing"[^>]*aria-busy="true"/);
      expect(decode(loading)).toContain(translate(locale, "elev.consult.sharing.loading"));
      expect(loading).not.toContain('data-testid="care-aside-sharing-none"');
      harness.signedIn = false;
      const out = sliceModule(renderToStaticMarkup(<ConsultTab />), "consult-aside", "consult-doors");
      expect(textOf(out, "care-aside-sharing-none")).toBe(translate(locale, "elev.consult.sharing.none"));
      expect(out).toContain('data-testid="care-aside-manage"');
    });

    it(`${locale}: the doors are School brief, Appointments and Care summary, then the trust line`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<ConsultTab />);
      const doors = sliceModule(html, "consult-doors");
      expect([...doors.matchAll(/data-testid="care-door" data-door="([^"]+)"/g)].map((m) => m[1])).toEqual(["school-brief", "appointments", "handoff"]);
      for (const b of doors.match(/<button [^>]*>/g) ?? []) expect(b).toContain("min-h-[44px]");
      expect(decode(doors)).toContain(translate(locale, "elev.consult.door.schoolBrief"));
      // v3 F-CARE-1: below sm each door is a row ending in a chevron that
      // mirrors once in RTL; from sm a card with the glyph blob
      const buttons = [...doors.matchAll(/<button [^>]*data-testid="care-door"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]);
      expect(buttons).toHaveLength(3);
      for (const inner of buttons) {
        expect(inner).toMatch(/class="msr sm:hidden flex-shrink-0 rtl:-scale-x-100"[^>]*>chevron_right</);
        expect(inner).toContain('data-testid="care-door-sub"');
      }
      // the Appointments door with no booking keeps its own line, no count
      expect(textOf(doors.slice(doors.indexOf('data-door="appointments"')), "care-door-sub")).toBe(translate(locale, "elev.consult.door.appointments"));
      const trust = doors.slice(doors.indexOf('data-testid="consult-trust-line"'));
      expect(trust.length).toBeGreaterThan(0);
      expect(decode(trust)).toContain(translate(locale, "elev.consult.trust"));
      expect(doors.indexOf('data-testid="consult-trust-line"')).toBeGreaterThan(doors.lastIndexOf('data-testid="care-door"'));
      // never a directory or a way to find someone new
      const landing = decode(sliceModule(html, "consult-aside"));
      expect(landing).not.toMatch(/find-pro|directory|Find a professional|Verified professionals|אנשי מקצוע מאומתים/i);
    });

    // ── v3 F-CARE-1 r2 (review r1) ──────────────────────────────────────────
    const BODIES = [["consult-step-1", "section"], ["consult-step-2", "div"], ["consult-review-export", "div"]] as const;
    /** The step body that holds offset `at`, and whether it renders hidden. */
    const bodyAt = (page: string, at: number): { id: string; hidden: boolean } | null => {
      for (const [id, tag] of BODIES) {
        const idAt = page.indexOf(`id="${id}"`);
        if (idAt < 0) continue;
        const open = page.lastIndexOf(`<${tag}`, idAt);
        if (at > open && at < closeOf(page, open, tag)) return { id, hidden: /\shidden=""/.test(openTag(page, id)) };
      }
      return null;
    };

    it(`${locale}: ONE stamp on the SHOWN step's way on — Build (1), "Log a moment" (2, nothing yet), Copy (3) — and the one gradient with it`, () => {
      harness.locale = locale;
      const cases = [
        { name: "step 1 (a visit booked)", setup: () => {}, step: "1", body: "consult-step-1", holder: "consult-build" },
        // #/consult?intake=slp opens on step 3; with nothing to share it stays on step 2
        { name: "step 2 (intake, nothing to share yet)", setup: () => { harness.query = "intake=slp"; harness.logs = []; }, step: "2", body: "consult-step-2", holder: "consult-empty-cta" },
        {
          name: "step 3 (#/consult?intake=slp)",
          setup: () => {
            harness.query = "intake=slp";
            // invented: the parent's own question for the speech therapist
            localStorage.setItem("arbor.intakeQuestions.c-care.slp", locale === "he" ? "מתי כדאי לחזור לבדיקה?" : "When should we come back?");
          },
          step: "3", body: "consult-review-export", holder: "consult-copy",
        },
      ];
      for (const c of cases) {
        harness.appts = [visitIn3()];
        harness.query = "";
        harness.logs = null;
        installLocalStorage();
        c.setup();
        const page = decode(renderToStaticMarkup(<ConsultTab />));
        const stamps = [...page.matchAll(/data-primary-move="([^"]+)"/g)];
        expect(stamps.map((m) => m[1]), c.name).toEqual(["build-share-packet"]);
        const holder = /<button[^>]*data-primary-move="[^"]+"[^>]*>/.exec(page)![0];
        expect(holder, c.name).toContain(`data-testid="${c.holder}"`);
        // the stamped control is in the step body that shows, never a hidden one
        expect(bodyAt(page, stamps[0].index!), c.name).toEqual({ id: c.body, hidden: false });
        for (const [id] of BODIES) {
          if (id !== c.body && page.includes(`id="${id}"`)) expect(openTag(page, id), `${c.name}: ${id}`).toMatch(/\shidden=""/);
        }
        // the page's ONE gradient is the stamp holder's
        expect((page.match(/gradient-cta|arbor-gradient-primary/g) ?? []).length, c.name).toBe(1);
        expect(holder, c.name).toMatch(/gradient-cta|arbor-gradient-primary/);
        // the stepper names the same step, once
        const current = (page.match(/<button[^>]*data-testid="consult-step"[^>]*>/g) ?? []).filter((b) => b.includes('aria-current="step"'));
        expect(current, c.name).toHaveLength(1);
        expect(current[0], c.name).toContain(`data-step="${c.step}"`);
        if (c.step === "2") {
          // a new family keeps the way to the whole record, after "Log a moment"
          const full = page.indexOf('data-testid="consult-full-record"');
          expect(full).toBeGreaterThan(page.indexOf('data-testid="consult-empty-cta"'));
          expect(bodyAt(page, full)).toEqual({ id: "consult-step-2", hidden: false });
          expect(page).not.toContain('data-testid="consult-next"');
          expect(page).not.toContain('data-testid="consult-copy"');
        }
      }
    });

    it(`${locale}: a caller's reason (Appointments' "Prepare") is said in step 1 on arrival; step 2's field holds the same words`, () => {
      harness.locale = locale;
      harness.appts = [visitIn3()];
      // invented words
      const words = locale === "he" ? "לשאול על שגרת השינה החדשה" : "Ask about the new sleep routine";
      harness.prefill = { reason: words };
      const page = decode(renderToStaticMarkup(<ConsultTab />));
      const at = page.indexOf('data-testid="consult-reason-carried"');
      expect(at).toBeGreaterThan(0);
      expect(bodyAt(page, at)).toEqual({ id: "consult-step-1", hidden: false });
      expect(at).toBeLessThan(page.indexOf('data-testid="consult-build"'));
      const line = /<p[^>]*data-testid="consult-reason-carried"[^>]*>([\s\S]*?)<\/p>/.exec(page)!;
      expect(line[0]).not.toContain("data-primary-move");
      expect(line[1]).toContain(">edit_note<");
      const text = line[1].replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      expect(text).toBe(`${translate(locale, "elev.consult.reason.carried")} ${words}`);
      expect(line[1]).toContain('<bdi dir="auto"');
      expect(/<textarea[^>]*data-testid="consult-reason-input"[^>]*>([^<]*)<\/textarea>/.exec(page)![1]).toBe(words);
      // nothing carried: no line
      harness.prefill = null;
      expect(renderToStaticMarkup(<ConsultTab />)).not.toContain('data-testid="consult-reason-carried"');
    });

    it(`${locale}: the Appointments door reads ConsultTab's own visits — the next day, then the past visits with notes (a count)`, () => {
      harness.locale = locale;
      const next = visitIn3();
      // invented: a pediatrician visit ten days ago, with the family's note
      const past = { id: "p1", who: "", role: "Pediatrician", profession: "pediatrician", whenIso: new Date(Date.now() - 10 * DAY).toISOString(), when: "", mode: "In person", status: "done" };
      harness.appts = [next, past];
      harness.followUps = [{ id: "f1", apptId: "p1", note: locale === "he" ? "לחזור בעוד חודש" : "Come back in a month", createdAt: new Date(Date.now() - 9 * DAY).toISOString() }];
      const doors = sliceModule(renderToStaticMarkup(<ConsultTab />), "consult-doors");
      const sub = textOf(doors.slice(doors.indexOf('data-door="appointments"')), "care-door-sub");
      expect(sub).toBe([
        translate(locale, "elev.consult.door.appointments.next", { day: fmtDayShort(next.whenIso, locale) }),
        translate(locale, "elev.consult.door.appointments.past.one", { n: 1 }),
      ].join(" · "));
      expect(sub).not.toMatch(/%|\bof\s+\d|מתוך/);
    });
  }

  it("#/handoff keeps the builder alone: no kicker, visit card, chips, aside or doors", () => {
    harness.tab = "handoff";
    harness.appts = [visitIn3()];
    const html = renderToStaticMarkup(<ConsultTab />);
    expect(modulesOf(html)).toEqual(["consult-packet"]);
    for (const id of ["consult-kicker", "consult-sub", "consult-visit-card", "consult-visit-card-head", "consult-visit-head", "consult-bring-row", "consult-preview-note", "consult-trust-line"]) {
      expect(html, id).not.toContain(`data-testid="${id}"`);
    }
    expect((html.match(/data-primary-move="/g) ?? []).length).toBe(1);
    expect(html).toContain('data-primary-move="copy-handoff-brief"');
    // v3 F-CARE-1: the stepper is the landing's; the summary page keeps the
    // stacked builder with its lg two-pane fold, every step shown
    for (const id of ["consult-stepper", "consult-step", "consult-next", "consult-audience-change", "consult-visit-outcome-link"]) {
      expect(html, id).not.toContain(`data-testid="${id}"`);
    }
    for (const id of ["consult-step-1", "consult-step-2", "consult-review-export"]) {
      expect(new RegExp(`<[a-z0-9]+ [^>]*\\bid="${id}"[^>]*>`).exec(html)![0], id).not.toMatch(/\shidden=""/);
    }
    expect(/<div[^>]*data-testid="consult-panes"[^>]*>/.exec(html)![0]).toContain("lg:grid");
    expect(/<div[^>]*data-testid="consult-review-export"[^>]*>/.exec(html)![0]).toContain("lg:sticky");
    expect(html).toContain('role="radio"');
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

  it("unit: consultStampSite — the stacked builder keeps Build; the stepper follows the shown step", () => {
    expect(consultStampSite(false, 1, false)).toBe("build");
    expect(consultStampSite(false, 2, true)).toBe("build");
    expect(consultStampSite(false, 3, false)).toBe("build");
    expect(consultStampSite(true, 1, false)).toBe("build");
    expect(consultStampSite(true, 1, true)).toBe("build");
    // step 2 with a packet: Continue (a click away in the browser; the sweep's stepper-tabs state walks it)
    expect(consultStampSite(true, 2, false)).toBe("next");
    expect(consultStampSite(true, 2, true)).toBe("empty");
    expect(consultStampSite(true, 3, false)).toBe("copy");
  });

  it("the doors are the Care pages, each with its pill's own glyph", () => {
    expect(careDoors().map((d) => [d.tab, d.icon])).toEqual([["school-brief", "backpack"], ["appointments", "calendar_month"], ["handoff", "description"]]);
  });

  it("ConsultTab stamps one module literal; the aside and doors stamp their own, and no move", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    const consult = strip(readFileSync("src/components/tabs/ConsultTab.tsx", "utf8"));
    expect(consult.match(/\bdata-module\b(?!-)/g) ?? []).toHaveLength(1);
    const aside = strip(readFileSync("src/components/care/CareAside.tsx", "utf8"));
    const doors = strip(readFileSync("src/components/care/CareDoors.tsx", "utf8"));
    expect(aside).toContain('data-module="consult-aside"');
    expect(doors).toContain('data-module="consult-doors"');
    // r2: the doors open no listener of their own; ConsultTab hands them its collections
    expect(doors).not.toContain("useChildCollection");
    expect(consult).toMatch(/<CareDoors appts=\{apptsCol\.items\} followUps=\{followUpsCol\.items\} ready=\{apptsCol\.loaded && !apptsCol\.error\} \/>/);
    for (const src of [aside, doors, strip(readFileSync("src/components/care/CareVisitHead.tsx", "utf8"))]) {
      expect(src).not.toContain("data-primary-move");
      expect(src).not.toMatch(/gradient-cta|arbor-gradient-primary/);
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toMatch(/\b(?:margin|padding)-(?:left|right)\b|\b(?:ml|mr|pl|pr|left|right)-\d/);
    }
  });
});
