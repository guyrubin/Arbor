import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import CoachAnswerCards, { sourcesLabel, escalationTier, citationRows, memoryFooterLabel, escalationLines, domainChipLabel } from "./CoachAnswerCards";
import { hardMomentCards } from "../../content/hardMomentCards";
import type { CoachContract } from "../../types";

/**
 * R1 — Render coach citations
 *
 * Unit tests for the pure `sourcesLabel` helper and G2 gate:
 *   - G2: copy states mechanism/source only (never an outcome claim).
 *   - Empty sourceCardsUsed yields no badge (empty string).
 *   - Singular / plural strings are correct in both languages.
 *
 * No full-component render test — the component uses browser APIs (clipboard,
 * speech) that require a DOM harness. The pure helper covers the logic that
 * would otherwise have no test surface.
 */
describe("sourcesLabel (R1 citation helper)", () => {
  it("returns empty string for 0 sources — no badge on empty array", () => {
    expect(sourcesLabel(0, "en")).toBe("");
    expect(sourcesLabel(0, "he")).toBe("");
  });

  it("returns singular form for exactly 1 source (EN)", () => {
    const label = sourcesLabel(1, "en");
    expect(label).toBe("Grounded in 1 source");
  });

  it("returns singular form for exactly 1 source (HE)", () => {
    const label = sourcesLabel(1, "he");
    expect(label).toBe("מבוסס על מקור אחד");
  });

  it("returns plural form for 2 sources (EN)", () => {
    const label = sourcesLabel(2, "en");
    expect(label).toContain("2");
    expect(label.toLowerCase()).toContain("source");
  });

  it("returns plural form for 2 sources (HE)", () => {
    const label = sourcesLabel(2, "he");
    expect(label).toContain("2");
    expect(label).toContain("מקור");
  });

  it("returns plural form for 5 sources (EN)", () => {
    const label = sourcesLabel(5, "en");
    expect(label).toContain("5");
  });

  // G2 gate: source label must NEVER contain outcome/effect claims.
  it("G2: label does not contain forbidden outcome-claim words (EN)", () => {
    const forbidden = ["proven", "validated", "clinically", "clinical", "evidence-based", "effect"];
    for (const n of [1, 2, 5]) {
      const label = sourcesLabel(n, "en").toLowerCase();
      for (const word of forbidden) {
        expect(label, `label for n=${n} must not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it("G2: label does not contain condition/diagnostic terms (EN)", () => {
    const conditions = ["autism", "adhd", "anxiety", "delay", "disorder", "diagnosis"];
    for (const n of [1, 3]) {
      const label = sourcesLabel(n, "en").toLowerCase();
      for (const word of conditions) {
        expect(label, `label for n=${n} must not contain "${word}"`).not.toContain(word);
      }
    }
  });
});

/**
 * Escalation footer tiering — the "Reach out for help if" content is ALWAYS
 * rendered when escalateIf is non-empty; only its PROMINENCE changes with
 * riskLevel. Low risk = quiet collapsed disclosure; moderate+ = the full
 * warning panel. Unknown levels fail safe upward to prominent.
 *
 * The component is exercised via renderToStaticMarkup (no DOM harness needed;
 * clipboard/speech surfaces are only reached through event handlers).
 */
const ESCALATE_ITEM = "sleep disruption lasts more than two weeks";

function makeContract(riskLevel: string): CoachContract {
  return {
    riskLevel,
    ageBand: "",
    domains: [],
    nonDiagnosticHypotheses: [],
    todayPlan: [],
    parentScript: "",
    avoid: [],
    observe: [],
    escalateIf: [ESCALATE_ITEM],
    frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
    memoryProposals: [],
    handoffNotes: { teacher: "", professional: "" },
  };
}

const noop = () => {};

describe("domain attribution chips", () => {
  it("renders each model-provided domain once before applying the three-chip limit", () => {
    const domains: CoachContract["domains"] = ["attachment_regulation", "attachment_regulation", "language_communication", "cognition_executive_function", "ecosystem_stressors"];
    const html = renderToStaticMarkup(React.createElement(CoachAnswerCards, {
      contract: { ...makeContract("low"), domains }, onSaveToPlan: noop, onAddToHandoff: noop, lang: "en",
    }));
    const chip = (domain: string) => renderToStaticMarkup(React.createElement("span", null, domainChipLabel(domain, "en"))).replace("<span>", ">");
    for (const domain of [domains[0], domains[2], domains[3]]) expect(html.split(chip(domain)).length - 1, domain).toBe(1);
    expect(html).not.toContain(chip(domains[4]));
    // Presentation normalization must not rewrite the model's source contract.
    expect(domains).toHaveLength(5);
  });
});

function renderCards(riskLevel: string): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract: makeContract(riskLevel),
      onSaveToPlan: noop,
      onAddToHandoff: noop,
    })
  );
}

describe("escalationTier (prominence helper)", () => {
  it("low / absent risk is quiet", () => {
    expect(escalationTier("low")).toBe("quiet");
    expect(escalationTier("Low")).toBe("quiet");
    expect(escalationTier("")).toBe("quiet");
    expect(escalationTier(undefined)).toBe("quiet");
  });

  it("moderate and above are prominent", () => {
    for (const level of ["moderate", "elevated", "high", "severe", "urgent"]) {
      expect(escalationTier(level), `"${level}" must be prominent`).toBe("prominent");
    }
  });

  it("unrecognized levels fail safe to prominent", () => {
    expect(escalationTier("unexpected")).toBe("prominent");
  });
});

/**
 * COACH-6 — the citation drawer shows REAL source titles + type chips from the
 * server knowledge registry ("Transition Bridge · intervention"-style rows),
 * never dash-stripped slugs for grounded answers; ids the server could not
 * resolve keep the legacy slug fallback.
 */
describe("citationRows (COACH-6)", () => {
  const base = makeContract("low");

  it("resolves ids to title + type rows, preserving citation order", () => {
    const contract: CoachContract = {
      ...base,
      sourceCardsUsed: ["transition-bridge-3-5y", "bowlby-attachment"],
      sourceCards: [
        { id: "bowlby-attachment", title: "Bowlby: Secure Base", type: "scholar" },
        { id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" },
      ],
    };
    expect(citationRows(contract)).toEqual([
      { id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" },
      { id: "bowlby-attachment", title: "Bowlby: Secure Base", type: "scholar" },
    ]);
  });

  it("keeps a null-title slug fallback for ids the server did not resolve", () => {
    const contract: CoachContract = {
      ...base,
      sourceCardsUsed: ["mystery-card"],
      sourceCards: [],
    };
    expect(citationRows(contract)).toEqual([{ id: "mystery-card", title: null, type: null }]);
  });

  it("renders from sourceCards alone when sourceCardsUsed is absent, and is empty when both are", () => {
    const withCardsOnly: CoachContract = {
      ...base,
      sourceCards: [{ id: "a", title: "A Card", type: "concept" }],
    };
    expect(citationRows(withCardsOnly)).toEqual([{ id: "a", title: "A Card", type: "concept" }]);
    expect(citationRows(base)).toEqual([]);
  });
});

describe("citation drawer rendering (COACH-6)", () => {
  function renderWithSources(): string {
    const contract: CoachContract = {
      ...makeContract("low"),
      sourceCardsUsed: ["transition-bridge-3-5y"],
      sourceCards: [{ id: "transition-bridge-3-5y", title: "Transition Bridge (3-5y)", type: "intervention" }],
    };
    return renderToStaticMarkup(
      React.createElement(CoachAnswerCards, {
        contract,
        onSaveToPlan: noop,
        onAddToHandoff: noop,
      })
    );
  }

  it("shows the real title + type chip, never the dash-stripped slug", () => {
    const html = renderWithSources();
    expect(html).toContain("Transition Bridge (3-5y)");
    expect(html).toContain("intervention");
    expect(html).not.toContain("transition bridge 3 5y"); // the old debug-looking row
  });

  it("keeps the calm Cited badge + grounded-in count header", () => {
    const html = renderWithSources();
    expect(html).toContain("Cited");
    expect(html).toContain("Grounded in 1 source");
  });
});

describe("escalation footer rendering", () => {
  it("low risk: escalateIf content is present in the DOM inside the quiet disclosure", () => {
    const html = renderCards("low");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("When to seek help");
    expect(html).not.toContain("Reach out for help if");
    // Collapsed by default — hidden, never unmounted.
    expect(html).toContain("hidden");
    expect(html).toContain('aria-expanded="false"');
  });

  it("moderate risk: escalateIf content is present in the full warning panel", () => {
    const html = renderCards("moderate");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("Reach out for help if");
  });

  it("high risk: warning panel keeps maximum prominence", () => {
    const html = renderCards("high");
    expect(html).toContain(ESCALATE_ITEM);
    expect(html).toContain("Reach out for help if");
  });
});

/**
 * B-AI-14 (reopened 6 Oct) — a seeded hard-moment answer carries the governed
 * card's escalation sentence in its own field, `governedEscalation` (set by
 * the server, byte-identical). The escalation slot shows THAT string, in both
 * tiers and both locales, and never the model's escalateIf beside it.
 */
describe("B-AI-14 — the escalation slot renders governedEscalation verbatim", () => {
  const MODEL_PARAPHRASE = "If things get harder, consider checking in with someone.";
  const seeded = (riskLevel: string, line: string): CoachContract => ({
    ...makeContract(riskLevel),
    escalateIf: [MODEL_PARAPHRASE],
    governedEscalation: line,
  });
  const render = (contract: CoachContract, lang: "en" | "he" = "en") =>
    renderToStaticMarkup(React.createElement(CoachAnswerCards, { contract, lang, onSaveToPlan: noop, onAddToHandoff: noop }));
  /** The text React escapes in markup (quotes, apostrophes, ampersands). */
  const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it("escalationLines: the governed field is the slot's only line; without it, escalateIf as before", () => {
    const line = hardMomentCards[0].escalation.en;
    expect(escalationLines(seeded("low", line))).toEqual([line]);
    expect(escalationLines(seeded("low", line))[0]).toBe(line); // same string, no copy edit
    expect(escalationLines(makeContract("low"))).toEqual([ESCALATE_ITEM]);
    expect(escalationLines({ escalateIf: [], governedEscalation: "" })).toEqual([]);
  });

  for (const card of hardMomentCards) {
    for (const lang of ["en", "he"] as const) {
      const line = lang === "he" ? card.escalation.he : card.escalation.en;
      for (const risk of ["low", "moderate"]) {
        it(`${card.id} · ${lang} · ${risk}: the slot shows the card's sentence, not the model's`, () => {
          const html = render(seeded(risk, line), lang);
          expect(html).toContain(`<li>${escapeHtml(line)}</li>`);
          expect(html).not.toContain(MODEL_PARAPHRASE);
          expect(html.split(escapeHtml(line)).length - 1).toBe(1);
        });
      }
    }
  }

  it("NEGATIVE CONTROL — an answer without the field still renders the model's escalateIf", () => {
    const html = render({ ...makeContract("moderate"), escalateIf: [MODEL_PARAPHRASE] });
    expect(html).toContain(MODEL_PARAPHRASE);
  });

  it("source pin: both tiers map the escalationLines result, never contract.escalateIf directly", () => {
    const src = readFileSync(path.resolve(__dirname, "CoachAnswerCards.tsx"), "utf8");
    expect(src).not.toMatch(/contract\.escalateIf\.map\(/);
    expect(src.match(/\{escalation\.map\(\(e, i\) => <li key=\{i\}>\{e\}<\/li>\)\}/g)?.length).toBe(2);
  });
});

/**
 * COACH-1 — HE/EN parity on the flagship answer surface.
 *
 * With lang="he" a full contract answer must render ZERO English chrome:
 * every panel title, action label and chip is asserted in Hebrew, and the
 * English literals are asserted absent. (CoachTab passes lang={uiLang}, so
 * this covers the uiLang=he path end-to-end for the card stack.)
 */
function makeFullContract(riskLevel: string): CoachContract {
  return {
    riskLevel,
    ageBand: "4-5",
    domains: ["attachment_regulation"],
    nonDiagnosticHypotheses: [{ label: "Transition fatigue", confidence: "possible", rationale: "Long day, short notice." }],
    todayPlan: ["Give a two-minute warning before leaving."],
    parentScript: "I see this is hard. We leave in two minutes.",
    avoid: ["Long explanations in the moment"],
    observe: ["Whether warnings shorten the storm"],
    escalateIf: [ESCALATE_ITEM],
    frameRouting: { aim: "Calmer exits", twoAxes: "Warm but firm", story: "", shadow: "", marriage: "", shepherd: "" },
    memoryProposals: [],
    handoffNotes: { teacher: "Transitions are hard this week.", professional: "" },
  };
}

function renderCardsHe(riskLevel: string): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract: makeFullContract(riskLevel),
      lens: "Dr. Becky Kennedy",
      council: [{ scholarId: "s1", name: "Dr. Ross Greene", concept: "CPS", takeaway: "Skill, not will.", suggestion: "Solve it together." }],
      lang: "he",
      onSaveToPlan: noop,
      onAddToHandoff: noop,
    })
  );
}

describe("COACH-1 — uiLang=he renders zero English chrome", () => {
  const HE_CHROME = [
    "המועצה התייעצה",        // council panel title
    "למה זה אולי קורה",       // why this might be happening (ASK-3 disclosure)
    "לנסות היום",             // try today
    "להפוך לתוכנית",          // turn into a plan (B-ASKJB-05: the ONE plan door)
    "אפשר להגיד",             // say this
    "ממה להימנע",             // avoid
    "למה לשים לב",            // watch for
    "פתק למורה",              // teacher note
  ];
  const EN_CHROME = [
    "The council weighed in",
    "What may be happening",
    "Why this might be happening",
    "Try today",
    "Save as plan",
    "Say this",
    "Watch for",
    "Developmental frame",
    "Save to plan",
    "Turn into a plan",
    "Go deeper",
    "Next steps",
    "Teacher note",
    "Reach out for help if",
    "When to seek help",
    "Aligned with",
  ];

  it("quiet tier (low risk): every panel title and action renders in Hebrew", () => {
    const html = renderCardsHe("low");
    for (const s of HE_CHROME) expect(html, `missing HE chrome "${s}"`).toContain(s);
    expect(html).toContain("מתי כדאי לפנות לעזרה"); // quiet escalation disclosure title
    for (const s of EN_CHROME) expect(html, `EN chrome "${s}" leaked into HE render`).not.toContain(s);
  });

  it("prominent tier (moderate risk): escalation headline is Hebrew, semantics preserved", () => {
    const html = renderCardsHe("moderate");
    expect(html).toContain("פנו לעזרה מקצועית אם"); // clear reach-out call — never a graded verdict
    expect(html).toContain(ESCALATE_ITEM);          // content itself is never dropped
    for (const s of EN_CHROME) expect(html, `EN chrome "${s}" leaked into HE render`).not.toContain(s);
  });

  it("EN render still carries the original English chrome (no regression)", () => {
    const html = renderToStaticMarkup(
      React.createElement(CoachAnswerCards, {
        contract: makeFullContract("low"),
        lang: "en",
        onSaveToPlan: noop,
        onAddToHandoff: noop,
      })
    );
    for (const s of ["Why this might be happening", "Try today", "Say this", "Watch for", "Turn into a plan", "Teacher note"]) {
      expect(html, `missing EN chrome "${s}"`).toContain(s);
    }
  });
});

/**
 * ASK-6 — felt memory, counts only. The footer row renders an integer COUNT
 * of approved facts ("Grounded in {n} facts you approved · Manage") and the
 * review chip names THAT something is pending — never fact content, never a
 * percentage or confidence figure (clinical firewall shape).
 */
describe("ASK-6 — memoryFooterLabel (counts-only helper)", () => {
  it("is empty for 0/undefined — no false memory claim on ungrounded answers", () => {
    expect(memoryFooterLabel(0, "en")).toBe("");
    expect(memoryFooterLabel(undefined, "en")).toBe("");
    expect(memoryFooterLabel(0, "he")).toBe("");
  });

  it("singular and plural forms in both languages", () => {
    expect(memoryFooterLabel(1, "en")).toBe("Grounded in 1 fact you approved");
    expect(memoryFooterLabel(3, "en")).toBe("Grounded in 3 facts you approved");
    expect(memoryFooterLabel(1, "he")).toBe("מבוסס על עובדה אחת שאישרתם");
    expect(memoryFooterLabel(3, "he")).toContain("3");
  });

  it("firewall: no percentage or confidence wording in either language", () => {
    for (const lang of ["en", "he"] as const) {
      for (const n of [1, 4]) {
        const label = memoryFooterLabel(n, lang);
        expect(label).not.toContain("%");
        expect(label.toLowerCase()).not.toContain("confidence");
        expect(label).not.toContain("ביטחון");
      }
    }
  });
});

describe("ASK-6 — memory footer rendering", () => {
  const SECRET_FACT = "NEVER-IN-THREAD: naps collapse after 15:00";

  function renderMemory(overrides: Partial<CoachContract>, lang: "en" | "he" = "en"): string {
    return renderToStaticMarkup(
      React.createElement(CoachAnswerCards, {
        contract: { ...makeContract("low"), ...overrides },
        lang,
        onSaveToPlan: noop,
        onAddToHandoff: noop,
        onManageMemory: noop,
      })
    );
  }

  it("grounded answers show the count row with the manage deep-link affordance", () => {
    const html = renderMemory({ approvedMemoryFactsUsed: 3 });
    expect(html).toContain("Grounded in 3 facts you approved");
    expect(html).toContain("Manage");
  });

  it("an ungrounded answer (count 0 or absent) renders no memory-claim row", () => {
    for (const html of [renderMemory({ approvedMemoryFactsUsed: 0 }), renderMemory({})]) {
      expect(html).not.toContain("facts you approved");
      expect(html).not.toContain("fact you approved");
    }
  });

  it("a proposal turn renders the review chip exactly once — with ZERO memory content in-thread", () => {
    const html = renderMemory({
      memoryProposals: [
        { fact: SECRET_FACT, source: "chat", retention: "3 months" },
        { fact: `${SECRET_FACT}-2`, source: "chat", retention: "3 months" },
      ],
    });
    expect(html.match(/Arbor suggests remembering something/g)?.length).toBe(1);
    // The binding firewall line: zero memory CONTENT rendered in-thread.
    expect(html).not.toContain(SECRET_FACT);
  });

  it("no proposals → no review chip", () => {
    expect(renderMemory({ approvedMemoryFactsUsed: 2 })).not.toContain("Arbor suggests remembering");
  });

  it("HE: count row and review chip render in Hebrew", () => {
    const html = renderMemory(
      { approvedMemoryFactsUsed: 2, memoryProposals: [{ fact: SECRET_FACT, source: "chat", retention: "3 months" }] },
      "he"
    );
    expect(html).toContain("מבוסס על 2 עובדות שאישרתם");
    expect(html).toContain("ניהול");
    expect(html).toContain("ארבור מציעה לזכור משהו");
    expect(html).not.toContain(SECRET_FACT);
    expect(html).not.toContain("Grounded in");
  });
});

/**
 * ASK-3 — answer stack reorder: the first screenful of any contract answer is
 * the exact words ("Say this") + the 1-3 steps ("Try today"); hypotheses are
 * analysis and collapse into a "Why this might be happening" disclosure; the
 * six-frame routing panel (internal orchestration vocabulary: "shadow",
 * "marriage", "shepherd") never renders on the parent surface — it stays in
 * the contract for telemetry/evals only.
 */
describe("Unified report — explanation, steps and script stay visible; frames never render", () => {
  function renderFullEn(): string {
    return renderToStaticMarkup(
      React.createElement(CoachAnswerCards, {
        contract: makeFullContract("low"),
        lang: "en",
        onSaveToPlan: noop,
        onAddToHandoff: noop,
      })
    );
  }

  it("explains before the ordered steps and usable script, with no More wrapper", () => {
    const html = renderFullEn();
    const why = html.indexOf("Why this might be happening");
    const plan = html.indexOf("Try today");
    const script = html.indexOf("Say this");
    expect(why).toBeGreaterThan(-1);
    expect(why).toBeLessThan(plan);
    expect(plan).toBeLessThan(script);
    expect(html).not.toContain('data-testid="coach-answer-more"');
    const explanation = html.slice(html.indexOf('data-testid="coach-report-understanding"'), html.indexOf('data-testid="coach-report-next"'));
    expect(explanation).not.toContain("hidden");
    expect(explanation).not.toContain("aria-expanded");
    expect(explanation).not.toContain("(possible)");
  });

  it("the frameRouting panel and its values are never visible to the parent", () => {
    const html = renderFullEn();
    // Panel title gone in both idioms + the contract's frame VALUES never leak.
    expect(html).not.toContain("Developmental frame");
    expect(html).not.toContain("Calmer exits");     // frameRouting.aim value
    expect(html).not.toContain("Warm but firm");    // frameRouting.twoAxes value
  });

  it("explanation content remains visible by default", () => {
    const html = renderFullEn();
    expect(html).toContain("Why this might be happening");
    // Content present (hidden, never unmounted) — same idiom as the citation drawer.
    expect(html).toContain("Transition fatigue");
    expect(html).toContain("Long day, short notice.");
  });

  it("hypotheses disclosure renders in Hebrew with zero English chrome", () => {
    const html = renderCardsHe("low");
    expect(html).toContain("למה זה אולי קורה");
    expect(html).not.toContain("Why this might be happening");
  });
});

describe("B-ASKJB-04 — the try-it control renders per state, 44 px, EN + HE", () => {
  it("accept / replace / accepted / hidden", async () => {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { CoachTryIt } = await import("./CoachAnswerCards");
    const noop = () => {};
    const r = (today: any, lang: "en" | "he" = "en") =>
      renderToStaticMarkup(React.createElement(CoachTryIt, { step: "Name it first.", today, lang, onTryIt: noop, onUndo: noop }));
    expect(r(null)).toContain("I&#x27;ll try it");
    expect(r(null)).toContain("min-h-11");
    const other = { id: "today.c.2026-10-03", recommendation: "Warn first.", status: "accepted" };
    expect(r(other)).toContain("Make this today&#x27;s step");
    expect(r(other)).toContain("Warn first.");
    expect(r({ ...other, recommendation: "Name it first." })).toContain("we&#x27;ll ask how it went");
    expect(r({ ...other, status: "completed" })).toBe("");
    expect(r(null, "he")).toContain("אנסה את זה");
    expect(r(other, "he")).toContain("שזה יהיה הצעד של היום");
  });
});

/**
 * The user intentionally superseded B-ASKJB-05's collapsed five-block
 * layout. Preserve the actual safety and action contracts, while guarding
 * the new visible, ordered report rather than freezing the regressed layout.
 */
describe("Unified report — depth without duplicate cards", () => {
  function full(riskLevel: string, extra: Partial<CoachContract> = {}): CoachContract {
    return {
      ...makeFullContract(riskLevel),
      text: "A hard transition can need a smaller next step.",
      todayPlan: ["Give a two-minute warning before leaving.", "Name the next thing.", "Hold the hand at the door."],
      sourceCardsUsed: ["transition-warnings"],
      sourceCards: [{ id: "transition-warnings", title: "Transition warnings", type: "practice_card" }],
      approvedMemoryFactsUsed: 2,
      memoryProposals: [{ fact: "PRIVATE FACT", source: "parent", retention: "long" }],
      ...extra,
    };
  }
  function render(contract: CoachContract, lang: "en" | "he" = "en", props: Partial<Parameters<typeof CoachAnswerCards>[0]> = {}): string {
    return renderToStaticMarkup(React.createElement(CoachAnswerCards, {
      contract, lang, lens: "Dr. Becky Kennedy",
      onSaveToPlan: noop, onAddToHandoff: noop, onManageMemory: noop, onGoDeeper: noop,
      onTryIt: noop, onUndoTryIt: noop, todayStep: null,
      ...props,
    }));
  }

  for (const lang of ["en", "he"] as const) {
    it("[" + lang + "] owns the lead once, then visible understanding and all ordered steps", () => {
      const contract = full("low");
      const html = render(contract, lang);
      expect(html.split(contract.text!).length - 1).toBe(1);
      expect(html).toContain('dir="' + (lang === "he" ? "rtl" : "ltr") + '"');
      expect(html.indexOf('data-testid="coach-report-opening"')).toBeLessThan(html.indexOf('data-testid="coach-report-understanding"'));
      const start = html.indexOf('data-testid="coach-report-next"');
      const end = html.indexOf('class="coach-report__section coach-report__script"');
      const steps = html.slice(start, end);
      for (const step of contract.todayPlan) expect(steps.split(step).length - 1).toBe(1);
      expect(steps).not.toMatch(/class="[^"]*\bhidden\b|<details|style="[^"]*display:none/);
      expect(steps).toContain("<ol");
      expect(steps.split('data-testid="coach-try-it"').length - 1).toBe(1);
      expect(html).not.toContain('data-testid="coach-answer-more"');
      expect(html).not.toContain("PRIVATE FACT");
    });

    it("[" + lang + "] urgent governed help precedes even the lead; no diagnosis grade is exposed", () => {
      const html = render(full("moderate"), lang);
      expect(html.indexOf('data-testid="coach-report-urgent-help"')).toBeLessThan(html.indexOf('data-testid="coach-report-opening"'));
      expect(html).toContain(ESCALATE_ITEM);
      expect(html).not.toContain("(moderate)");
      expect(html).not.toContain("(possible)");
    });

    it("[" + lang + "] keeps one plan door, teacher handoff and optional council", () => {
      const html = render(full("low"), lang);
      expect(html.split('data-testid="coach-plan-door"').length - 1).toBe(1);
      expect(html).toContain(lang === "he" ? "פתק למורה" : "Teacher note");
      expect(html).toContain('data-testid="coach-go-deeper"');
      const withCouncil = render(full("low"), lang, { council: [{ scholarId: "s1", name: "Dr. Ross Greene", concept: "CPS", takeaway: "Skill, not will.", suggestion: "Solve it together." }] });
      expect(withCouncil).not.toContain('data-testid="coach-go-deeper"');
      expect(withCouncil).toContain("Dr. Ross Greene");
      expect(render(full("low"), lang, { onGoDeeper: undefined })).not.toContain('data-testid="coach-go-deeper"');
    });
  }

  it("offers keep controls only beside allow-listed original content, never hypotheses or safety", () => {
    const calls: { field: string; text: string }[] = [];
    const contract = full("low");
    const html = render(contract, "en", { renderKeepAction: (field, text) => {
      calls.push({ field, text });
      return React.createElement("button", { type: "button" }, "Keep advice");
    } });
    expect(calls).toEqual([
      ...contract.todayPlan.map((text) => ({ field: "todayPlan", text })),
      { field: "parentScript", text: contract.parentScript },
      ...contract.observe.map((text) => ({ field: "observe", text })),
    ]);
    expect(html.split(contract.todayPlan[0]).length - 1).toBe(1);
    expect(calls.some(({ text }) => text === ESCALATE_ITEM)).toBe(false);
    expect(calls.some(({ text }) => text === contract.nonDiagnosticHypotheses[0].label)).toBe(false);
  });

  it("omits empty scaffolding for a short follow-up", () => {
    const html = render({ ...makeContract("low"), text: "Yes, that is enough.", escalateIf: [] }, "en", { onGoDeeper: undefined });
    expect(html).toContain("Yes, that is enough.");
    for (const id of ["coach-report-understanding", "coach-report-next", "say-this", "coach-plan-door", "coach-report-help"]) expect(html).not.toContain('data-testid="' + id + '"');
  });

  it("source guard: copy confirmation follows successful clipboard write and a failed copy has a manual fallback", () => {
    const source = readFileSync(path.resolve(__dirname, "CoachAnswerCards.tsx"), "utf8");
    expect(source.indexOf("await navigator.clipboard.writeText(text)")).toBeLessThan(source.indexOf("setCopied(key)"));
    expect(source).toContain("setCopyFallback(text)");
    expect(source).toContain("event.currentTarget.select()");
  });

  it("all report controls have a 44px minimum and visible focus, without relying on viewport width", () => {
    const css = readFileSync(path.resolve(__dirname, "coachReport.css"), "utf8");
    for (const selector of [".coach-report__tools button", ".coach-report__disclosure > button", ".coach-report__memory button", ".coach-report__keep button"]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("min-block-size: var(--touch-min)");
    expect(css).toContain("button:focus-visible");
    expect(css).toContain("@container (min-width: 580px)");
    expect(css).toContain("minmax(0, 1fr)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
