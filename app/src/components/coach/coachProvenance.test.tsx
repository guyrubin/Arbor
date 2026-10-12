/**
 * EXTRA-TALK — what the Talk panel says around an answer.
 *
 *  1. ONE muted provenance line per settled answer, led by the "verified"
 *     glyph. COUNT-FREE: the contract exposes no grounded observation ids, so
 *     no digit ever reaches the line (the memory row keeps its own count).
 *  2. Each clause is claimed only when true for that answer: "what you kept"
 *     needs the server's grounding signals; "the question you chose" needs the
 *     parent's turn to have gone out WITH a family question (topicId stamped
 *     on the user turn at send, the same id the request body carries).
 *  3. The provenance line leaves every other byte of the report untouched,
 *     the trust link included, and never sits under the urgent-help panel.
 *  4. The family-question chip leads the chip row, fills the composer and
 *     never sends; the Talk panel seats 4 chips, each at the 44 px floor.
 *
 * Static markup and source pins: no DOM, focus or layout evidence is claimed
 * beyond the extracted continueWithTopic callback, which runs for real.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import CoachAnswerCards, { provenanceKey } from "./CoachAnswerCards";
import type { CoachContract } from "../../types";
import type { ChatMessage, ChatResponsePayload } from "../../context/ArborContext";
import { translate, type UiLang } from "../../lib/i18n";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { appendChatAck, appendChatUser, askedWithTopic, settleChatTurn } from "../../lib/chatStream";

const SRC = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");
const coach = read("components/tabs/CoachTab.tsx");
const context = read("context/ArborContext.tsx");
const reportCss = read("components/coach/coachReport.css");
const subset = new Set(
  readFileSync(resolve(SRC, "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"), "utf8")
    .split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")),
);

/* Invented example content only (the repo is public). */
function makeContract(over: Partial<CoachContract> = {}): CoachContract {
  return {
    text: "Mornings often wobble when the order of things changes.",
    riskLevel: "low",
    ageBand: "",
    domains: [],
    nonDiagnosticHypotheses: [],
    todayPlan: ["Lay the clothes out together the night before."],
    parentScript: "",
    avoid: [],
    observe: [],
    escalateIf: [],
    frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
    memoryProposals: [],
    handoffNotes: { teacher: "", professional: "" },
    ...over,
  };
}
const grounded = makeContract({ approvedMemoryFactsUsed: 2, todayPlanProvenance: [{ step: 0, memoryId: "mem-example-1", kind: "approved_fact" }] });
const ungrounded = makeContract();

type Props = React.ComponentProps<typeof CoachAnswerCards>;
const render = (props: Partial<Props> = {}) => renderToStaticMarkup(
  <CoachAnswerCards contract={ungrounded} onSaveToPlan={() => {}} onAddToHandoff={() => {}} onManageMemory={() => {}} {...props} />,
);
const PROVENANCE = /<p class="coach-provenance" data-testid="coach-provenance">[\s\S]*?<\/p>/g;
const lineOf = (html: string) => html.match(PROVENANCE) ?? [];
const textOf = (line: string) => line.replace(/<span class="msr"[^>]*>[^<]*<\/span>/, "").replace(/<[^>]+>/g, "");
const NEW_KEYS = [
  "companion.talk.welcome",
  "companion.talk.topic-chip",
  "companion.talk.provenance",
  "companion.talk.provenance.topic",
  "companion.talk.provenance.topic-only",
  "companion.talk.provenance.general",
];
const PROVENANCE_KEYS = NEW_KEYS.filter((key) => key.startsWith("companion.talk.provenance"));

