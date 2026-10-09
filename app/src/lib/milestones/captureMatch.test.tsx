import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-06 — the client half: candidates (open, catalogue, in window, ≤ 24),
   when a saved moment may ask, the one request (any failure = no row), the
   row (44 px, EN + HE, no verdict), the filed moment lands on its shelf, and
   the capture sheet writes ONLY on the parent's tap. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../i18n")>("../i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import MilestoneProposalRow from "../../components/loop/MilestoneProposalRow";
import { ALL_MILESTONES, bandForAgeMonths } from "../milestoneData";
import { toObservations } from "../observations";
import { loopFirewallHits } from "../loop/firewall";
import { MAX_CANDIDATE_IDS, milestoneCandidateIds, milestoneMatchAllowed, requestMilestoneProposal } from "./captureMatch";
import type { BehaviorLog, ChildProfile, Milestone } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");
const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("milestoneCandidateIds", () => {
  it("open catalogue rows in the window only, never ahead of band, ≤ 24", () => {
    const ids = milestoneCandidateIds([...catalogue(), { id: "custom-1", custom: true, domain: "language_communication", ageMonths: 24, ageGroup: "Custom", title: "x", description: "", checked: false }], 26);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAX_CANDIDATE_IDS);
    expect(ids).not.toContain("custom-1");
    for (const id of ids) {
      const m = ALL_MILESTONES.find((x) => x.id === id)!;
      expect(bandForAgeMonths(m.ageMonths as number).months).toBeLessThanOrEqual(24);
    }
    const seen = catalogue().map((m) => (m.id === ids[0] ? { ...m, checked: true } : m));
    expect(milestoneCandidateIds(seen, 26)).not.toContain(ids[0]);
    expect(milestoneCandidateIds(catalogue(), null)).toEqual([]);
  });
});

describe("milestoneMatchAllowed — when a saved moment may ask", () => {
  const log = { id: "log-1", trigger: "She said big ball at the park" };
  it("a plain moment the parent wrote may ask; a hard moment, a private log, a photo caption or a short line never does", () => {
    expect(milestoneMatchAllowed(log, { childId: "k", hard: false, storage: mem() })).toBe(true);
    expect(milestoneMatchAllowed(log, { childId: "k", hard: true, storage: mem() })).toBe(false);
    expect(milestoneMatchAllowed({ ...log, private: true }, { childId: "k", hard: false, storage: mem() })).toBe(false);
    expect(milestoneMatchAllowed(log, { childId: "k", hard: false, photoOnly: true, storage: mem() })).toBe(false);
    expect(milestoneMatchAllowed({ ...log, trigger: "cute" }, { childId: "k", hard: false, storage: mem() })).toBe(false);
  });
  it("a log the parent answered 'Not this' for never asks again", async () => {
    const { declineMilestoneProposal } = await import("./proposalLedger");
    const store = mem();
    declineMilestoneProposal("k", "log-1", store);
    expect(milestoneMatchAllowed(log, { childId: "k", hard: false, storage: store })).toBe(false);
  });
});

describe("requestMilestoneProposal — one call, any failure is no row", () => {
  const child = { id: "k", name: "Noa" } as ChildProfile;
  const log = { id: "log-1", trigger: "She said big ball" };
  it("sends the candidates and turns the validated match into one row", async () => {
    let sent: unknown = null;
    const p = await requestMilestoneProposal({
      extract: async (body) => { sent = body; return { milestoneMatch: { shelf: "words", milestoneId: "cdc-24m-3", confidence: "high" } }; },
      log, childProfile: child, language: "he", candidateIds: ["cdc-24m-3"],
    });
    expect(sent).toMatchObject({ message: "She said big ball", language: "he", milestoneCandidateIds: ["cdc-24m-3"] });
    expect(p).toEqual({ kind: "milestone", logId: "log-1", shelf: "words", milestoneId: "cdc-24m-3" });
  });
  it("no candidates → no call; a thrown escalation / network error → null; no match → null", async () => {
    let calls = 0;
    const extract = async () => { calls++; throw new Error("409"); };
    expect(await requestMilestoneProposal({ extract, log, childProfile: child, language: "en", candidateIds: [] })).toBeNull();
    expect(calls).toBe(0);
    expect(await requestMilestoneProposal({ extract, log, childProfile: child, language: "en", candidateIds: ["cdc-24m-3"] })).toBeNull();
    expect(await requestMilestoneProposal({ extract: async () => ({ milestoneMatch: null }), log, childProfile: child, language: "en", candidateIds: ["cdc-24m-3"] })).toBeNull();
  });
});

