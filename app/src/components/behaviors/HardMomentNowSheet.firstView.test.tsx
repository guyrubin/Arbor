/**
 * FEAT-06 (v3) — "A hard moment?" fast path: the sheet opens on a "you first"
 * view ABOVE the existing picker: a kicker, "You first. Then {name}.", one
 * sentence to say (SayThis), one step with a visible 0:30 clock (the
 * B-ASKJB-40 pacer with showClock), Talk it through / Keep this moment, and
 * ONE "Help and safety" link to the Safety tab (no helpline list on every
 * open: most hard moments are an ordinary meltdown; the numbers live on the
 * Safety tab and appear in place where crisis wording is typed, see
 * coachComposerCrisis.test.tsx). UrgentSupport keeps its onSafety door.
 *
 * Pins kept (not re-pinned here): hardMomentShelf.test.ts (neutral ink, no
 * seed, setAskHardMomentRef / acceptHardMomentStep), ParentBreathPacer.test.tsx
 * (the plain pacer literal above the pick prompt), the door gates.
 * The child name below is invented (public repo: no real child data).
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { en, he, translate, type UiLang } from "../../lib/i18n";
import { HARD_MOMENT_PILOT } from "../../content/pilotRelease";

const harness = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  cardId: undefined as string | undefined,
  childName: "Mia Example",
  birthDate: "2022-01-01",
  closeHardMomentNow: vi.fn(),
  setActiveTab: vi.fn(),
  openCaptureSheet: vi.fn(),
  setAskHardMomentRef: vi.fn(),
  acceptTodayAction: vi.fn(),
  requestLearnRead: vi.fn(),
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
    childProfile: { id: "c1", name: harness.childName, birthDate: harness.birthDate },
    behaviorLogs: [],
    acceptTodayAction: harness.acceptTodayAction,
    activeTodayAction: null,
    setActiveTab: harness.setActiveTab,
    setAskHardMomentRef: harness.setAskHardMomentRef,
    requestLearnRead: harness.requestLearnRead,
    actionLoop: [],
    openCaptureSheet: harness.openCaptureSheet,
  }),
}));
// The real Modal portals into document.body; the stub renders its children in place.
vi.mock("../ui/Modal", () => {
  const Modal = ({ open, title, children }: { open: boolean; title?: string; children: React.ReactNode }) =>
    open ? <div data-testid="modal-stub"><h3>{title}</h3>{children}</div> : null;
  return { Modal, default: Modal };
});
// Capture element props so the sheet's own handlers can be invoked.
const capture = vi.hoisted(() => (type: unknown, props: any) => { harness.captured.push({ type, props }); });
vi.mock("react/jsx-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-runtime")>();
  return { ...real, jsx: (...args: Parameters<typeof real.jsx>) => { capture(args[0], args[1]); return real.jsx(...args); }, jsxs: (...args: Parameters<typeof real.jsxs>) => { capture(args[0], args[1]); return real.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...args: Parameters<typeof real.jsxDEV>) => { capture(args[0], args[1]); return real.jsxDEV(...args); } };
});

import HardMomentNowSheet, { HardMomentFirstView } from "./HardMomentNowSheet";
import { UrgentSupport } from "../safety/UrgentSupport";

const SRC = readFileSync(path.resolve(__dirname, "HardMomentNowSheet.tsx"), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SHEET = strip(SRC);
const FIRST = SHEET.slice(SHEET.indexOf("export function HardMomentFirstView"), SHEET.indexOf("export function hardMomentSheetCards"));
const inPilot = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) - 7 * 86_400_000);
const FIRST_KEYS = ["hm.first.kicker", "hm.first.title", "hm.first.titleBare", "hm.first.say", "hm.first.stepTitle", "hm.first.stepBody", "hm.first.talk", "hm.first.keep", "hm.first.safety"];
const escapeHtml = (text: string) => renderToStaticMarkup(<span>{text}</span>).slice(6, -7);

const tFor = (lang: UiLang) => (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
const view = (lang: "en" | "he", childName = "Mia") => {
  harness.lang = lang;
  return renderToStaticMarkup(
    <HardMomentFirstView childName={childName} lang={lang} t={tFor(lang)} onTalk={() => {}} onKeep={() => {}} onSafety={() => {}} />,
  );
};

/** Walk a React element tree (no rendering) for the element carrying a prop. */
function findElement(node: unknown, match: (props: Record<string, any>, type: unknown) => boolean): React.ReactElement<any> | null {
  if (Array.isArray(node)) {
    for (const child of node) { const hit = findElement(child, match); if (hit) return hit; }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const props = node.props as Record<string, any>;
  if (match(props, node.type)) return node as React.ReactElement<any>;
  return findElement(props.children, match);
}

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(inPilot); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => {
  harness.lang = "en"; harness.cardId = undefined; harness.childName = "Mia Example"; harness.captured = [];
  harness.birthDate = new Date(inPilot.getTime() - 4 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  vi.clearAllMocks();
});

describe("FEAT-06 — the 'you first' view (rendered, EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: kicker, 'You first. Then {name}.', one sentence, one step with 0:30, Talk / Keep, help and safety`, () => {
      const html = view(lang);
      const t = tFor(lang);
      expect(html).toContain('data-testid="hard-moment-first"');
      expect(html).toContain(escapeHtml(t("hm.first.kicker")));
      expect(html).toContain(escapeHtml(t("hm.first.title", { name: "Mia" })));
      // One sentence to say, through the one "Say this" grammar, set as a
      // quote behind an inline-start rule (logical: on the right in HE).
      expect(html.match(/data-testid="say-this"/g)).toHaveLength(1);
      expect(html).toContain('data-presentation="quote"');
      expect(html).toMatch(/<blockquote[^>]*style="[^"]*border-inline-start:2px solid var\(--arbor-ink\)[^"]*padding-inline-start:14px/);
      expect(html).toContain(escapeHtml(t("hm.first.say")));
      // One step: the pacer's resting row with the step's own words and the clock at 0:30.
      expect(html.match(/data-testid="breath-pacer-open"/g)).toHaveLength(1);
      expect(html).toContain(escapeHtml(t("hm.first.stepTitle")));
      expect(html).toContain(escapeHtml(t("hm.first.stepBody")));
      expect(html).toMatch(/data-testid="breath-pacer-clock"[^>]*>0:30</);
      expect(html).toContain(escapeHtml(t("hm.first.talk")));
      expect(html).toContain(escapeHtml(t("hm.first.keep")));
      // Help and safety: ONE tappable link, its own words, the shield glyph,
      // after Talk and Keep. No helpline list on every open (no tel: links).
      expect(html.match(/data-testid="hard-moment-first-safety"/g)).toHaveLength(1);
      expect(html).toMatch(/<button type="button" data-testid="hard-moment-first-safety" class="[^"]*min-h-11[^"]*underline/);
      const safety = html.slice(html.indexOf('data-testid="hard-moment-first-safety"'));
      expect(safety.slice(0, safety.indexOf("</button>"))).toContain(escapeHtml(t("hm.first.safety")));
      expect(safety.slice(0, safety.indexOf("</button>"))).toContain("gpp_maybe");
      expect(html.indexOf('data-testid="hard-moment-first-safety"')).toBeGreaterThan(html.indexOf('data-testid="hard-moment-first-keep"'));
      expect(html).not.toContain("tel:");
      expect(html).not.toContain(escapeHtml(t("elev.safety.open")));
      // Calm: no alert role on every open, no alarm colour, no SOS.
      expect(html).not.toContain('role="alert"');
      expect(html).not.toMatch(/--arbor-(red|coral|peach|pink)|#[0-9a-fA-F]{3,8}\b|\bSOS\b/);
    });
  }

  it("every control reaches the 44 px floor", () => {
    const html = view("en");
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('data-testid="hard-moment-first-safety"');
    for (const b of buttons) expect(b, b).toMatch(/min-h-11/);
    for (const a of html.match(/<a\b[^>]*>/g) ?? []) expect(a, a).toMatch(/min-h-11/);
  });

  it("no name on the profile → the bare headline, never an empty slot", () => {
    const html = view("en", "");
    expect(html).toContain(escapeHtml(en["hm.first.titleBare"]));
    expect(html).not.toContain("Then .");
  });

  it("RTL-safe: logical properties only (the rule sits on the inline end, no left/right)", () => {
    expect(FIRST).toContain("borderBlockEnd");
    expect(FIRST).toContain('<SayThis presentation="quote"');
    expect(FIRST).toContain('className="ms-auto inline-flex min-h-11');
    expect(FIRST).not.toMatch(/\b(borderLeft|borderRight|paddingLeft|paddingRight|marginLeft|marginRight)\b|\b(ml|mr|pl|pr)-\d|text-(left|right)\b/);
  });
});

