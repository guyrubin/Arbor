/**
 * B-CAREPRO-27 — rendered: a Free parent opening the School Brief sees a
 * teacher brief at once (built on the device from the teacher preset), can
 * reach "Save as PDF", and no request or paywall fires on the way. EN + HE.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  generateBrief: vi.fn(),
  openPaywall: vi.fn(),
  plans: null as unknown[] | null,
  strengths: null as string[] | null,
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa", age: 5, languages: ["Hebrew"], schoolContext: harness.locale === "he" ? "גן שקד" : "Gan Shaked", strengths: harness.strengths ?? [harness.locale === "he" ? "בונה מגדלים" : "Builds towers"], challenges: [] },
    behaviorLogs: [],
    milestones: [],
    actionPlans: harness.plans ?? [{ id: "p1", title: harness.locale === "he" ? "התראה של חמש דקות" : "Five-minute warning", phases: [] }],
    setActiveTab: vi.fn(),
    openPaywall: harness.openPaywall,
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { ...actual.api, generateBrief: harness.generateBrief } };
});
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import SchoolBrief from "./SchoolBrief";

beforeEach(() => {
  harness.plans = null;
  harness.strengths = null;
  harness.generateBrief.mockReset();
  harness.openPaywall.mockReset();
});

describe("B-CAREPRO-27 · Free parent: a teacher brief on open, no paywall", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the draft renders with the profile's setting, strengths and what the family tries`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      expect(html).toContain('data-module="brief-draft"');
      expect(html).toContain(locale === "he" ? "גן שקד" : "Setting: Gan Shaked.");
      expect(html).toContain(locale === "he" ? "בונה מגדלים" : "Builds towers");
      expect(html).toContain(locale === "he" ? "התראה של חמש דקות" : "Five-minute warning");
      // the one primary move is the print button, reachable without Plus
      expect((html.match(/data-primary-move="build-school-brief"/g) ?? []).length).toBe(1);
      expect(html).toContain(translate(locale, "elev.learnCare.brief.print"));
      // Plus is offered as the AI draft, not demanded
      expect(html).toContain('data-testid="school-brief-ai-draft"');
      expect(harness.generateBrief).not.toHaveBeenCalled();
      expect(harness.openPaywall).not.toHaveBeenCalled();
    });

    it(`${locale}: W2-CAREPRO r1 — Save as PDF comes before the document, no page kicker, labels name what the lists hold`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      // the one move precedes the draft card in document order (above the fold)
      const move = html.indexOf('data-primary-move="build-school-brief"');
      const card = html.indexOf('data-module="brief-draft"');
      expect(move).toBeGreaterThan(-1);
      expect(move).toBeLessThan(card);
      // and it is the first control of its row
      expect(html.indexOf('data-testid="school-brief-ai-draft"')).toBeGreaterThan(move);
      // no "Care Network" kicker: the hub already names it
      expect(html).not.toContain(translate(locale, "schoolBrief.eyebrow"));
      // the draft hint is a caption INSIDE the card, not a preamble layer
      expect(html.indexOf('data-testid="school-brief-draft-hint"')).toBeGreaterThan(card);
      // strengths are labelled as strengths
      expect(html).toContain(translate(locale, "schoolBrief.section.strengths", { name: "Noa" }));
      expect(html).not.toContain(locale === "he" ? "מה מרגיע" : "What calms");
    });
  }
});

/* W2-CAREPRO r2 (law 8, P1 G0) — the Arbor-composed Hebrew overview reads in
   Hebrew order. translate() already isolates the name (FSI…PDI), but the
   paragraph was dir="auto", and the HTML dir=auto rule takes the first strong
   letter WITHOUT skipping isolate content — the Latin name — so the line
   resolved LTR and "Noa, 5" landed at the far end. The composed overview now
   takes the UI direction; dir=auto stays only on parent-typed list items. */