describe("MilestoneProposalRow", () => {
  const render = (lang: "en" | "he", kind: "milestone" | "shelf", done = false) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <MilestoneProposalRow
        proposal={kind === "milestone" ? { kind, logId: "l", shelf: "words", milestoneId: "cdc-24m-3" } : { kind, logId: "l", shelf: "sleep" }}
        milestoneTitle={lang === "he" ? "אומרת שתי מילים ביחד" : "Says two words together"}
        done={done}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />,
    );
  };
  const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  it("two 44 px buttons; names the milestone and the shelf; EN + HE; no verdict; logical classes only", () => {
    for (const lang of ["en", "he"] as const) {
      for (const kind of ["milestone", "shelf"] as const) {
        const html = render(lang, kind);
        const buttons = html.match(/<button[^>]*>/g) ?? [];
        expect(buttons).toHaveLength(2);
        for (const b of buttons) expect(b).toMatch(/min-h-\[44px\]/);
        expect(loopFirewallHits(text(html))).toEqual([]);
        expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-[\w[]/);
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
    }
    expect(text(render("en", "milestone"))).toContain("Says two words together");
    expect(text(render("en", "milestone"))).toContain("Words");
    expect(text(render("he", "shelf"))).toContain("שינה");
  });
  it("after Add / File it the row is a one-line receipt", () => {
    const html = render("en", "milestone", true);
    expect(html).toContain('data-testid="capture-milestone-done"');
    expect(html).not.toContain("<button");
  });
});

describe("the filed moment lands on its shelf (read model)", () => {
  const base = { id: "log-9", timestamp: "2026-10-05T09:00:00.000Z", behaviorType: "Moment", durationMinutes: 0, trigger: "said big ball" } as BehaviorLog;
  it("words / sleep / food by the confirmed shelf; the milestone is the provenance", () => {
    const [w] = toObservations({ behaviorLogs: [{ ...base, shelf: "words", milestoneId: "cdc-24m-3" }] }, { id: "k" });
    expect(w.shelf).toBe("words");
    expect(w.provenance).toBe("cdc-24m-3");
    expect(toObservations({ behaviorLogs: [{ ...base, shelf: "sleep" }] }, { id: "k" })[0].shelf).toBe("sleep");
    expect(toObservations({ behaviorLogs: [{ ...base, shelf: "food" }] }, { id: "k" })[0].shelf).toBe("food");
    // A plain moment the parent never filed carries no developmental meaning (no inferred shelf).
    expect(toObservations({ behaviorLogs: [base] }, { id: "k" })[0].shelf).toBeUndefined();
  });
});

describe("the capture sheet writes only on the parent's tap (source pins)", () => {
  const modal = src("components/overview/QuickLogModal.tsx");
  it("the request follows the plain-moment save; Add writes through the one milestone seam with the AI-proposed source and the log id", () => {
    expect(modal).toContain("if (milestoneMatchAllowed(written, { childId: childProfile.id, hard: false, photoOnly: !typedWords })) {");
    expect(modal).toContain('setMilestoneObservation(msProposal.milestoneId, "yes", { source: "ai_proposed_parent_confirmed", provenance: msProposal.logId });');
    expect(modal).toContain("declineMilestoneProposal(childProfile.id, msProposal.logId);");
    const accept = modal.slice(modal.indexOf("const acceptMilestoneProposal"), modal.indexOf("const declineMilestoneProposalRow"));
    expect(accept).toContain("fileMomentOnShelf(");
    // nothing writes when the proposal arrives — only setMsProposal
    const then = modal.slice(modal.indexOf(".then((p) => {"), modal.indexOf("});", modal.indexOf(".then((p) => {")));
    expect(then).not.toMatch(/setMilestoneObservation|fileMomentOnShelf/);
  });
});
