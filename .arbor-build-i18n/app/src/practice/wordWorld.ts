/**
 * LANG-15 — Word World: Parent Language Coaching track.
 *
 * Three parent-mediated early-language strategy modules:
 *   1. Serve and Return   — following the child's conversational lead
 *   2. Narrated Play      — parent narrating shared everyday moments
 *   3. Shared Reading     — back-and-forth interaction around a book
 *
 * Framing: "developmentally informed, grounded in CDC/AAP/ASHA/WHO"
 * NOT: "clinically validated", "SLP-designed", "improves language", any
 * effect-size claim, or any branded-program name (Hanen / OWL / etc.).
 *
 * PROMPT BANK: 100% static, curated strings — zero model authorship.
 * By-construction satisfaction of screenHookRequired: no AI-authored string
 * reaches a parent surface; all text is code-defined literal strings that
 * have been reviewed against the CI-23/CI-25/CI-30 clinical gate.
 *
 * BUILD-TIME LINT: The test in wordWorld.test.ts asserts no banned token
 * appears in any exported string (prompts, labels, descriptions, confirmations).
 * If you add a prompt, run `npm test` to verify it clears the gate.
 *
 * COPPA NOTE: lang-strategy PracticeEvents encode the PARENT's logged moment,
 * never a child-language-output metric. meta encodes module id + age band only.
 * The event is a parent-attributed descriptive action log, not an assessment.
 * arbor-safety COPPA review gate applies before prod (CI-25 §7).
 */

/** Age bands aligned with CDC LTSAE 2022 (Zubler et al., Pediatrics 2022). */
export type LangAgeBand = "0-12m" | "12-36m" | "3-5y";

/** One of the three parent-mediated strategy modules. */
export type LangModuleId = "serve-and-return" | "narrated-play" | "shared-reading";

/** Context chip labels shown on the Today's Moment card. */
export type LangContext = "at bath time" | "reading together" | "on a walk" | "at meals" | "during play";

export interface LangModule {
  id: LangModuleId;
  name: string;
  /** One-line mechanism description — states the mechanism, never an effect size. */
  mechanism: string;
  /** Icon name from lucide-react (string so the UI can import dynamically). */
  icon: string;
}

export interface LangPrompt {
  moduleId: LangModuleId;
  ageBand: LangAgeBand;
  context: LangContext;
  /** Concrete, actionable parent instruction — no banned strings, no effect claims. */
  text: string;
}

/* ─── Module definitions ─────────────────────────────────────────────────── */

export const LANG_MODULES: LangModule[] = [
  {
    id: "serve-and-return",
    name: "Serve and Return",
    mechanism: "daily back-and-forth and following your child's lead is how young children build communication — these activities give you structured moments to do that",
    icon: "MessageCircle",
  },
  {
    id: "narrated-play",
    name: "Narrated Play",
    mechanism: "narrating what you and your child are doing together gives them repeated, low-pressure exposure to words in real-life context",
    icon: "Mic",
  },
  {
    id: "shared-reading",
    name: "Shared Reading",
    mechanism: "back-and-forth interaction around a book — pointing, asking, pausing — gives children a structured conversational moment with a parent",
    icon: "BookOpen",
  },
];

/* ─── Prompt bank — 100% static, curated, clinically-gate-reviewed ────────
   Criteria: concrete parent action, no effect claim, no banned string,
   no branded program, no child-language-output metric.
   Grounded in: CDC/AAP/ASHA guidance on serve-and-return and shared reading.
   ────────────────────────────────────────────────────────────────────────── */