describe("W2-CAREPRO r2 · the HE overview is RTL with the name first", () => {
  const FSI = "⁨";
  const PDI = "⁩";
  /** HTML dir=auto: the first strong letter in the text, isolates NOT skipped. */
  const htmlAutoDirection = (text: string): "rtl" | "ltr" | null => {
    for (const ch of text) {
      if (/[֐-׿]/.test(ch)) return "rtl";
      if (/[A-Za-z]/.test(ch)) return "ltr";
    }
    return null;
  };
  const overviewOf = (html: string) => {
    const m = /<p data-testid="school-brief-overview" dir="(rtl|ltr|auto)"[^>]*>([^<]*)<\/p>/.exec(html);
    return m ? { dir: m[1], text: m[2] } : null;
  };

  it("HE: the paragraph is dir=rtl and the isolated name comes first", () => {
    harness.locale = "he";
    const ov = overviewOf(renderToStaticMarkup(<SchoolBrief />))!;
    expect(ov.dir).toBe("rtl");
    expect(ov.text.startsWith(`${FSI}Noa${PDI}`)).toBe(true);
    expect(ov.text).toContain("גן שקד");
  });

  it("negative control: under dir=auto this very line resolves LTR (the r2 defect)", () => {
    harness.locale = "he";
    const ov = overviewOf(renderToStaticMarkup(<SchoolBrief />))!;
    expect(htmlAutoDirection(ov.text)).toBe("ltr");
  });

  it("EN: dir=ltr", () => {
    harness.locale = "en";
    expect(overviewOf(renderToStaticMarkup(<SchoolBrief />))!.dir).toBe("ltr");
  });
});

/* W2-CAREPRO r2 (P1 G1) + B-CAREPRO-NEW-2d — the fold at 375/390 holds the
   overview and strengths: ONE action row (Save as PDF + the Plus draft), the
   edit toggle is a 44 px pencil in the card header, the non-diagnostic promise
   is a card-header caption (no green card above the document), and the note
   opens on a "Start here" line built from the first curated strength. */
