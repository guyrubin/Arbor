import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../lib/i18n";

/**
 * ask-journey-ux (ASK-2, ASK-3, ASK-7, ASK-8, ASK-9) — house source-guard
 * tests (coachLiveGate.test.ts pattern; the vitest env is node-only, so
 * layout-level acceptance is pinned structurally):
 *
 *  ASK-2  sticky composer — ONE textarea in the DOM (COACH-4 single-input
 *         invariant), same element docked vs hero, chips travel with it.
 *  ASK-7  orientation — WELCOME_MESSAGE deleted, guards are turn predicates,
 *         fresh thread = [].
 *  ASK-8  errors — single calm role=alert retry card; no error/cancel bubbles
 *         appended to (or persisted with) the thread; retry dedupes the user
 *         turn; error copy carries no stack/infra vocabulary in either language.
 *  ASK-9  lens demotion — the radiogroup lives BELOW the fast-start scenarios
 *         behind a single "Perspective … change" affordance; a11y preserved.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const coachRaw = read("components/tabs/CoachTab.tsx");
const coach = stripComments(coachRaw);
const ctxRaw = read("context/ArborContext.tsx");
const ctx = stripComments(ctxRaw);
const cards = stripComments(read("components/coach/CoachAnswerCards.tsx"));

describe("ASK-2 — single sticky composer", () => {
  it("exactly one textarea exists on the Ask surface (COACH-4 invariant)", () => {
    expect(coach.match(/<textarea/g)?.length).toBe(1);
  });

  it("the composer docks sticky (bottom) when a user turn exists, hero otherwise — same element", () => {
    // One shared JSX const, rendered in exactly one of two positions.
    expect(coach).toContain("const composerSection = (");
    expect(coach).toContain("const composerDocked = userTurnExists;");
    expect(coach).toContain("{!composerDocked && composerSection}");
    const docked = /data-testid="coach-docked-composer"[\s\S]*?\{composerSection\}/.exec(coach)?.[0] ?? "";
    expect(docked).not.toBe("");
    // Sticky within the scrolling <main>, clearing the fixed MobileNav on mobile.
    expect(coachRaw).toContain('className="sticky bottom-16 lg:bottom-0 z-30"');
  });

  it("the voice/photo capture chips travel inside the composer section", () => {
    const section = /const composerSection = \([\s\S]*?<\/section>/.exec(coach)?.[0] ?? "";
    expect(section).toContain('setVisionMode("observe")');
    expect(section).toContain('setVisionMode("document")');
    expect(section).toContain("onClick={toggleVoice}");
  });
});

describe("ASK-7 — one orientation block, no welcome bubble", () => {
  it("WELCOME_MESSAGE is gone from the codebase (thread initializes empty)", () => {
    expect(ctxRaw).not.toContain("WELCOME_MESSAGE:");
    expect(ctx).not.toContain("WELCOME_MESSAGE");
    expect(coach).not.toContain("WELCOME_MESSAGE");
    expect(ctx).toContain("useState<ChatMessage[]>([])");
  });

  it("no message-count guards remain — orientation/follow-ups key off turn predicates", () => {
    expect(coach).not.toMatch(/chatMessages\.length\s*<=\s*1/);
    expect(coach).not.toMatch(/chatMessages\.length\s*>\s*1/);
    expect(ctx).not.toMatch(/chatMessages\.length\s*<=\s*1/);
    expect(coach).toContain("const userTurnExists = hasUserTurn(chatMessages);");
    expect(coach).toContain("const aiTurnExists = hasAiTurn(chatMessages);");
  });

  it("conversation persistence requires a real user turn and title still derives from it", () => {
    expect(ctx).toContain("if (!activeConversationId || !hasUserTurn(chatMessages)) return;");
    expect(ctx).toContain('chatMessages.find((m) => m.sender === "user")');
  });
});

describe("ASK-8 — calm single error affordance", () => {
  const chatSend = /const handleChatSend = async[\s\S]*?\n  \};/.exec(ctx)?.[0] ?? "";
  const councilSend = /const handleCouncilSend = async[\s\S]*?\n  \};/.exec(ctx)?.[0] ?? "";

  it("handleChatSend appends NO error/cancel markdown bubble (retry card only)", () => {
    expect(chatSend).not.toBe("");
    expect(chatSend).not.toContain("renderApiConnectionError");
    expect(chatSend).not.toContain("Request Stopped");
    // The catch paths only clean up the live bubble — never append.
    expect(chatSend).toContain("setChatMessages((prev) => abortChatStream(prev));");
  });

  it("handleCouncilSend appends no raw err.message bubble", () => {
    expect(councilSend).not.toBe("");
    expect(councilSend).not.toContain("Council unavailable");
    expect(councilSend).not.toContain("renderApiConnectionError");
  });

  it("both send paths route the user turn through the dedupe reducer", () => {
    expect(chatSend).toContain("appendChatUser(prev, promptValue, selectedLens)");
    expect(councilSend).toContain("appendChatUser(prev, promptValue, selectedLens)");
  });

  it("the retry card is the single role=alert affordance and resends the last question", () => {
    expect(coachRaw.match(/role="alert"/g)?.length).toBe(1);
    expect(coach).toContain("handleChatSend(lastUserText)");
  });

  it("error copy has no stack/infra vocabulary in either language", () => {
    const infra = /firestore|index|stack|provider|api|deployment|token|firebase/i;
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "coach.error")).not.toMatch(infra);
    }
  });
});

describe("ASK-9 — lens machinery demoted below the fast-start scenarios", () => {
  it("the radiogroup renders after the scenario chips, behind the Perspective affordance", () => {
    const scenariosAt = coachRaw.indexOf('t("coach.fastStart")');
    const lensAffordanceAt = coachRaw.indexOf('t("coach.perspective")');
    const radiogroupAt = coachRaw.indexOf('role="radiogroup"');
    expect(scenariosAt).toBeGreaterThan(-1);
    expect(lensAffordanceAt).toBeGreaterThan(scenariosAt);
    expect(radiogroupAt).toBeGreaterThan(lensAffordanceAt);
  });

  it("lens change stays <=2 taps: the affordance toggles the FULL radiogroup (no browse-all stage)", () => {
    expect(coach).toContain("setLensOpen((v) => !v)");
    expect(coach).toContain("lensOpen && (() => {");
    expect(coach).not.toContain("showAllLenses");
    // All lenses render inside the one radiogroup.
    expect(coach).toContain('const lensNames = ["Integrated Balanced", ...scholarsInfo.map((s) => s.name)];');
  });

  it("arrow-key a11y is preserved on the radiogroup", () => {
    expect(coach).toContain('e.key === "ArrowRight" || e.key === "ArrowDown"');
    expect(coach).toContain('e.key === "ArrowLeft" || e.key === "ArrowUp"');
    expect(coachRaw).toContain('role="radio"');
  });

  it("the Perspective affordance is localized in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "coach.perspective").trim()).not.toBe("");
      expect(translate(lang, "coach.perspective.change").trim()).not.toBe("");
    }
    expect(translate("he", "coach.perspective")).not.toMatch(/[a-z]/i);
  });
});

describe("ASK-3 — frames stay out of the parent render (source guard)", () => {
  it("CoachAnswerCards never reads frameRouting for render", () => {
    expect(cards).not.toContain("frameRouting");
    expect(cards).not.toContain("FRAME_LABEL_KEYS");
  });
});
