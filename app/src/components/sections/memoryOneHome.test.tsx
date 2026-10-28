/**
 * B-CAREPRO-38 — ONE home for what Arbor remembers. #/memory and its alias
 * #/child-memory retired into My child › About (#/profile): every way in lands
 * there with the full ledger ("Everything Arbor remembers") open in place, so
 * a parent approves, corrects (Edit) and forgets a remembered fact on one page.
 * Embedded, the ledger has no page header and no move of its own (About keeps
 * its one), every module it stamps is demoted, and a proposal the page already
 * asks about (in its area or on the card) is never asked twice.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { RETIRED_ROUTES, ROUTE_IDS, resolveHash, resolveRouteId } from "../../lib/routes";
import { contractFor } from "../../lib/surfaceContract";
import { sectionForTab, SECTIONS } from "../../lib/navigation";
import type { MemoryReviewItem } from "../../types";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he", approved: [] as unknown[], pending: [] as unknown[] }));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa Levi", gender: "girl" },
    approvedMemoryItems: harness.approved, pendingMemoryItems: harness.pending,
    handleMemoryDecision: vi.fn(async () => true), isMemoryUpdating: null, memoryReviewError: false, memoryReviewErrorKind: null,
    retryMemoryReview: vi.fn(), savedLearnIds: [], requestLearnRead: vi.fn(), setActiveTab: vi.fn(),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, aiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }),
}));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, confirmed: true, error: false, upsert: vi.fn(), remove: vi.fn() }) }));
// The ledger's own sub-panels have their own suites; here only the ledger's frame is read.
vi.mock("../describe/KeptDescription", () => ({ default: () => null }));
vi.mock("../coach/CoachDataContract", () => ({ default: () => <div data-testid="coach-contract-panel" /> }));
vi.mock("./FirstsMoment", () => ({ default: () => null }));
vi.mock("./ArborKnowsTile", () => ({ default: () => null }));

import ChildMemory from "./ChildMemory";

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const item = (id: string, status: "pending" | "approved", fact: string): MemoryReviewItem => ({
  memoryId: id, childId: "c1", status, fact, source: "chat", retention: "90 days",
  createdAt: "2026-10-20T10:00:00.000Z", latestEventId: `e-${id}`,
});

describe("B-CAREPRO-38 · every door lands on About", () => {
  it("#/memory and #/child-memory (any case, any query) resolve to #/profile; the id keeps its seat", () => {
    expect(RETIRED_ROUTES.memory).toBe("profile");
    expect(ROUTE_IDS as readonly string[]).toContain("memory");
    for (const hash of ["#/memory", "#/Memory", "#/memory?section=coach", "#/child-memory", "#/Child-Memory/"]) {
      expect(resolveHash(hash), hash).toEqual({ tab: "profile", unknown: false });
    }
    expect(resolveRouteId("child-memory")).toBe("profile");
    expect(resolveHash("", "memory")).toEqual({ tab: "profile", unknown: false });
    expect(sectionForTab("memory").id).toBe("profile");
    expect(SECTIONS.flatMap((s) => [...s.items, ...s.tools]).some((i) => i.tab === "memory")).toBe(false);
  });

  it("the registry seat renders the About leaf; the seat's contract is About's own", () => {
    const shell = read("components/layout/Shell.tsx");
    expect(shell).toMatch(/^\s*memory: ChildProfile,$/m);
    expect(shell).not.toContain('import("../sections/ChildMemory")');
    const seat = contractFor("memory")!, home = contractFor("profile")!;
    expect([seat.primaryMove, seat.moduleBudget, seat.job]).toEqual([home.primaryMove, home.moduleBudget, home.job]);
    // NEGATIVE CONTROL: the pre-change registry line is what the match rejects.
    expect(/^\s*memory: ChildProfile,$/m.test("  memory: ChildMemory,")).toBe(false);
  });

  it("About opens the ledger in place when the parent arrives on a retired memory link or taps the door", () => {
    const about = read("components/sections/ChildProfile.tsx");
    expect(about).toContain('const ledgerAsked = activeTab === "memory" || routeKey === "memory" || routeKey === "child-memory";');
    // r2: once per arrival, keyed on the query VALUE (useLedgerArrival.test covers re-render + close)
    expect(about).toContain('const [ledgerOpen, toggleLedger] = useLedgerArrival(ledgerAsked, hashQuery.get("section"));');
    expect(about).not.toMatch(/\[[^\]]*\bhashQuery\]\)/);
    expect(about).toContain("<AboutMemoryCard areas={aspects} ledgerOpen={ledgerOpen} onLedger={toggleLedger} />");
    expect(about).toContain('<ChildMemoryLedger embedded hidePendingIds={askedHere} />');
    expect(about).toContain("id={LEDGER_ID}");
  });
});

describe("B-CAREPRO-38 · the embedded ledger: approve, correct and forget on About's page", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: Approve on a proposal About does not ask about; Edit and Forget on a remembered fact; no header, no move, every stamp demoted`, () => {
      harness.locale = locale;
      harness.pending = [item("p-asked", "pending", "Asked in an area already"), item("p-ledger", "pending", "Only the ledger asks this")];
      harness.approved = [item("a1", "approved", "Loves the moon story")];
      const html = renderToStaticMarkup(<ChildMemory embedded hidePendingIds={new Set(["p-asked"])} />);
      // one approval home: the proposal About asks elsewhere is not asked twice
      expect(html).not.toContain("Asked in an area already");
      expect(html).toContain("Only the ledger asks this");
      expect(html).toContain(translate(locale, "elev.childmem.action.approve"));
      // correct (Edit) and forget on the remembered fact
      expect(html).toContain("Loves the moon story");
      expect(html).toContain('data-testid="memory-edit-open"');
      expect(html).toContain(translate(locale, "elev.childmem.action.forget"));
      // the coach's view (consent switch) stays reachable here
      expect(html).toContain('data-testid="coach-contract-panel"');
      // About owns the page: no second header, no second move, no undemoted module
      expect(html).not.toContain(translate(locale, "sec.mem.title"));
      expect(html).not.toContain("data-primary-move");
      const stamps = html.match(/<[^>]*data-module="[^"]+"[^>]*>/g) ?? [];
      expect(stamps.length).toBeGreaterThan(0);
      for (const s of stamps) expect(s, s).toContain("data-module-demoted");
      expect(html).not.toContain(translate(locale, "elev.childmem.more.door"));
    });
  }

  it("NEGATIVE CONTROL: the stand-alone ledger still stamps its move and its modules (the embedded flag is what removes them)", () => {
    harness.locale = "en";
    harness.pending = [item("p1", "pending", "Something to approve")];
    harness.approved = [];
    const html = renderToStaticMarkup(<ChildMemory />);
    expect(html).toContain('data-primary-move="approve-memory-fact"');
    expect(html).toMatch(/data-module="memory-pending"(?! data-module-demoted)/);
  });
});
