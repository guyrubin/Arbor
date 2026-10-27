/**
 * server/plans — B-BOOK-75 / B-BOOK-77 / B-KID-167: the server side of
 * Everyday Plans.
 *
 *   GET  /api/plans/visibility
 *        → { reviewed, composable } per pattern and language for THIS viewer:
 *          `reviewed` is the licensed reviewer's record (config.plansReviewed,
 *          default nothing); `composable` adds the sandbox and the owner
 *          allow-list. The client's pattern door reads this and never decides
 *          on its own (lib/library/plans/planVisibility).
 *   POST /api/plans/phrase   { pattern, slot, lang, text }
 *        → B-GA-11: the parent's own words phrased into the book's register,
 *          ONE model call at composition time (never at read time), the
 *          output screened (the lexical output screen, the clinical-term scan,
 *          the plan lint on the line in a composed book) and returned
 *          UNAPPROVED; the parent approves the exact line in the composer.
 *          MODEL_PROVIDER=mock phrases deterministically (zero outbound calls).
 *   POST /api/children/:childId/plan-books
 *        body { pattern, lang, stepMenuIds[3], ownStep?, minutes, time, boxItemIds[], durationDays }
 *        → validates the composition against the pattern's sourced menu (an
 *          own step only with the parent's approval stamp on the exact line),
 *          refuses an UNSIGNED pattern for anyone outside the sandbox and the
 *          owner list (403 plan_unsigned — the visibility gate, GA DoD 3),
 *          lints the composed book, stamps the parent's approval (uid, now)
 *          and returns the PlanBookDoc the device persists under
 *          users/{uid}/children/{cid}/books/{bookId} through the same
 *          per-child collection seam as every other row (both the cloud and
 *          the sandbox).
 *
 * Refusals: another family 403 (requireOwnership), unknown pattern 404, a
 * composition the menu does not allow 400 (the problems listed), unsigned
 * 403, a line the screens refuse 422.
 */
import express, { type RequestHandler, type Response } from "express";
import type { ArborConfig } from "../config/env.js";
import type { GenerateJsonOptions } from "../ai/modelRouter.js";
import { findClinicalDiagnosisTerm } from "../lib/clinicalScan.js";
import { screenModelOutputLexical } from "../safety/outputScreenLexical.js";
import { composePlanBook, OWN_STEP, validatePlanComposition, type OwnStep, type OwnStepOrigin, type PlanComposition } from "../lib/library/plans/composePlanBook.js";
import { getPattern } from "../lib/library/plans/planBooks.js";
import { planBookId, readOwnStep, type PlanBookDoc } from "../lib/library/plans/planBookDoc.js";
import { lintPlanBook } from "../lib/library/plans/planLint.js";
import { canComposePlan, isPatternId, planVisibilityFor, readReviewFlags, type PlanOwners, type PlanReviewFlags, type PlanViewer } from "../lib/library/plans/planVisibility.js";
import type { BookLang, BookLine } from "../lib/library/types.js";
import type { PatternDef } from "../lib/library/plans/patterns.js";
import { logger, requestIdOf } from "./logger.js";

export interface PlansRouterDeps {
  config: Pick<ArborConfig, "plansReviewed" | "plansOwnerUids" | "plansOwnerEmails" | "memoryAdapter" | "arborEnv" | "modelProvider">;
  requireOwnership: RequestHandler;
  /** The model router (one JSON generation per phrasing); absent or mock = the deterministic phrasing. */
  modelProvider?: { generateJson(options: GenerateJsonOptions): Promise<unknown> } | null;
  now?: () => string;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const OWN_WORDS_MAX = 240;

const refuse = (res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}) => res.status(status).json({ error: message, code, ...extra });

/** Who is asking: the verified uid and email, or the local sandbox (no
 *  Firebase, no token) — never a client-supplied claim. */
export function viewerOf(req: express.Request, config: Pick<ArborConfig, "memoryAdapter" | "arborEnv">): PlanViewer {
  const user = (req as { user?: { uid?: string; email?: string | null } }).user;
  const sandbox = !user?.uid && config.memoryAdapter === "local" && config.arborEnv !== "prod";
  return { uid: user?.uid ?? null, email: user?.email ?? null, sandbox };
}

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** The deterministic phrasing (MODEL_PROVIDER=mock, tests): the parent's
 *  words inside the step frame, in the book's register. A Hebrew source
 *  keeps its words in the Hebrew lines and gets a plain English line. */