describe("FEAT-06 — copy (EN + HE)", () => {
  it("every hm.first.* key exists in both locales; HE carries no Latin (the name slot aside)", () => {
    for (const k of FIRST_KEYS) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k].replace("{name}", ""), k).not.toMatch(/[A-Za-z]/);
      expect(`${en[k]} ${he[k]}`, k).not.toMatch(/\bSOS\b|review|vetted|approved|נבדק|מאושר/i);
    }
    expect(en["hm.first.title"]).toBe("You first. Then {name}.");
    expect(he["hm.first.title"]).toContain("{name}");
    // elev.safety.* lives in the elevation registry; translate() resolves both.
    expect(translate("en", "elev.safety.open")).toBe("Open Safety & escalation");
    expect(translate("he", "elev.safety.open")).not.toBe("elev.safety.open");
    expect(translate("he", "elev.safety.open")).not.toMatch(/[A-Za-z]/);
  });

  it("the step names three breaths, matching the pacer (3 × 10 s = 0:30)", () => {
    expect(en["hm.first.stepTitle"]).toMatch(/three/i);
    expect(he["hm.first.stepTitle"]).toContain("שלוש");
  });

  it("the Modal title stays the pinned 'Hard moment now'", () => {
    expect(he["hm.now.title"]).toBe("רגע קשה עכשיו");
    expect(SHEET).toContain('title={t("hm.now.title")}');
  });
});

