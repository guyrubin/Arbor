/** B-LOOP-10 / B-ASKJB-36: a confirmed AI suggestion is never the child's
 * verbatim quote. Exercise the real readers and their egress builders, not
 * only a source-code pin. All fixtures are synthetic; nothing is persisted. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";

type QuoteDoc = KeepsakeDoc & Record<string, unknown>;
type Button = { "data-testid"?: string; disabled?: boolean; onClick?: () => void };
const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he", docs: [] as QuoteDoc[], buttons: [] as Button[],
  sends: [] as { getText: () => string; disabled?: boolean }[],
  print: vi.fn(), share: vi.fn().mockResolvedValue("copied"), write: vi.fn(),
  profile: { id: "quote-child", name: "Dylan", age: 3, birthDate: "2023-08-01", gender: "boy" as const, languages: ["English"], strengths: [], challenges: [], schoolContext: "" },
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: h.profile, behaviorLogs: [], milestones: [], actionLoop: [], actionPlans: [],
    approvedMemoryItems: [], pendingMemoryItems: [], savedLearnIds: [], setActiveTab: vi.fn(), pendingConsultPrefill: null,
    consumeConsultPrefill: vi.fn(), handleMemoryDecision: h.write, isMemoryUpdating: false }),
  useArborOptional: () => null,
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Synthetic Parent" } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, aiLang: h.lang,
  t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v) }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }), useToastOptional: () => null }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({
  items: name === "keepsakes" ? h.docs : [], loaded: true, error: false, remote: false,
  upsert: h.write, remove: h.write, replaceAll: h.write,
}) }));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [{ id: "langObs:real-word", origin: "langObs", shelf: "words", at: "2026-10-04T12:00:00Z" }] }));
vi.mock("../../hooks/useTimeline", () => ({ useTimeline: () => [] }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams("view=said&month=2026-10"), goToRoute: vi.fn() }));
vi.mock("../share/SendSheet", () => ({ SendButton: (props: { getText: () => string; disabled?: boolean; testId?: string }) => {
  h.sends.push(props); return <button data-testid={props.testId} disabled={props.disabled}>Send</button>;
} }));
vi.mock("../../lib/reportExport", () => ({ openPrintableReport: h.print }));
vi.mock("../../lib/share", async original => ({ ...await original<typeof import("../../lib/share")>(), shareWordsText: h.share }));
vi.mock("../sections/Reports", () => ({ useConsultPdf: () => h.print }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: vi.fn(), step: null }) }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));
vi.mock("../sections/FirstsMoment", () => ({ default: () => null }));
vi.mock("../sections/ArborKnowsTile", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: () => null, default: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") h.buttons.push(props as Button);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); },
    jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});

import SaidPage from "./SaidPage";
import { SaidList } from "./ThingsSaid";
import ChildMemory from "../sections/ChildMemory";
import MilestonesTab from "../tabs/MilestonesTab";
import JournalShelves from "../journal/JournalShelves";
import AskSpecialist from "../sections/AskSpecialist";
import { quotesFromDocs } from "../../lib/loop/tonight";
import { keptThings } from "../../lib/kept/keptThings";
import { toObservations } from "../../lib/observations";
import { buildIntakePacket, exportPrintSections, serializeForExport } from "../../consult/packet";

// Exact negative marker and source used by scripts/capture/record-contract.mjs.
const FORBIDDEN = "CAPTURE AI QUOTE MUST STAY OUT";
const OWN = "The moon follows our car";
const quote = (id: string, note: string, patch: Record<string, unknown> = {}): QuoteDoc => ({
  id, kind: "quote", milestoneId: "", note, noticedOn: "2026-10-05", createdAt: "2026-10-05", updatedAt: "2026-10-05", ...patch,
});
const genuine = quote("parent-quote", OWN, { noticedOn: "2026-10-04" });
const generated = quote("capture-record-ai", FORBIDDEN, { source: "ai_proposed_parent_confirmed" });
const prohibited = [
  ...["ai_proposed_parent_confirmed", "ai_proposed_unconfirmed", "kid_practice", "professional_entered", "document_extracted", "future_source", "", null, {}]
    .flatMap(source => [{ source }, { observationSource: source }]),
  { captureSource: "co_parent" }, { conversationProposalId: "proposal-1" },
  { source: "parent_typed", observationSource: "ai_proposed_parent_confirmed" },
  { source: "parent_voice", captureSource: "co_parent" },
  { source: "parent_typed", conversationProposalId: "confirmed-proposal" },
];

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  h.lang = "en"; h.docs = [genuine, generated]; h.buttons = []; h.sends = [];
});
afterEach(() => { expect(h.write).not.toHaveBeenCalled(); vi.useRealTimers(); });

function expectOwnOnly(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  expect(text).not.toContain(FORBIDDEN);
  expect(text).toContain(OWN);
}

describe("shared parent-written quote eligibility", () => {
  it("preserves legacy, typed and voice quotes verbatim, in newest-first order, without mutating records", () => {
    const docs = [genuine, quote("typed", "  exact typed words  ", { source: "parent_typed", noticedOn: "2026-10-06" }),
      quote("voice", "מילים שנשמרו", { source: "parent_voice", observationSource: "parent_voice", noticedOn: "2026-10-07" })];
    const before = JSON.stringify(docs);
    docs.forEach(Object.freeze); Object.freeze(docs);
    expect(quotesFromDocs(docs)).toEqual(docs.slice().reverse().map(({ id, note, noticedOn }) => ({ id, note, noticedOn })));
    expect(keptThings({ keepsakes: docs }, h.profile).map(item => item.text)).toEqual(docs.slice().reverse().map(item => item.note));
    expect(JSON.stringify(docs)).toBe(before);
  });
  it.each(prohibited)("rejects provenance %j in both kept selectors", patch => {
    const row = Object.freeze(quote("unsafe", FORBIDDEN, patch));
    expect(keptThings({ keepsakes: [row] }, h.profile)).toEqual([]);
    expect(quotesFromDocs([row])).toEqual([]);
  });
  it("does not turn quote keepsakes into child observations or mutate retained AI records", () => {
    const before = JSON.stringify(h.docs);
    expect(toObservations({ keepsakes: h.docs }, h.profile)).toEqual([]);
    expectOwnOnly(quotesFromDocs(h.docs));
    expect(JSON.stringify(h.docs)).toBe(before);
  });
});

describe("real quote consumers", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: SaidPage renders and sends only genuine words; the actual Print handler receives only those words`, () => {
      h.lang = lang;
      expectOwnOnly(renderToStaticMarkup(<SaidPage />));
      expect(h.sends).toHaveLength(1);
      expect(h.sends[0].disabled).toBe(false);
      expectOwnOnly(h.sends[0].getText());
      const print = h.buttons.find(button => button["data-testid"] === "said-print")!;
      expect(print.disabled).toBe(false); print.onClick!();
      expectOwnOnly(h.print.mock.calls[0][0]);
    });
    it(`${lang}: AI-only SaidPage is empty with both export actions disabled`, () => {
      h.lang = lang; h.docs = [generated];
      const html = renderToStaticMarkup(<SaidPage />);
      expect(html).not.toContain(FORBIDDEN);
      expect(html).toContain('data-testid="said-page-empty"');
      expect(h.sends[0].disabled).toBe(true);
      expect(h.buttons.find(button => button["data-testid"] === "said-print")?.disabled).toBe(true);
    });
  }
  it("ThingsSaid's language list excludes generated quotes", () => {
    expectOwnOnly(renderToStaticMarkup(<SaidList childId={h.profile.id} first="Dylan" gender="boy" />));
  });
  it("ChildMemory renders and shares only the real quote through ThingsSaid", async () => {
    expectOwnOnly(renderToStaticMarkup(<ChildMemory />));
    const buttons = h.buttons.filter(button => button["data-testid"] === "things-said-share");
    expect(buttons).toHaveLength(1); buttons[0].onClick!();
    await Promise.resolve(); expectOwnOnly(h.share.mock.calls[0][0]);
  });
  it("Milestones' quoted context excludes generated words", () => {
    expectOwnOnly(renderToStaticMarkup(<MilestonesTab />));
  });
  it("Journal's Words tile excludes generated words", () => {
    expectOwnOnly(renderToStaticMarkup(<JournalShelves shelf={null} />));
  });
  it("Journal's Words shelf excludes generated words", () => {
    expectOwnOnly(renderToStaticMarkup(<JournalShelves shelf="words" />));
  });
  it("Journal's professional packet excludes generated words", () => {
    expectOwnOnly(renderToStaticMarkup(<JournalShelves shelf={null} pro intakeFor="slp" />));
  });
  it("AskSpecialist's actual packet and export preview exclude generated words", () => {
    expectOwnOnly(renderToStaticMarkup(<AskSpecialist intake="slp" />));
  });
  it("professional Send/Copy and printable sections use the eligible quote projection", () => {
    for (const lang of ["en", "he"] as const) {
      const packet = buildIntakePacket("slp", { child: h.profile, milestones: [], behaviorLogs: [], actionLoops: [],
        nowMs: Date.now(), lang, quotes: quotesFromDocs(h.docs) });
      expectOwnOnly(serializeForExport("self", packet, new Set(), "", "", lang));
      expectOwnOnly(exportPrintSections("self", packet, new Set(), "", "", lang));
    }
  });
});