describe("W2-CAREPRO r2 · one action row, promise in the card, a Start-here line", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the action row holds exactly the PDF move and the Plus draft; edit + promise live in the card header`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      const rowStart = html.indexOf('data-testid="school-brief-actions"');
      const card = html.indexOf('data-module="brief-draft"');
      const row = html.slice(rowStart, card);
      expect(row).toContain("flex-nowrap");
      expect((row.match(/<button/g) ?? []).length).toBe(2);
      expect(row).toContain('data-primary-move="build-school-brief"');
      expect(row).toContain('data-testid="school-brief-ai-draft"');
      // nothing between the header and the action row: the green card is gone
      expect(html.slice(html.indexOf("</header>"), rowStart)).not.toContain("arbor-green-soft");
      const header = html.slice(html.indexOf('data-testid="school-brief-card-header"'), html.indexOf('data-testid="school-brief-overview"'));
      expect(header).toContain('data-testid="school-brief-promise"');
      expect(header.replace(/&#x27;/g, "'")).toContain(translate(locale, "elev.learnCare.brief.caption")); // W2-CAREPRO c2 r1: one caption line
      expect(header).toMatch(/data-testid="school-brief-edit"[^>]*w-11 h-11/);
      expect(html.indexOf('data-testid="school-brief-edit"')).toBeGreaterThan(card);
    });

    it(`${locale}: "Start here" opens the note from the first strength, and the overview does not repeat it`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      const opening = translate(locale, "elev.teacherBrief.opening.neutral", { name: "Noa", strength: locale === "he" ? "בונה מגדלים" : "builds towers" });
      const band = html.slice(html.indexOf('data-testid="school-brief-opening"'), html.indexOf('data-testid="school-brief-overview"'));
      expect(band).toContain(translate(locale, "elev.learnCare.brief.startHere"));
      expect(band).toContain(opening.replace(/'/g, "&#x27;"));
      expect(band).toContain("var(--arbor-peach-wash)");
      const overview = /<p data-testid="school-brief-overview"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      expect(overview).not.toContain(opening);
      // the band sits under the card header, above the overview section
      expect(html.indexOf('data-testid="school-brief-opening"')).toBeGreaterThan(html.indexOf('data-testid="school-brief-card-header"'));
    });
  }

  it("unit: the opening line rides the curated overview first (prints first), follows gender, and is empty with no strength", async () => {
    const { teacherBriefDraft, buildPacketInput } = await import("../../consult/packet");
    const mk = (strengths: string[], gender?: string) => teacherBriefDraft(
      buildPacketInput({ profile: { id: "c1", name: "Dylan Cohen", age: 5, languages: ["English"], schoolContext: "", strengths, challenges: [], interests: [], gender } as never, logs: [], milestones: [], plans: [], memory: [] }, Date.now()),
      "en",
    );
    expect(mk(["Imaginative play"], "boy").openingLine).toBe("With Dylan, start from what he loves: imaginative play.");
    expect(mk(["Imaginative play"], "girl").openingLine).toContain("she loves");
    expect(mk([]).openingLine).toBe("");
    const he = teacherBriefDraft(
      buildPacketInput({ profile: { id: "c1", name: "Dylan", age: 5, languages: [], schoolContext: "", strengths: ["משחק דמיון"], challenges: [], interests: [], gender: "boy" } as never, logs: [], milestones: [], plans: [], memory: [] }, Date.now()),
      "he",
    );
    expect(he.openingLine).toBe("עם ⁨Dylan⁩, הכי טוב להתחיל ממה שהוא אוהב: משחק דמיון.");
    expect(he.openingLine).not.toMatch(/\//);
  });
});

/* W2-CAREPRO c2 r1 — school-brief critics (product P1 G1 x3, design P1 G1 x3). */
describe("W2-CAREPRO c2 r1 · real moves for a teacher, one gradient, one list direction, a quiet hub line", () => {
  const plan = (he: boolean) => ({
    id: "plan-1",
    title: he ? "תוכנית מעבר לגן והגעה בבוקר" : "Preschool Transition & Morning Arrival Plan",
    issue: he ? "חרדת מעבר שמופעלת מלחץ יציאה" : "Transition anxiety triggered by departure pressure and bilingual friction",
    phases: [
      { name: he ? "שלב 1: בבית" : "Phase 1: At home", description: "", steps: [
        { text: he ? "להחזיק אבן אומץ קטנה בכיס בדרך החוצה" : "Hold a small 'courage pebble' in a pocket on the way out", completed: true },
        { text: he ? "לשיר את שיר הנעליים" : "Sing the shoes song", completed: false },
      ] },
      { name: he ? "שלב 3: חיבור בכיתה" : "Phase 3: Classroom Handoff Connection", description: "", steps: [
        { text: he ? "הגננת מקבלת את ידו ליד הדלת" : "The teacher takes his hand at the door", completed: false },
      ] },
    ],
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: 'Easy things a teacher can try' = completed steps first, then a classroom phase's steps — never the plan's issue`, () => {
      harness.locale = locale;
      harness.plans = [plan(locale === "he")];
      const html = renderToStaticMarkup(<SchoolBrief />).replace(/&#x27;/g, "'");
      const p = plan(locale === "he");
      expect(html).toContain(p.phases[0].steps[0].text);
      expect(html).toContain(p.phases[1].steps[0].text);
      expect(html).not.toContain(p.phases[0].steps[1].text); // not done, not a classroom phase
      expect(html).not.toContain(p.issue);
      expect(html).not.toMatch(/anxiety|חרדה|חרדת/i);
      expect(html).not.toContain(" — for ");
    });

    it(`${locale}: exactly one gradient on the route (Save as PDF); the band and the Plus chip are flat washes`, () => {
      harness.locale = locale;
      harness.strengths = ["Builds towers"];
      const html = renderToStaticMarkup(<SchoolBrief />);
      const gradients = html.match(/var\(--(arbor-gradient-primary|gradient-cta|arbor-(peach|lav|pink|sky|yellow|green|clay)-soft)\)/g) ?? [];
      expect(gradients).toEqual(["var(--arbor-gradient-primary)"]);
      const pdf = html.slice(html.lastIndexOf("<button", html.indexOf('data-primary-move="build-school-brief"')), html.indexOf("</button>", html.indexOf('data-primary-move="build-school-brief"')));
      expect(pdf).toContain("var(--arbor-gradient-primary)");
      expect(html).toContain("var(--arbor-peach-wash)");
      expect(html).toContain("var(--arbor-lav-wash)");
    });

    it(`${locale}: one list direction per card — a Latin item in an RTL list keeps the UI direction, its words in a <bdi>`, () => {
      harness.locale = locale;
      harness.strengths = ["Pretend play", "בונה מגדלים"];
      const html = renderToStaticMarkup(<SchoolBrief />);
      const dir = locale === "he" ? "rtl" : "ltr";
      const lists = html.match(/<ul dir="(\w+)" data-testid="school-brief-list"/g) ?? [];
      expect(lists.length).toBeGreaterThan(0);
      for (const ul of lists) expect(ul).toContain(`dir="${dir}"`);
      expect(html).toContain(`<li dir="${dir}" class="t-base leading-relaxed"><bdi>Pretend play</bdi></li>`);
      expect(html).not.toMatch(/<li dir="auto"/);
    });

    it(`${locale}: one caption line in the card header; the draft hint sits in the card footer`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      const header = html.slice(html.indexOf('data-testid="school-brief-card-header"'), html.indexOf('data-testid="school-brief-edit"')).replace(/&#x27;/g, "'");
      expect(header).toContain(translate(locale, "elev.learnCare.brief.caption"));
      expect(header).not.toContain('data-testid="school-brief-draft-hint"');
      expect(html.indexOf('data-testid="school-brief-draft-hint"')).toBeGreaterThan(html.indexOf(translate(locale, "schoolBrief.bilingualNote")));
      // the lede is one sentence
      expect(translate(locale, "schoolBrief.subtitle", { name: "Noa" }).replace(/\.$/, "")).not.toMatch(/[.:]\s/);
    });
  }

  it("the shell does not repeat the Care introduction above school-brief", async () => {
    const { readFileSync } = await import("node:fs");
    const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8");
    expect(shell).not.toContain('t("nav.sub." + hubSubKey');
  });

  it("teacherStrategies (pure): cap 3, dedupe, no plan with steps → its title only; NEGATIVE CONTROL: the pre-fix 'title — for issue' line trips the issue scan", async () => {
    const { teacherStrategies } = await import("../../consult/packet");
    const clean = (x: string) => x.trim().length > 0;
    const steps = [1, 2, 3, 4].map((i) => ({ text: `Step ${i}`, completed: true, phase: "Phase 1" }));
    expect(teacherStrategies([{ title: "T", issue: "Transition anxiety", steps }], clean)).toEqual(["Step 1", "Step 2", "Step 3"]);
    expect(teacherStrategies([{ title: "Five-minute warning", issue: "Transition anxiety" }], clean)).toEqual(["Five-minute warning"]);
    const pre = "Preschool Transition & Morning Arrival Plan — for Transition anxiety triggered by departure pressure..";
    expect(/anxiety/i.test(pre)).toBe(true);
  });
});