describe("FEAT-06 — the ways on (handlers)", () => {
  it("each control calls its own handler; 'Help and safety' itself is the door", () => {
    const onTalk = vi.fn(); const onKeep = vi.fn(); const onSafety = vi.fn();
    const tree = HardMomentFirstView({ childName: "Mia", lang: "en", t: tFor("en"), onTalk, onKeep, onSafety });
    findElement(tree, (p) => p["data-testid"] === "hard-moment-first-talk")!.props.onClick();
    expect(onTalk).toHaveBeenCalledTimes(1);
    findElement(tree, (p) => p["data-testid"] === "hard-moment-first-keep")!.props.onClick();
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onSafety).not.toHaveBeenCalled();
    findElement(tree, (p) => p["data-testid"] === "hard-moment-first-safety")!.props.onClick();
    expect(onSafety).toHaveBeenCalledTimes(1);
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
    // No helpline block in the calm view (the numbers live on the Safety tab).
    expect(findElement(tree, (_p, type) => type === UrgentSupport)).toBeNull();
  });

  it("the sheet wires Talk → an empty coach (no seed, no stale guide card), Keep → the capture sheet, Safety → the Safety tab, each closing the sheet first", () => {
    renderToStaticMarkup(<HardMomentNowSheet />);
    const first = harness.captured.find((c) => c.type === HardMomentFirstView);
    expect(first, "the sheet renders HardMomentFirstView on a fresh open").toBeTruthy();
    expect(first!.props.childName).toBe("Mia");
    expect(first!.props.lang).toBe("en");

    first!.props.onTalk();
    expect(harness.closeHardMomentNow).toHaveBeenCalledTimes(1);
    expect(harness.setActiveTab).toHaveBeenCalledWith("coach");
    // A guide card an earlier card-level Talk left above the composer is
    // cleared: the first view's Talk lands on the coach with no card.
    expect(harness.setAskHardMomentRef).toHaveBeenCalledTimes(1);
    expect(harness.setAskHardMomentRef).toHaveBeenCalledWith(null);
    expect(harness.setAskHardMomentRef.mock.invocationCallOrder[0]).toBeLessThan(harness.setActiveTab.mock.invocationCallOrder[0]);
    expect(harness.openCaptureSheet).not.toHaveBeenCalled();

    vi.clearAllMocks();
    first!.props.onKeep();
    expect(harness.closeHardMomentNow).toHaveBeenCalledTimes(1);
    expect(harness.openCaptureSheet).toHaveBeenCalledWith({ mode: "text" });
    expect(harness.setActiveTab).not.toHaveBeenCalled();

    vi.clearAllMocks();
    first!.props.onSafety();
    expect(harness.closeHardMomentNow).toHaveBeenCalledTimes(1);
    expect(harness.setActiveTab).toHaveBeenCalledWith("safety");
  });

  it("source: no seed, no request on any of the three paths", () => {
    expect(SHEET).toContain('onTalk={() => { setAskHardMomentRef(null); closeHardMomentNow(); setActiveTab("coach"); }}');
    expect(SHEET).toContain('onKeep={() => { closeHardMomentNow(); openCaptureSheet({ mode: "text" }); }}');
    expect(SHEET).toContain('onSafety={() => { closeHardMomentNow(); setActiveTab("safety"); }}');
    expect(SHEET).not.toMatch(/seedCoach|buildHardMomentSeedPrompt|fetch\(|api\.|sendToCoach|handleChatSend/);
  });
});

