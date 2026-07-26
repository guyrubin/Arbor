import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoachAnswerCards, { sourcesLabel, escalationTier, citationRows, memoryFooterLabel } from "./CoachAnswerCards";
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

function renderCards(riskLevel: string): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract: makeContract(riskLevel),
      onSaveToPlan: noop,
      onCreateLog: noop,
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
        onCreateLog: noop,
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
      onCreateLog: noop,
      onAddToHandoff: noop,
    })
  );
}

describe("COACH-1 — uiLang=he renders zero English chrome", () => {
  const HE_CHROME = [
    "המועצה התייעצה",        // council panel title
    "למה זה אולי קורה",       // why this might be happening (ASK-3 disclosure)
    "לנסות היום",             // try today
    "שמירה כתוכנית",          // save as plan
    "אפשר להגיד",             // say this
    "ממה להימנע",             // avoid
    "למה לשים לב",            // watch for
    "שמירה לתוכנית",          // save to plan
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
        onCreateLog: noop,
        onAddToHandoff: noop,
      })
    );
    for (const s of ["Why this might be happening", "Try today", "Say this", "Watch for", "Save to plan", "Teacher note"]) {
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
        onCreateLog: noop,
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
describe("ASK-3 — script + plan lead, hypotheses collapse, frames never render", () => {
  function renderFullEn(): string {
    return renderToStaticMarkup(
      React.createElement(CoachAnswerCards, {
        contract: makeFullContract("low"),
        lang: "en",
        onSaveToPlan: noop,
        onCreateLog: noop,
        onAddToHandoff: noop,
      })
    );
  }

  it("parentScript renders before todayPlan, and todayPlan before the hypotheses disclosure", () => {
    const html = renderFullEn();
    const script = html.indexOf("Say this");
    const plan = html.indexOf("Try today");
    const why = html.indexOf("Why this might be happening");
    expect(script).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(-1);
    expect(why).toBeGreaterThan(-1);
    expect(script, "script must lead the stack").toBeLessThan(plan);
    expect(plan, "plan must precede the hypotheses disclosure").toBeLessThan(why);
  });

  it("the frameRouting panel and its values are never visible to the parent", () => {
    const html = renderFullEn();
    // Panel title gone in both idioms + the contract's frame VALUES never leak.
    expect(html).not.toContain("Developmental frame");
    expect(html).not.toContain("Calmer exits");     // frameRouting.aim value
    expect(html).not.toContain("Warm but firm");    // frameRouting.twoAxes value
  });

  it("hypotheses disclosure is collapsed by default but the content stays in the DOM", () => {
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