/* W2-CAREPRO c2 r2 — B-CAREPRO-NEW-2d: "Start here" carries the parent's own
 * working move (a COMPLETED plan step only) and a screen-only provenance
 * caption; never the plan's issue, never invented. */
describe("W2-CAREPRO c2 r2 · Start here: what already works at home, from what you wrote", () => {
  const plan = (he: boolean, done: boolean) => ({
    id: "plan-1",
    title: he ? "תוכנית בוקר" : "Morning plan",
    issue: he ? "חרדת מעבר" : "Transition anxiety",
    phases: [{ name: he ? "שלב 1: בבית" : "Phase 1: At home", description: "", steps: [
      { text: he ? "להחזיק אבן אומץ בכיס בדרך החוצה" : "Hold the courage pebble on the way out", completed: done },
    ] }],
  });
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a completed step → one 'what already works at home' line inside the band, then the provenance caption`, () => {
      harness.locale = locale;
      harness.strengths = ["Builds towers"];
      harness.plans = [plan(locale === "he", true)];
      const html = renderToStaticMarkup(<SchoolBrief />).replace(/&#x27;/g, "'");
      const band = html.slice(html.indexOf('data-testid="school-brief-opening"'), html.indexOf("</div>", html.indexOf('data-testid="school-brief-provenance"')));
      const step = plan(locale === "he", true).phases[0].steps[0].text;
      expect(band).toContain(translate(locale, "elev.learnCare.brief.homeWorks", { step }));
      expect(band).toContain(translate(locale, "elev.learnCare.brief.provenance", { name: "Noa" }));
      expect(band.indexOf('data-testid="school-brief-home-works"')).toBeLessThan(band.indexOf('data-testid="school-brief-provenance"'));
      expect(band).not.toMatch(/anxiety|חרדת/i);
    });

    it(`${locale}: NEGATIVE CONTROL — no completed step → no home line (nothing invented)`, () => {
      harness.locale = locale;
      harness.strengths = ["Builds towers"];
      harness.plans = [plan(locale === "he", false)];
      const html = renderToStaticMarkup(<SchoolBrief />);
      expect(html).not.toContain('data-testid="school-brief-home-works"');
      expect(html).toContain('data-testid="school-brief-provenance"');
    });
  }
});