describe("FEAT-06 — the sheet: the first view sits ABOVE the picker, never replaces it", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: fresh open → first view, then the pick prompt and the chips; one breath row only`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<HardMomentNowSheet />);
      const t = tFor(lang);
      const first = html.indexOf('data-testid="hard-moment-first"');
      const pick = html.indexOf(escapeHtml(t("hm.now.pick")));
      expect(first).toBeGreaterThan(-1);
      expect(pick).toBeGreaterThan(first);
      expect(html.indexOf('data-testid="hard-moment-now-chip"')).toBeGreaterThan(pick);
      expect(html).toContain(escapeHtml(t("hm.first.title", { name: "Mia" })));
      // The plain B-ASKJB-40 row gives way to the step on a fresh open: one pacer, not two.
      expect(html.match(/data-testid="breath-pacer-open"/g)).toHaveLength(1);
      expect(html).not.toContain(escapeHtml(t("hm.now.breathe.open")));
      expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
      // The calm sheet lists no helplines; its one safety door is the link.
      expect(html).not.toContain("tel:");
      expect(html.match(/data-testid="hard-moment-first-safety"/g)).toHaveLength(1);
    });
  }

  it("source: the first view renders only before a card; back from a card the plain pacer returns above the pick prompt", () => {
    const branch = SHEET.slice(SHEET.indexOf(") : !card ? ("), SHEET.indexOf('{t("hm.now.pick")}'));
    expect(branch).toContain("{!pastFirst && (");
    expect(branch).toContain("<HardMomentFirstView");
    expect(branch).toContain("{pastFirst && <ParentBreathPacer t={t} />}");
    expect(branch.indexOf("<HardMomentFirstView")).toBeLessThan(branch.indexOf("<ParentBreathPacer t={t} />"));
    // Opening on a card, or choosing one, moves past the first view; closing resets it.
    expect(SHEET).toContain("setPastFirst(Boolean(hardMomentNow.cardId));");
    expect(SHEET).toContain("useEffect(() => { if (selectedId) setPastFirst(true); }, [selectedId]);");
    expect(SHEET).toContain("else setPastFirst(false);");
  });
});

describe("FEAT-06 — UrgentSupport's door to Safety & escalation", () => {
  it("without onSafety the shared default is unchanged (no button)", () => {
    harness.lang = "en";
    const html = renderToStaticMarkup(<UrgentSupport />);
    expect(html).not.toContain("<button");
    expect(html).toContain('role="alert"');
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: with onSafety a ≥44 px button after the helplines names the Safety tab`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<UrgentSupport testId="x-support" onSafety={() => {}} />);
      const button = html.indexOf('data-testid="x-support-safety"');
      expect(button).toBeGreaterThan(html.lastIndexOf('href="tel:'));
      expect(html).toMatch(/<button type="button" data-testid="x-support-safety" class="[^"]*min-h-11/);
      expect(html).toContain(escapeHtml(translate(lang, "elev.safety.open")));
    });
  }

  it("the button calls onSafety (UrgentSupport renders as a plain function of its props)", () => {
    harness.lang = "en";
    const onSafety = vi.fn();
    const tree = UrgentSupport({ testId: "x-support", onSafety });
    findElement(tree, (p) => p["data-testid"] === "x-support-safety")!.props.onClick();
    expect(onSafety).toHaveBeenCalledTimes(1);
  });
});
