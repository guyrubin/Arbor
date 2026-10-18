import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile, Milestone } from "../../types";
import type { Observation, ObservationSources } from "../../lib/observations";

const h = vi.hoisted(() => ({
  uid: "account-a", profile: { id: "child-a", name: "Noa", age: 3 } as ChildProfile,
  milestones: [] as Milestone[], query: "", lang: "en" as "en" | "he",
  record: { observations: [] as Observation[], sources: {} as ObservationSources, loading: false, error: false, more: false, confirmed: true, loadMore: vi.fn(), reload: vi.fn() },
  detail: vi.fn(), capture: vi.fn(), tab: vi.fn(), after: null as null | (() => void),
  refs: [] as unknown[], cursor: 0,
  buttons: [] as { "data-testid"?: string; onClick?: () => void; disabled?: boolean }[],
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useRef: (initial: unknown) => {
    const index = h.cursor++;
    if (!(index in h.refs)) h.refs[index] = { current: initial };
    return h.refs[index];
  } };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: h.profile, milestones: h.milestones, setActiveTab: h.tab, seedCoach: vi.fn(), openCaptureSheet: h.capture,
}) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => h.record }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams(h.query), goToRoute: vi.fn() }));
vi.mock("../../hooks/useSheetHistory", () => ({ useSheetHistory: () => (after?: () => void) => { h.after = after ?? null; } }));
vi.mock("../../lib/noticeNavigation", async original => ({ ...(await original<typeof import("../../lib/noticeNavigation")>()), openNoticeDetail: h.detail }));
vi.mock("../ui/Sheet", () => ({ useCompactSurface: () => false, Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div data-testid="moment-evidence">{children}</div> : null }));
vi.mock("../ui/Modal", () => ({ Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div data-testid="moment-evidence">{children}</div> : null }));
vi.mock("../layout/Breadcrumb", () => ({ SheetBreadcrumb: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") h.buttons.push(props as typeof h.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); }, jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import MomentsBody from "./MomentsBody";

const moment = (): Observation => ({
  id: "keepsakes:shared-first", childId: "child-a", at: "2025-01-08", domains: ["talking"], kind: "moment",
  value: { type: "keepsake", milestoneId: "shared-first", note: "Our saved words" },
  source: "parent_typed", origin: "keepsakes", ageAtObservationMonths: null, pretermCorrected: false,
});
const render = () => {
  h.cursor = 0; h.buttons = [];
  return renderToStaticMarkup(<MomentsBody primaryMoveProps={{}} toolbarModule={{}} viewModule={{}} />);
};
const open = () => h.buttons.find((button) => button["data-testid"] === "moments-open-source")!.onClick!();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 12, 15));
  vi.clearAllMocks(); h.uid = "account-a"; h.profile = { id: "child-a", name: "Noa", age: 3 } as ChildProfile;
  h.milestones = [{ id: "shared-first", title: "First words", checked: false, observationStatus: "not_yet" } as Milestone];
  h.record = { observations: [moment()], sources: {}, loading: false, error: false, more: false, confirmed: true, loadMore: vi.fn(), reload: vi.fn() };
  h.query = new URLSearchParams({ child: "child-a", observation: "keepsakes:shared-first" }).toString();
  h.lang = "en"; h.after = null; h.refs = []; h.cursor = 0;
});
afterEach(() => vi.useRealTimers());

describe("Moments opens the same current observation object", () => {
  it("a milestone/keepsake card opens the canonical object directly, without an intermediate evidence sheet", () => {
    h.query = "";
    h.record.observations = [{ ...moment(), at: new Date().toISOString() }];
    render();
    const card = h.buttons.find((button) => button["data-testid"] === "moments-card-open");
    expect(card).toBeDefined();
    card!.onClick!();
    expect(h.detail).toHaveBeenCalledWith("child-a", "shared-first");
    expect(h.after).toBeNull(); expect(h.tab).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("opens an exact kept source outside the visible month range (%s)", lang => {
    h.lang = lang;
    const html = render();
    expect(html).toContain('data-testid="moment-evidence"');
    expect(html).toContain('data-observation-id="keepsakes:shared-first"');
    expect(html).toContain("Our saved words");
    if (lang === "en") expect(html).toContain('<time dateTime="2025-01-08">8 Jan 2025</time>');
    open(); expect(h.detail).not.toHaveBeenCalled();
    h.after!();
    expect(h.detail).toHaveBeenCalledWith("child-a", "shared-first");
    expect(h.tab).not.toHaveBeenCalled();
  });

  it("does not open a queued source as a confirmed record", () => {
    h.record.confirmed = false;
    const html = render();
    expect(html).not.toContain('data-testid="moment-evidence"');
    expect(html).toContain('data-testid="moments-source-unavailable"');
    expect(html).toContain("could not be confirmed");
  });

  it("re-resolves after sheet Back and stops if the exact source was removed", () => {
    render(); open();
    h.record = { ...h.record, observations: [] }; render();
    h.after!(); expect(h.detail).not.toHaveBeenCalled();
  });

  it.each(["child", "account"] as const)("retires a delayed source opening on %s switch", change => {
    render(); open();
    if (change === "child") h.profile = { ...h.profile, id: "child-b" };
    else h.uid = "account-b";
    const html = render();
    if (change === "child") expect(html).not.toContain('data-testid="moment-evidence"');
    h.after!(); expect(h.detail).not.toHaveBeenCalled();
  });
});