describe("EXTRA-TALK · the provenance line renders once per settled answer", () => {
  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] one line, glyph first, in the report footer`, () => {
      const html = render({ lang, contract: grounded, provenance: { topic: false } });
      const lines = lineOf(html);
      expect(lines).toHaveLength(1);
      const line = lines[0];
      expect(line).toContain(">verified</span>");
      expect(line).toContain("font-size:14px");
      expect(line.indexOf(">verified</span>")).toBeLessThan(line.indexOf(translate(lang, "companion.talk.provenance")));
      expect(textOf(line)).toBe(translate(lang, "companion.talk.provenance"));
      const footer = html.indexOf('data-testid="coach-answer-footer"');
      expect(footer).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="coach-provenance"')).toBeGreaterThan(footer);
    });
  }

  it("absent without the opt-in (live bubbles, history renders and the AI-17 snapshots)", () => {
    expect(lineOf(render({ contract: grounded }))).toHaveLength(0);
  });

  it("never under the urgent-help panel: a prominent answer carries no 'you decide' line", () => {
    const urgent = makeContract({ riskLevel: "moderate", escalateIf: ["Breathing that frightens you."] });
    const html = render({ contract: urgent, provenance: { topic: true } });
    expect(html).toContain('data-testid="coach-report-urgent-help"');
    expect(lineOf(html)).toHaveLength(0);
    // A quiet (low-risk) escalation keeps the line.
    expect(lineOf(render({ contract: { ...urgent, riskLevel: "low" }, provenance: { topic: true } }))).toHaveLength(1);
  });

  it("CoachTab passes it only to a SETTLED answer, from the one CoachAnswerCards mount", () => {
    expect(coach.match(/<CoachAnswerCards\b/g)).toHaveLength(1);
    expect(coach).toContain("provenance={!msg.chatLive && !msg.voiceLive ? { topic: askedWithTopic(chatMessages, idx) } : undefined}");
  });
});

describe("EXTRA-TALK · the topic clause appears only when a topicId was sent", () => {
  const answer = { text: "Here is a gentle plan.", contract: grounded } as ChatResponsePayload;
  const turn = (topicId?: string): ChatMessage[] => {
    const asked = appendChatUser([], "Why do mornings fall apart?", "Integrated Balanced", undefined, topicId);
    return settleChatTurn(appendChatAck(asked, "…", "Integrated Balanced"), answer, "Integrated Balanced");
  };

  it("appendChatUser stamps the topic only when one went out, and a retry keeps the stamp", () => {
    const withTopic = appendChatUser([], "Why do mornings fall apart?", "Integrated Balanced", undefined, "topic-example");
    expect(withTopic[0]).toMatchObject({ sender: "user", topicId: "topic-example" });
    expect("topicId" in appendChatUser([], "Why do mornings fall apart?", "Integrated Balanced")[0]).toBe(false);
    expect(appendChatUser(withTopic, "Why do mornings fall apart?", "Integrated Balanced")).toBe(withTopic);
    const tapped = appendChatUser([], "Canonical prompt", "Integrated Balanced", "Tapped label", "topic-example");
    expect(tapped[0]).toMatchObject({ displayText: "Tapped label", topicId: "topic-example" });
  });

  it("both send paths stamp the turn with the same id the request body carries", () => {
    expect(context).toContain("appendChatUser(prev, promptValue, selectedLens, opts?.displayText, activeFamilyTopic?.id)");
    expect(context).toContain("appendChatUser(prev, promptValue, selectedLens, undefined, activeFamilyTopic?.id)");
    expect((context.match(/\.\.\.\(activeFamilyTopic \? \{ topicId: activeFamilyTopic\.id \} : \{\}\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("askedWithTopic reads the nearest earlier user turn", () => {
    const sent = turn("topic-example");
    expect(askedWithTopic(sent, sent.length - 1)).toBe(true);
    const plain = turn();
    expect(askedWithTopic(plain, plain.length - 1)).toBe(false);
    // A later plain turn after a topic turn answers for itself.
    const mixed: ChatMessage[] = [...sent, { sender: "user", text: "And bedtime?" }, { sender: "ai", text: "…", contract: grounded }];
    expect(askedWithTopic(mixed, mixed.length - 1)).toBe(false);
    expect(askedWithTopic([], 0)).toBe(false);
  });

  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] the rendered variant follows the stamp and the grounding`, () => {
      const sent = turn("topic-example");
      const topic = askedWithTopic(sent, sent.length - 1);
      expect(textOf(lineOf(render({ lang, contract: grounded, provenance: { topic } }))[0])).toBe(translate(lang, "companion.talk.provenance.topic"));
      expect(textOf(lineOf(render({ lang, contract: grounded, provenance: { topic: false } }))[0])).toBe(translate(lang, "companion.talk.provenance"));
      expect(textOf(lineOf(render({ lang, contract: ungrounded, provenance: { topic: true } }))[0])).toBe(translate(lang, "companion.talk.provenance.topic-only"));
      expect(textOf(lineOf(render({ lang, contract: ungrounded, provenance: { topic: false } }))[0])).toBe(translate(lang, "companion.talk.provenance.general"));
    });
  }

  it("'what you kept' needs the server's grounding signal (no claim on an ungrounded answer)", () => {
    expect(provenanceKey(makeContract({ approvedMemoryFactsUsed: 0 }), false)).toBe("companion.talk.provenance.general");
    expect(provenanceKey(makeContract({ approvedMemoryFactsUsed: 1 }), false)).toBe("companion.talk.provenance");
    expect(provenanceKey(makeContract({ todayPlanProvenance: [{ step: 0, memoryId: "mem-example-2", kind: "approved_fact" }] }), true)).toBe("companion.talk.provenance.topic");
    // Every variant keeps the same decision clause: Arbor suggests, the parent decides.
    for (const lang of ["en", "he"] as const) {
      const decide = translate(lang, "companion.talk.provenance.general");
      for (const key of PROVENANCE_KEYS) expect(translate(lang, key).endsWith(decide), `${lang} ${key}`).toBe(true);
    }
  });
});