export function mockPhrase(slot: 1 | 2 | 3, text: string): BookLine {
  const ord = ["one", "two", "three"][slot - 1];
  const heOrd = ["ראשון", "שני", "שלישי"][slot - 1];
  const clean = text.trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  const en = hasHebrew(clean) ? `Step ${ord}: we do our own step, the same way every day. My body gets a chance.` : `Step ${ord}: every day, we ${clean.replace(/^(we|i)\s+/i, "")}. The same way every day. My body gets a chance.`;
  const he = hasHebrew(clean) ? `שלב ${heOrd}: כל יום, ${clean}. אותו דבר כל יום. הגוף שלי מקבל הזדמנות.` : `שלב ${heOrd}: כל יום, אנחנו עושים את השלב שלנו, אותו דבר כל יום. הגוף שלי מקבל הזדמנות.`;
  return { en, he: { m: he, f: he } };
}

/** Every reason a phrased line may not reach a child, or null when clean. */
export function screenPhrasedLine(def: PatternDef, slot: 1 | 2 | 3, line: BookLine, sourceText: string): string | null {
  for (const t of [line.en, line.he.m, line.he.f]) {
    const lex = screenModelOutputLexical(t);
    if (lex.flagged) return `output_screen:${lex.category}`;
    const term = findClinicalDiagnosisTerm(t);
    if (term) return `clinical_term:${term}`;
  }
  // the lint, on the line inside a composed book (caps, person, modals, nouns, digits, name)
  const stepMenuIds = [...def.defaultSteps] as [string, string, string];
  stepMenuIds[slot - 1] = OWN_STEP;
  const own: OwnStep = { slot, sourceText, text: line, aiPhrased: true, approvedAt: "screen" };
  const first = def.menu.find((m) => m.id === def.defaultSteps[0]);
  const c: PlanComposition = { bookId: "screen", stepMenuIds, ownStep: own, minutes: first?.defaultMinutes ?? 5, time: first?.defaultTime ?? "evening", boxItemIds: [], durationDays: def.defaultDurationDays, approvedAt: "screen", approvedBy: "screen" };
  const problems = validatePlanComposition(def, c);
  if (problems.length) return `composition:${problems.map((p) => p.code).join(",")}`;
  const hits = lintPlanBook(composePlanBook(def, c), { bannedEn: def.bannedWords.en, bannedHe: def.bannedWords.he }).filter((h) => h.pageId === `s${slot}-own`);
  return hits.length ? `lint:${[...new Set(hits.map((h) => h.rule))].join(",")}` : null;
}

const asLine = (raw: unknown): BookLine | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const en = typeof r.en === "string" ? r.en.trim() : "";
  const m = typeof r.he_m === "string" ? r.he_m.trim() : typeof r.heM === "string" ? r.heM.trim() : "";
  const f = typeof r.he_f === "string" ? r.he_f.trim() : typeof r.heF === "string" ? r.heF.trim() : m;
  return en && m ? { en, he: { m, f: f || m } } : null;
};

