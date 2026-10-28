/**
 * B-DATA-16 — the co-regulation script a parent used is stored on the hard
 * moment (`BehaviorLog.coRegulationScript`), and "what helped last time"
 * names it.
 *
 *  - The guide card's "I used these words — keep this moment" opens the ONE
 *    capture sheet with that card id (the parent's explicit choice).
 *  - The readers: a held answer ("helped", the parent's own word) still
 *    leads; without one, the last hard moment logged with these words leads,
 *    said as USED — never "helped" (no automatic favourable outcome).
 * Synthetic data only; the child name is invented.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { HARD_MOMENT_PILOT } from "../../content/pilotRelease";
import { hardMomentCards } from "../../content/hardMomentCards";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { BehaviorLog } from "../../types";

const harness = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  cardId: "tantrum" as string | undefined,
  behaviorLogs: [] as unknown[],
  actionLoop: [] as unknown[],
  birthDate: "2022-01-01",
  closeHardMomentNow: vi.fn(),
  openCaptureSheet: vi.fn(),
  captured: [] as { type: unknown; props: Record<string, any> }[],
}));

vi.mock("../../context/LanguageContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../context/LanguageContext")>()),
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));
vi.mock("../../context/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../context/AuthContext")>()),
  useAuth: () => ({ user: null }),
}));
vi.mock("../../context/ArborContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../context/ArborContext")>()),
  useArbor: () => ({
    hardMomentNow: { open: true, cardId: harness.cardId },
    closeHardMomentNow: harness.closeHardMomentNow,
    childProfile: { id: "c1", name: "Noa Example", birthDate: harness.birthDate },
    behaviorLogs: harness.behaviorLogs,
    acceptTodayAction: vi.fn(),
    activeTodayAction: null,
    setActiveTab: vi.fn(),
    setAskHardMomentRef: vi.fn(),
    requestLearnRead: vi.fn(),
    actionLoop: harness.actionLoop,
    openCaptureSheet: harness.openCaptureSheet,
  }),
}));
vi.mock("../ui/Modal", () => {
  const Modal = ({ open, title, children }: { open: boolean; title?: string; children: React.ReactNode }) =>
    open ? <div data-testid="modal-stub"><h3>{title}</h3>{children}</div> : null;
  return { Modal, default: Modal };
});
const capture = vi.hoisted(() => (type: unknown, props: any) => { harness.captured.push({ type, props }); });
vi.mock("react/jsx-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-runtime")>();
  return { ...real, jsx: (...args: Parameters<typeof real.jsx>) => { capture(args[0], args[1]); return real.jsx(...args); }, jsxs: (...args: Parameters<typeof real.jsxs>) => { capture(args[0], args[1]); return real.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...args: Parameters<typeof real.jsxDEV>) => { capture(args[0], args[1]); return real.jsxDEV(...args); } };
});

import HardMomentNowSheet from "./HardMomentNowSheet";
import { LastTimeLead } from "./HardMomentWords";
import { lastTimeFor, lastUsedFor, scriptCard } from "./hardMomentLastTime";

const tantrum = hardMomentCards.find((c) => c.id === "tantrum")!;
const other = hardMomentCards.find((c) => c.id !== "tantrum")!;
const inPilot = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) - 7 * 86_400_000);
const log = (over: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: "log-1", timestamp: "2026-10-02T18:00:00.000Z", behaviorType: "Transition Refusal",
  durationMinutes: 10, trigger: "Leaving the park", response: "Named the feeling", ...over,
});
const heldRow = (at: string): ActionLoopEntry => ({
  id: "today.c1.2026-10-01", recommendation: tantrum.doNow.en, source: "hard-moment", capacity: "standard",
  status: "completed", outcome: "helped", held: "yes", outcomeAt: at, acceptedAt: "2026-10-01T17:00:00.000Z",
});
const escapeHtml = (text: string) => renderToStaticMarkup(<span>{text}</span>).slice(6, -7);

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(inPilot); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => {
  harness.lang = "en"; harness.cardId = "tantrum"; harness.behaviorLogs = []; harness.actionLoop = []; harness.captured = [];
  harness.birthDate = new Date(inPilot.getTime() - 4 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  vi.clearAllMocks();
});

describe("B-DATA-16 — the readers", () => {
  it("scriptCard resolves a stored id; an unknown id names nothing", () => {
    expect(scriptCard("tantrum")?.id).toBe("tantrum");
    expect(scriptCard("no-such-guide")).toBeUndefined();
    expect(scriptCard(undefined)).toBeUndefined();
  });

  it("lastUsedFor: the newest hard moment logged with THIS guide's id; others and unscripted rows never count", () => {
    const logs = [
      log({ id: "a", timestamp: "2026-10-01T08:00:00.000Z", coRegulationScript: "tantrum" }),
      log({ id: "b", timestamp: "2026-10-03T08:00:00.000Z", coRegulationScript: "tantrum" }),
      log({ id: "c", timestamp: "2026-10-05T08:00:00.000Z", coRegulationScript: other.id }),
      log({ id: "d", timestamp: "2026-10-06T08:00:00.000Z" }),
    ];
    expect(lastUsedFor(tantrum, logs)).toEqual({ at: "2026-10-03T08:00:00.000Z" });
    expect(lastUsedFor(tantrum, [log()])).toBeNull();
  });

  it("lastTimeFor: the parent's held answer leads; without one, the used words (said as used)", () => {
    const used = [log({ coRegulationScript: "tantrum" })];
    expect(lastTimeFor(tantrum, [heldRow("2026-09-20T20:00:00.000Z")], used)).toEqual({ at: "2026-09-20T20:00:00.000Z", basis: "held" });
    expect(lastTimeFor(tantrum, [], used)).toEqual({ at: "2026-10-02T18:00:00.000Z", basis: "used" });
    expect(lastTimeFor(tantrum, [], [log()])).toBeNull();
  });
});

describe("B-DATA-16 — 'what helped last time' names the words (rendered, EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the used lead names the guide's Say-this words and never claims they helped`, () => {
      const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
      const html = renderToStaticMarkup(<LastTimeLead card={tantrum} childName="Noa" at="2026-10-02T18:00:00.000Z" basis="used" locale={lang} t={t} />);
      expect(html).toContain(escapeHtml(t("elev.closeloop.hm.usedLead", { name: "Noa" })));
      expect(html).not.toContain(escapeHtml(t("hm.lastTime.lead", { name: "Noa" })));
      expect(html).toContain(escapeHtml(tantrum.sayThis[lang]));
      expect(html).toContain('data-basis="used"');
    });

    it(`${lang}: the guide card leads with the used words when the parent logged a hard moment with them`, () => {
      harness.lang = lang;
      harness.behaviorLogs = [log({ coRegulationScript: "tantrum" })];
      const html = renderToStaticMarkup(<HardMomentNowSheet />);
      expect(html).toContain('data-testid="hm-last-time"');
      expect(html).toContain(escapeHtml(translate(lang, "elev.closeloop.hm.usedLead", { name: "Noa" })));
    });
  }

  it("the copy says used in both locales and never 'helped'", () => {
    for (const k of ["elev.closeloop.hm.usedKeep", "elev.closeloop.hm.usedLabel", "elev.closeloop.hm.usedFrom", "elev.closeloop.hm.usedRemove", "elev.closeloop.hm.usedLead"]) {
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(k);
      expect(translate("he", k).replace(/\{\w+\}/g, ""), k).not.toMatch(/[A-Za-z]/);
      expect(`${translate("en", k)} ${translate("he", k)}`, k).not.toMatch(/helped|עזר/i);
    }
  });
});

describe("B-DATA-16 — the guide card's 'I used these words' is the parent's explicit choice", () => {
  it("opens the ONE capture sheet with this card's id, closing the guide first; nothing is written by the tap", () => {
    renderToStaticMarkup(<HardMomentNowSheet />);
    const button = harness.captured.find((c) => c.props?.["data-testid"] === "hard-moment-now-used");
    expect(button, "the guide card offers 'I used these words'").toBeTruthy();
    expect(button!.props.className).toContain("min-h-11");
    button!.props.onClick();
    expect(harness.closeHardMomentNow).toHaveBeenCalledTimes(1);
    expect(harness.openCaptureSheet).toHaveBeenCalledWith({ mode: "text", coRegulationScript: "tantrum" });
    expect(harness.closeHardMomentNow.mock.invocationCallOrder[0]).toBeLessThan(harness.openCaptureSheet.mock.invocationCallOrder[0]);
  });

  it("is labelled in both locales", () => {
    for (const lang of ["en", "he"] as const) {
      harness.lang = lang;
      expect(renderToStaticMarkup(<HardMomentNowSheet />)).toContain(escapeHtml(translate(lang, "elev.closeloop.hm.usedKeep")));
    }
  });
});