describe("EXTRA-TALK · clinical firewall: no digit, no verdict, the trust link unchanged", () => {
  it("no digit reaches the line even when the server counted grounded facts", () => {
    for (const lang of ["en", "he"] as const) {
      for (const topic of [true, false]) {
        for (const contract of [grounded, ungrounded]) {
          const line = lineOf(render({ lang, contract, provenance: { topic } }))[0];
          expect(textOf(line)).not.toMatch(/[0-9%٠-٩]/);
        }
      }
    }
    for (const key of PROVENANCE_KEYS) {
      expect((companionEn as Record<string, string>)[key], key).not.toMatch(/[0-9%]|\{n\}|\{count\}/);
      expect((companionHe as Record<string, string>)[key], key).not.toMatch(/[0-9%]|\{n\}|\{count\}/);
    }
  });

  it("the line is muted, never a verdict colour, and laid out with logical properties", () => {
    const rule = /\.coach-provenance \{([^}]*)\}/.exec(reportCss)?.[1] ?? "";
    expect(rule).toContain("color: var(--arbor-muted)");
    expect(rule).not.toMatch(/green|red|danger|success|warning|left|right/);
    expect(reportCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("every other byte of the report, the trust link included, is identical with and without the line", () => {
    for (const lang of ["en", "he"] as const) {
      for (const contract of [grounded, ungrounded]) {
        const without = render({ lang, contract });
        const withLine = render({ lang, contract, provenance: { topic: true } });
        expect(lineOf(withLine)).toHaveLength(1);
        expect(withLine.replace(PROVENANCE, "")).toBe(without);
        const attribution = /<div class="coach-report__attribution">[\s\S]*?<\/div>/;
        expect(attribution.exec(withLine)?.[0]).toBe(attribution.exec(without)?.[0]);
      }
    }
  });
});

describe("EXTRA-TALK · the welcome and the family-question chip", () => {
  it("the Talk welcome reads the new key and keeps its sub-line", () => {
    expect(coach).toContain('<h3>{inputText(uiLang, "companion.talk.welcome")}</h3>');
    expect(coach).toContain('inputText(uiLang, "companion.input.a-little-moment-a-big-question-a-photo-from-today-start-wherever-")');
    expect(translate("en", "companion.talk.welcome")).toBe("What's on your mind?");
  });

  it("the Talk panel seats 4 chips, the page 3; the question chip leads the row", () => {
    expect(coach).toContain("const scenarioSeats = embedded ? 4 : 3;");
    expect(coach).toContain("const topicChip = activeFamilyTopic?.title.trim() ? activeFamilyTopic : null;");
    const row = coach.slice(coach.indexOf('id="coach-scenarios"'));
    const first = row.indexOf('data-testid="coach-scenario-topic"');
    expect(first).toBeGreaterThan(-1);
    for (const later of ['data-testid="coach-hard-moment-now"', 'data-testid="coach-scenario-echo"', "SCENARIOS.slice(0, staticShown)"]) {
      expect(first).toBeLessThan(row.indexOf(later));
    }
  });

  it("the chip is a 44 px parent-register chip with the bookmark glyph and a bidi-isolated title, and it never sends", () => {
    const start = coach.indexOf('data-testid="coach-scenario-topic"');
    const chip = coach.slice(coach.lastIndexOf("<button", start), coach.indexOf("</button>", start));
    expect(chip).toContain("min-h-11");
    expect(chip).toContain('<Icon name="bookmark" size={16}');
    expect(chip).toContain('<bdi dir="auto">{topicChip.title.trim()}</bdi>');
    expect(chip).toContain("continueWithTopic(event.currentTarget, topicChip.title.trim())");
    expect(chip).not.toMatch(/handleChatSend|sendToCoach|handleCouncilSend/);
    for (const icon of ["bookmark", "verified"]) expect(subset.has(icon), `${icon} must ship in the font subset`).toBe(true);
  });

  it("continueWithTopic fills the composer (appending to a draft), focuses it, and sends nothing", () => {
    const start = coach.indexOf("const continueWithTopic = (");
    const end = /\r?\n {2}\};/.exec(coach.slice(start));
    expect(start).toBeGreaterThan(-1);
    expect(end).not.toBeNull();
    const source = coach.slice(start, start + end!.index + end![0].length);
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/^export \{\};?\s*$/m, "")
      .replace(/^Object\.defineProperty\(exports[^\n]*$/m, "");
    let input = "";
    const setChatInput = vi.fn((next: string | ((current: string) => string)) => { input = typeof next === "function" ? next(input) : next; });
    const handleChatSend = vi.fn();
    const field = { disabled: false, value: "", focus: vi.fn(), setSelectionRange: vi.fn() };
    const scope = { querySelector: vi.fn(() => { field.value = input; return field; }) };
    const from = { closest: vi.fn(() => scope) };
    const raf = (callback: () => void) => { callback(); return 1; };
    const make = new Function("setChatInput", "requestAnimationFrame", "document", "handleChatSend", `${js}\nreturn continueWithTopic;`) as (
      ...deps: unknown[]
    ) => (from: unknown, title: string) => void;
    const continueWithTopic = make(setChatInput, raf, scope, handleChatSend);

    continueWithTopic(from, "Why do mornings fall apart?");
    expect(input).toBe("Why do mornings fall apart?");
    expect(from.closest).toHaveBeenCalledWith(".companion-coach");
    expect(scope.querySelector).toHaveBeenCalledWith('[data-testid="coach-composer-well"] textarea');
    expect(field.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(field.setSelectionRange).toHaveBeenCalledWith(input.length, input.length);

    continueWithTopic(from, "Why do mornings fall apart?");
    expect(input).toBe("Why do mornings fall apart?");
    input = "We tried a picture chart";
    continueWithTopic(from, "Why do mornings fall apart?");
    expect(input).toBe("We tried a picture chart\n\nWhy do mornings fall apart?");
    expect(handleChatSend).not.toHaveBeenCalled();
  });

  for (const lang of ["en", "he"] as UiLang[]) {
    it(`[${lang}] the chip template splits around one {title}`, () => {
      const parts = translate(lang, "companion.talk.topic-chip").split("{title}");
      expect(parts).toHaveLength(2);
      expect(parts[0].trim().length).toBeGreaterThan(0);
    });
  }
});

describe("EXTRA-TALK · strings exist in EN and HE; Hebrew carries no Latin", () => {
  it("every new key is in both dictionaries", () => {
    for (const key of NEW_KEYS) {
      expect((companionEn as Record<string, string>)[key], key).toBeTruthy();
      expect((companionHe as Record<string, string>)[key], key).toBeTruthy();
    }
  });

  it("Hebrew values are Hebrew, with no Latin outside the {title} placeholder", () => {
    for (const key of NEW_KEYS) {
      const value = (companionHe as Record<string, string>)[key].replace("{title}", "");
      expect(value, key).toMatch(/[֐-׿]/);
      expect(value, key).not.toMatch(/[A-Za-z]/);
    }
  });
});