export function createPlansRouter(deps: PlansRouterDeps): express.Router {
  const router = express.Router();
  const flags: PlanReviewFlags = readReviewFlags(deps.config.plansReviewed);
  const owners: PlanOwners = { uids: deps.config.plansOwnerUids, emails: deps.config.plansOwnerEmails };
  const now = deps.now ?? (() => new Date().toISOString());
  const mock = !deps.modelProvider || deps.config.modelProvider === "mock";

  router.get("/plans/visibility", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(planVisibilityFor(flags, viewerOf(req, deps.config), owners));
  });

  router.post("/plans/phrase", express.json({ limit: "8kb" }), async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!isPatternId(b.pattern)) return refuse(res, 404, "plan_unknown_pattern", "Unknown pattern");
    const def = getPattern(b.pattern);
    if (!def) return refuse(res, 404, "plan_unknown_pattern", "This pattern is not authored yet");
    const slot = b.slot === 1 || b.slot === 2 || b.slot === 3 ? b.slot : null;
    if (!slot) return refuse(res, 400, "plan_bad_slot", "Bad step slot");
    const text = typeof b.text === "string" ? b.text.trim().slice(0, OWN_WORDS_MAX) : "";
    if (text.length < 3) return refuse(res, 400, "plan_empty_words", "Write the step in a few words");
    const lang: BookLang = b.lang === "he" ? "he" : "en";
    // B-BOOK-79 door (a): the parent relays a step from the professional who works with the child; the line is phrased and screened the same way, and labelled.
    const origin: OwnStepOrigin = b.origin === "practitioner" ? "practitioner" : "parent";
    const viewer = viewerOf(req, deps.config);
    const verdict = canComposePlan({ patternId: def.id, lang, flags, viewer, owners });
    if (!verdict.ok) return refuse(res, 403, "plan_unsigned", "This plan has not been reviewed for your language yet", { pattern: def.id, lang });
    let line: BookLine | null = null;
    if (mock) line = mockPhrase(slot, text);
    else {
      try {
        const raw = await deps.modelProvider!.generateJson({
          route: "analysis_structured",
          temperature: 0.2,
          prompt: [
            "You phrase ONE step of a parent's plan into a short line of a first-person picture book a young child (3-8) will hear.",
            "Rules: first person, present or future tense, 'we' carries the plan, never 'you', never should/must/have to, no digits except a time in minutes, no praise of the child, no verdict, no diagnosis noun, no medicine, no brand, at most 30 words.",
            `The book's pattern: ${def.parentWords.en}. The step is step ${slot} of three. Start the English line with "Step ${["one", "two", "three"][slot - 1]}:" and the Hebrew lines with "שלב ${["ראשון", "שני", "שלישי"][slot - 1]}:".`,
            "Return JSON with en (English), he_m (Hebrew, masculine first person) and he_f (Hebrew, feminine first person).",
            ...(origin === "practitioner" ? ["The parent is relaying a step given by the professional who works with the child: keep its meaning exactly, add nothing."] : []),
            `Parent's words: "${text.replace(/"/g, "'")}"`,
          ].join("\n"),
          schema: { type: "OBJECT", required: ["en", "he_m", "he_f"], properties: { en: { type: "STRING" }, he_m: { type: "STRING" }, he_f: { type: "STRING" } } },
        });
        line = asLine(raw);
      } catch (error) {
        logger.error("Plan phrase error", error instanceof Error ? error : new Error(String(error)), { requestId: requestIdOf(req) });
        return refuse(res, 503, "plan_phrase_unavailable", "The line could not be phrased right now");
      }
    }
    if (!line) return refuse(res, 422, "plan_phrase_refused", "Arbor could not phrase that line for a child's book", { reason: "empty" });
    const reason = screenPhrasedLine(def, slot, line, text);
    if (reason) return refuse(res, 422, "plan_phrase_refused", "Arbor could not phrase that line for a child's book", { reason });
    const step: Omit<OwnStep, "approvedAt"> = { slot, sourceText: text, text: line, aiPhrased: true, ...(origin === "practitioner" ? { origin } : {}) };
    res.json({ step, aiPhrased: true });
  });

  router.post("/children/:childId/plan-books", express.json({ limit: "32kb" }), deps.requireOwnership, (req, res) => {
    const childId = String(req.params.childId ?? "");
    if (!ID.test(childId)) return refuse(res, 400, "plan_bad_child", "Bad child id");
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!isPatternId(b.pattern)) return refuse(res, 404, "plan_unknown_pattern", "Unknown pattern");
    const def = getPattern(b.pattern);
    if (!def) return refuse(res, 404, "plan_unknown_pattern", "This pattern is not authored yet");
    const lang: BookLang = b.lang === "he" ? "he" : "en";
    const viewer = viewerOf(req, deps.config);
    const verdict = canComposePlan({ patternId: def.id, lang, flags, viewer, owners });
    if (!verdict.ok) return refuse(res, 403, "plan_unsigned", "This plan has not been reviewed for your language yet", { pattern: def.id, lang });
    const uid = viewer.uid ?? "local-sandbox";
    const t = now();
    // B-GA-11: the approval of an own line is the parent's explicit act in the
    // composer; the server keeps the stamp only when it is there.
    const ownRaw = readOwnStep(b.ownStep);
    const ownStep: OwnStep | undefined = ownRaw ? { ...ownRaw, ...(ownRaw.approvedAt ? { approvedAt: t } : {}) } : undefined;
    const composition: PlanComposition = {
      bookId: planBookId(def.id, childId),
      stepMenuIds: Array.isArray(b.stepMenuIds) && b.stepMenuIds.length === 3 ? (b.stepMenuIds.map(String) as [string, string, string]) : ["", "", ""],
      ...(ownStep ? { ownStep } : {}),
      minutes: typeof b.minutes === "number" ? b.minutes : Number.NaN,
      time: typeof b.time === "string" ? b.time : "",
      boxItemIds: Array.isArray(b.boxItemIds) ? b.boxItemIds.map(String).slice(0, 8) : [],
      durationDays: typeof b.durationDays === "number" ? b.durationDays : Number.NaN,
      approvedAt: t,
      approvedBy: uid,
    };
    const problems = validatePlanComposition(def, composition);
    if (problems.length) return refuse(res, 400, "plan_bad_composition", "The plan does not fit this pattern's menu", { problems });
    if (ownStep) {
      const reason = screenPhrasedLine(def, ownStep.slot, ownStep.text, ownStep.sourceText);
      if (reason) return refuse(res, 422, "plan_phrase_refused", "That line cannot reach a child's book", { reason });
    }
    const hits = lintPlanBook(composePlanBook(def, composition), { bannedEn: def.bannedWords.en, bannedHe: def.bannedWords.he });
    if (hits.length) return refuse(res, 422, "plan_lint", "The composed book did not pass the lint", { rules: [...new Set(hits.map((h) => h.rule))] });
    const doc: PlanBookDoc = { ...composition, id: composition.bookId, kind: "plan", pattern: def.id, lang, createdAt: t, updatedAt: t, status: "active" };
    res.status(201).json({ doc, why: verdict.why });
  });

  return router;
}