export const LANG_PROMPTS: LangPrompt[] = [
  // ── Serve and Return — 0-12m ────────────────────────────────────────────
  {
    moduleId: "serve-and-return",
    ageBand: "0-12m",
    context: "during play",
    text: "Wait three seconds after your child makes a sound — give them space to take another turn.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "0-12m",
    context: "at bath time",
    text: "When your baby looks at something, look at it too and name it gently. Follow their gaze rather than redirecting it.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "0-12m",
    context: "at meals",
    text: "When your baby babbles or gestures, pause and respond with a warm sound or word — then wait again to see if they take another turn.",
  },
  // ── Serve and Return — 12-36m ───────────────────────────────────────────
  {
    moduleId: "serve-and-return",
    ageBand: "12-36m",
    context: "during play",
    text: "Let your child lead the play. Follow what they do rather than directing. Stay beside them for two minutes without suggesting what to do next.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "12-36m",
    context: "on a walk",
    text: "When your child points at something, name it and add one word. If they point at a dog, you can say 'dog — big dog' and wait.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "12-36m",
    context: "at meals",
    text: "If your child hands you something or shows you an object, receive it with interest and a word. Take the conversational turn they are offering.",
  },
  // ── Serve and Return — 3-5y ─────────────────────────────────────────────
  {
    moduleId: "serve-and-return",
    ageBand: "3-5y",
    context: "during play",
    text: "When your child tells you something, ask one follow-up question about what they said — not a topic change. Stay in their moment for a few more turns.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "3-5y",
    context: "at meals",
    text: "Comment on what your child mentions rather than redirecting to your question. Respond to their topic before you introduce a new one.",
  },
  {
    moduleId: "serve-and-return",
    ageBand: "3-5y",
    context: "on a walk",
    text: "When your child notices something, pause with them. Say what you notice too, and ask: 'What do you think about that?' Then wait for their answer.",
  },

  // ── Narrated Play — 0-12m ───────────────────────────────────────────────
  {
    moduleId: "narrated-play",
    ageBand: "0-12m",
    context: "at bath time",
    text: "Narrate what you are doing as you bathe your baby: 'Now I am washing your arm. Warm water. Soft cloth.' Keep your voice calm and natural.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "0-12m",
    context: "during play",
    text: "Describe what your baby is touching or looking at: 'You found the red block. It is smooth.' No questions needed — just a running, gentle commentary.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "0-12m",
    context: "at meals",
    text: "Name each food as you offer it. Describe what you are doing: 'Here comes the spoon. That is banana — sweet and soft.'",
  },
  // ── Narrated Play — 12-36m ──────────────────────────────────────────────
  {
    moduleId: "narrated-play",
    ageBand: "12-36m",
    context: "during play",
    text: "Narrate both your actions and your child's: 'You are stacking the blocks. I am going to put the big one at the bottom.' Keep it simple and specific.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "12-36m",
    context: "on a walk",
    text: "Name what you pass: 'We see a bus. It is yellow and big. The bus is going fast.' Two or three words per thing is enough.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "12-36m",
    context: "at bath time",
    text: "Describe actions step by step: 'First the shampoo. Now I am rinsing. The water is warm. All done with your hair.' Simple sequences anchor routine words.",
  },
  // ── Narrated Play — 3-5y ────────────────────────────────────────────────
  {
    moduleId: "narrated-play",
    ageBand: "3-5y",
    context: "during play",
    text: "Narrate your own thinking out loud while playing: 'I wonder what would happen if we put the big block on top. Let me try.' Model curiosity and reasoning.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "3-5y",
    context: "at meals",
    text: "Describe what you are doing as you prepare or eat: textures, colors, steps. Narrating ordinary things is a low-friction way to widen the words around your child.",
  },
  {
    moduleId: "narrated-play",
    ageBand: "3-5y",
    context: "on a walk",
    text: "Notice and name things aloud as you walk: weather, objects, what people are doing. Invite your child to add their own words to your commentary.",
  },

  // ── Shared Reading — 0-12m ──────────────────────────────────────────────
  {
    moduleId: "shared-reading",
    ageBand: "0-12m",
    context: "reading together",
    text: "Point to the pictures and name them simply. Follow your baby's gaze — read what they are looking at rather than following the page order.",
  },
  {
    moduleId: "shared-reading",
    ageBand: "0-12m",
    context: "during play",
    text: "Use a board book as a prop during floor time. Name pictures as your baby touches them. The interaction matters more than finishing the book.",
  },
  // ── Shared Reading — 12-36m ─────────────────────────────────────────────
  {
    moduleId: "shared-reading",
    ageBand: "12-36m",
    context: "reading together",
    text: "Point to something on the page, ask 'What is that?' and wait five seconds. If no answer comes, name it gently and point again.",
  },
  {
    moduleId: "shared-reading",
    ageBand: "12-36m",
    context: "reading together",
    text: "When a character does something, ask 'What is she doing?' and wait. Relating pictures to actions gives your child a moment to connect words and events.",
  },
  {
    moduleId: "shared-reading",
    ageBand: "12-36m",
    context: "during play",
    text: "Let your child choose the page or object they want to look at. Reading what interests them gives the back-and-forth more energy than following the page order.",
  },
  // ── Shared Reading — 3-5y ───────────────────────────────────────────────
  {
    moduleId: "shared-reading",
    ageBand: "3-5y",
    context: "reading together",
    text: "Stop at a picture and ask: 'Why do you think they did that?' Wait for an answer before continuing. Open questions give your child a longer conversational turn.",
  },
  {
    moduleId: "shared-reading",
    ageBand: "3-5y",
    context: "reading together",
    text: "After a page, relate the story to something real: 'That happened to us at the park.' Making the story personal gives words a lived context.",
  },
  {
    moduleId: "shared-reading",
    ageBand: "3-5y",
    context: "during play",
    text: "Ask your child to tell you what they think will happen next, before you turn the page. Then turn it together and find out.",
  },
];

/* ─── Age-band derivation ────────────────────────────────────────────────── */

/**
 * Derive the age band from a child's age in years.
 * Stays within the 0–5 scope of the CDC LTSAE 2022 anchor.
 */
export function ageBandForAge(ageYears: number): LangAgeBand {
  if (ageYears < 1) return "0-12m";
  if (ageYears < 3) return "12-36m";
  return "3-5y";
}

/** Return all prompts for a given module and age band. */
export function promptsForBand(moduleId: LangModuleId, band: LangAgeBand): LangPrompt[] {
  return LANG_PROMPTS.filter((p) => p.moduleId === moduleId && p.ageBand === band);
}

/* ─── Allowed copy literals (CI gate §1 — build-test verified) ───────────── */

/** The CI-25 approved referral-rail string, verbatim. Never auto-fired. */
export const REFERRAL_RAIL_TEXT =
  "Something feels worth discussing? It is always worth raising with your pediatrician or an SLP.";

/** The CI-25 approved share-sheet pre-fill text, verbatim. */
export const REFERRAL_SHARE_TEXT =
  "I would like to discuss my child's language development at our next visit.";

/** Inline confirmation shown after 'We tried this'. Parent-register, no confetti. */
export const LOG_CONFIRMATION = "Logged. Great moment.";

/** Monitoring nudge text for OverviewTab / DevelopmentTab. */
export const MONITORING_NUDGE_TEXT = "Try some language moments in Word World";

/** Source framing — never "clinically validated". */
export const SOURCE_FRAMING = "developmentally informed, grounded in CDC/AAP/ASHA/WHO";

/** The "We tried this" button label. */
export const WE_TRIED_LABEL = "We tried this";

/** This Week panel section title. */
export const THIS_WEEK_LABEL = "This Week";
