/**
 * B-INF-04 — MODEL_PROVIDER=mock: deterministic, schema-valid fixtures for
 * every AI route, so the sandbox audit lanes (rendered sweep, the parent's-
 * week drive) render ANSWERED states while making zero outbound model calls.
 *
 * How a call is answered:
 *  1. A value is generated from the route's own response schema (the Gemini
 *     `Type` schema every route already passes) — so a route this file has
 *     never heard of still gets a schema-valid answer.
 *  2. When the schema's required keys match a known route (coach chat incl.
 *     the four-block answer, Today's focus, the weekly digest, analyze-
 *     behavior, generate-plan, generate-handoff, stories, capture extract,
 *     the output-screen classifier), a curated EN or HE fixture is laid over
 *     it. Hebrew is chosen when the prompt carries a Hebrew directive.
 *
 * Copy rules (the fixtures render on parent surfaces): calm parent register,
 * counts never verdicts, no condition names, no percentages, no child name.
 *
 * NEVER in production: config/env.ts refuses any provider but vertex when
 * ARBOR_ENV=prod (pinned in config/env.test.ts), and the mock declares the
 * "global" region, which the prod route policy does not admit either.
 */
import type {
  GenerateImageOptions,
  GenerateJsonOptions,
  GeneratedImage,
  ModelProvider,
  ModelRoute,
  RouteDecision,
  StreamTextOptions,
} from "./modelRouter.js";

export const MOCK_MODEL_ID = "mock-fixtures";

type Lang = "en" | "he";
type Json = unknown;
type SchemaNode = { type?: unknown; properties?: Record<string, SchemaNode>; items?: SchemaNode; required?: unknown; enum?: unknown };

/** The prompt asks for Hebrew output (every route's HE directive names עברית). */
export const mockLanguageOf = (prompt: string): Lang => (/עברית|in Hebrew\b/.test(prompt) ? "he" : "en");

const kind = (node: SchemaNode | undefined): string => String(node?.type ?? "").toUpperCase();

const STRING_FILL: Record<Lang, string> = {
  en: "A calm, ordinary moment to notice.",
  he: "רגע רגיל ורגוע לשים אליו לב.",
};

const booleanFor = (key: string, index: number): boolean => {
  if (key === "safe") return true;
  if (key === "correct") return index === 0;
  return false;
};

const numberFor = (key: string): number => {
  if (key === "intensity") return 2;
  if (key === "durationMinutes") return 10;
  return 1;
};

/** A schema-valid value for any Gemini `Type` schema node. Deterministic. */
export function fromSchema(node: SchemaNode | undefined, lang: Lang, key = "", index = 0): Json {
  if (node && Array.isArray(node.enum) && node.enum.length) return node.enum[0];
  switch (kind(node)) {
    case "OBJECT": {
      const out: Record<string, Json> = {};
      for (const [k, child] of Object.entries(node?.properties ?? {})) out[k] = fromSchema(child, lang, k, index);
      return out;
    }
    case "ARRAY":
      return [0, 1].map((i) => fromSchema(node?.items, lang, key, i));
    case "NUMBER":
    case "INTEGER":
      return numberFor(key);
    case "BOOLEAN":
      return booleanFor(key, index);
    default:
      return STRING_FILL[lang];
  }
}

const requiredKeys = (schema: unknown): string[] => {
  const req = (schema as SchemaNode | undefined)?.required;
  return Array.isArray(req) ? req.map(String) : [];
};

const L = <T>(en: T, he: T): Record<Lang, T> => ({ en, he });

/** Curated overlays, matched by a route's required-key signature. */
const CURATED: { id: string; signature: string[]; overlay: Record<Lang, Record<string, Json>> }[] = [
  {
    id: "coach_chat",
    signature: ["parentScript", "todayPlan", "escalateIf"],
    overlay: L(
      {
        text: "Moments like this are common at this age. Naming the feeling first and giving one clear next step usually helps the evening settle.",
        riskLevel: "Low",
        nonDiagnosticHypotheses: [{ label: "Hard to switch activities", confidence: "one possibility", rationale: "You described it at the end of play, which is a common sticking point." }],
        todayPlan: ["Give a two-minute heads-up before the switch.", "Name the feeling in one short sentence.", "Offer two choices for what comes next."],
        parentScript: "I can see it is hard to stop. You can choose: the blue cup or the green cup.",
        avoid: ["Long explanations in the middle of the moment."],
        observe: ["What was happening just before it started.", "How long it took to settle."],
        escalateIf: ["If it happens most days for several weeks or gets harder, talk with your pediatrician."],
        memoryProposals: [],
        handoffNotes: { teacher: "", professional: "" },
        sourceCardsUsed: [],
        followUps: ["What if it happens at bedtime?", "How do I give the heads-up?", "What should I write down?"],
      },
      {
        text: "רגעים כאלה נפוצים בגיל הזה. לתת שם לרגש קודם, ואז צעד ברור אחד, בדרך כלל עוזר לערב להירגע.",
        riskLevel: "Low",
        nonDiagnosticHypotheses: [{ label: "קושי לעבור בין פעילויות", confidence: "אפשרות אחת", rationale: "תיארתם את זה בסוף משחק, נקודה שבה זה קורה הרבה." }],
        todayPlan: ["לתת התראה של שתי דקות לפני המעבר.", "לתת שם לרגש במשפט קצר אחד.", "להציע שתי אפשרויות למה שבא אחר כך."],
        parentScript: "אני רואה שקשה להפסיק. אפשר לבחור: הכוס הכחולה או הכוס הירוקה.",
        avoid: ["הסברים ארוכים באמצע הרגע."],
        observe: ["מה קרה רגע לפני שזה התחיל.", "כמה זמן לקח להירגע."],
        escalateIf: ["אם זה קורה רוב הימים במשך כמה שבועות או נעשה קשה יותר, שוחחו עם רופא הילדים."],
        memoryProposals: [],
        handoffNotes: { teacher: "", professional: "" },
        sourceCardsUsed: [],
        followUps: ["ומה אם זה קורה לפני השינה?", "איך נותנים את ההתראה?", "מה כדאי לרשום?"],
      },
    ),
  },
  {
    id: "todays_focus",
    signature: ["focus", "tryToday"],
    overlay: L(
      { focus: "Transitions after play", tryToday: "Give a two-minute heads-up before the next switch.", sayThis: "Two more minutes, then we wash hands." },
      { focus: "מעברים אחרי משחק", tryToday: "לתת התראה של שתי דקות לפני המעבר הבא.", sayThis: "עוד שתי דקות, ואז שוטפים ידיים." },
    ),
  },
  {
    id: "weekly_digest",
    signature: ["title", "subject", "preheader", "summary", "highlights", "tryThisWeek"],
    overlay: L(
      {
        title: "This week",
        subject: "Your week, in a few lines",
        preheader: "What you noticed this week",
        summary: "You wrote moments down on several days this week. The evenings came up most often.",
        highlights: ["You kept a note on more than one day.", "A milestone was marked as noticed."],
        watchFor: [],
        tryThisWeek: "Before the evening switch, give a two-minute heads-up.",
      },
      {
        title: "השבוע",
        subject: "השבוע שלכם, בכמה שורות",
        preheader: "מה שמתם לב השבוע",
        summary: "רשמתם רגעים בכמה ימים השבוע. הערבים חזרו הכי הרבה.",
        highlights: ["רשמתם יותר מיום אחד.", "אבן דרך סומנה כנראתה."],
        watchFor: [],
        tryThisWeek: "לפני המעבר של הערב, לתת התראה של שתי דקות.",
      },
    ),
  },
  {
    id: "analyze_behavior",
    signature: ["frequencyCount", "triggerBreakdown", "expertInsights", "actionPlanSuggestion"],
    overlay: L(
      {
        frequencyCount: {},
        triggerBreakdown: [],
        expertInsights: [{ heading: "What the notes show", text: "Most of the moments you wrote down happened around a switch from one activity to the next." }],
        actionPlanSuggestion: "Try a two-minute heads-up before switches for one week and note what changes.",
      },
      {
        frequencyCount: {},
        triggerBreakdown: [],
        expertInsights: [{ heading: "מה עולה מהרשומות", text: "רוב הרגעים שרשמתם קרו סביב מעבר מפעילות אחת לבאה." }],
        actionPlanSuggestion: "לנסות התראה של שתי דקות לפני מעברים במשך שבוע ולרשום מה משתנה.",
      },
    ),
  },
  {
    id: "generate_plan",
    signature: ["title", "issue", "phases", "scripts", "successIndicators"],
    overlay: L(
      {
        title: "Smoother switches",
        issue: "Switching from play to the next thing",
        phases: [
          { name: "Week 1", description: "Prepare the switch.", steps: [{ text: "Give a two-minute heads-up.", completed: false }, { text: "Use the same words each time.", completed: false }] },
          { name: "Week 2", description: "Offer a choice.", steps: [{ text: "Offer two choices for what comes next.", completed: false }] },
        ],
        scripts: [{ scenario: "End of play", say: "Two more minutes, then we wash hands.", avoid: "Turning the screen off without a warning." }],
        successIndicators: ["You notice the switch went quicker on some days."],
      },
      {
        title: "מעברים רכים יותר",
        issue: "מעבר ממשחק לדבר הבא",
        phases: [
          { name: "שבוע 1", description: "להכין את המעבר.", steps: [{ text: "לתת התראה של שתי דקות.", completed: false }, { text: "להשתמש באותן מילים בכל פעם.", completed: false }] },
          { name: "שבוע 2", description: "להציע בחירה.", steps: [{ text: "להציע שתי אפשרויות למה שבא אחר כך.", completed: false }] },
        ],
        scripts: [{ scenario: "סוף משחק", say: "עוד שתי דקות, ואז שוטפים ידיים.", avoid: "לכבות את המסך בלי התראה." }],
        successIndicators: ["שמתם לב שבחלק מהימים המעבר היה מהיר יותר."],
      },
    ),
  },
  {
    id: "generate_handoff",
    signature: ["overview", "keyStrengths", "classroomChallenges", "suggestedTeacherStrategies"],
    overlay: L(
      {
        title: "A note for the classroom",
        date: "2026-10-01",
        overview: "At home we have been working on switches between activities with a short heads-up.",
        keyStrengths: ["Enjoys building and pretend play.", "Responds well to a clear next step."],
        classroomChallenges: ["Stopping a favourite activity."],
        languageSupportPlan: ["Uses both Hebrew and English at home."],
        suggestedTeacherStrategies: ["A two-minute heads-up before a switch.", "The same short phrase each time."],
        crisisEscalationTrigger: "If you have any concern about safety, contact the family the same day.",
      },
      {
        title: "פתק לצוות הגן",
        date: "2026-10-01",
        overview: "בבית אנחנו מתרגלים מעברים בין פעילויות עם התראה קצרה.",
        keyStrengths: ["אוהב/ת לבנות ומשחקי דמיון.", "מגיב/ה טוב לצעד הבא ברור."],
        classroomChallenges: ["להפסיק פעילות אהובה."],
        languageSupportPlan: ["מדבר/ת עברית ואנגלית בבית."],
        suggestedTeacherStrategies: ["התראה של שתי דקות לפני מעבר.", "אותו משפט קצר בכל פעם."],
        crisisEscalationTrigger: "אם יש חשש לבטיחות, צרו קשר עם המשפחה באותו יום.",
      },
    ),
  },
  {
    id: "story",
    signature: ["title", "pages", "illustrationPrompt", "discussionQuestions", "summary"],
    overlay: L(
      {
        title: "The Little Boat Goes Home",
        pages: ["A little boat played all day in the bay.", "When the sun went low, the boat said: two more waves, then home.", "The harbour lights were warm, and the boat rested."],
        illustrationPrompt: "A small friendly boat in a calm bay at sunset, soft storybook style",
        discussionQuestions: ["What helped the boat get ready to go home?", "What do you like to do before bed?"],
        summary: "A short story about getting ready to stop playing.",
      },
      {
        title: "הסירה הקטנה חוזרת הביתה",
        pages: ["סירה קטנה שיחקה כל היום במפרץ.", "כשהשמש ירדה, הסירה אמרה: עוד שני גלים, ואז הביתה.", "אורות הנמל היו חמים, והסירה נחה."],
        illustrationPrompt: "A small friendly boat in a calm bay at sunset, soft storybook style",
        discussionQuestions: ["מה עזר לסירה להתכונן לחזור הביתה?", "מה אתם אוהבים לעשות לפני השינה?"],
        summary: "סיפור קצר על התכוננות להפסיק לשחק.",
      },
    ),
  },
  {
    id: "extract_log",
    signature: ["behaviorType", "intensity", "durationMinutes", "context", "trigger", "response", "notes"],
    overlay: L(
      { behaviorType: "Transition refusal", intensity: 2, durationMinutes: 10, context: "Home", trigger: "end of play", response: "gave a heads-up", notes: "" },
      { behaviorType: "Transition refusal", intensity: 2, durationMinutes: 10, context: "Home", trigger: "סוף משחק", response: "נתתי התראה", notes: "" },
    ),
  },
  {
    id: "output_screen",
    signature: ["safe", "reason"],
    overlay: L({ safe: true, reason: "" }, { safe: true, reason: "" }),
  },
];

/** Which curated fixture (if any) a schema matches. Exported for the guard test. */
export const mockFixtureIdFor = (schema: unknown): string | null => {
  const req = new Set(requiredKeys(schema));
  return CURATED.find((c) => c.signature.every((k) => req.has(k)))?.id ?? null;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The deterministic answer for one structured call. */
export function mockJsonFor(options: Pick<GenerateJsonOptions, "prompt" | "schema">): Json {
  const lang = mockLanguageOf(options.prompt ?? "");
  const base = options.schema ? fromSchema(options.schema as SchemaNode, lang) : {};
  const id = mockFixtureIdFor(options.schema);
  const curated = CURATED.find((c) => c.id === id);
  if (!curated || !base || typeof base !== "object" || Array.isArray(base)) return base;
  return { ...(base as Record<string, Json>), ...clone(curated.overlay[lang]) };
}

const SPOKEN: Record<Lang, string[]> = {
  en: ["That sounds like a hard moment. ", "Try naming the feeling in one short sentence, ", "then offer two choices for what comes next."],
  he: ["זה נשמע רגע קשה. ", "נסו לתת שם לרגש במשפט קצר אחד, ", "ואז להציע שתי אפשרויות למה שבא אחר כך."],
};

/** Static art: a 1x1 PNG in the parent paper tone (no network, no generation). */
const STATIC_ART_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4/+P/fwAJ+wP9KobjigAAAABJRU5ErkJggg==";

export class MockModelProvider implements ModelProvider {
  /** Calls answered from fixtures — the audit's proof that work happened with 0 outbound calls. */
  calls = 0;

  async generateJson(options: GenerateJsonOptions): Promise<unknown> {
    this.calls += 1;
    return mockJsonFor(options);
  }

  async *generateJsonStream(options: GenerateJsonOptions): AsyncIterable<string> {
    this.calls += 1;
    const text = JSON.stringify(mockJsonFor(options));
    // Three chunks, so the screened prose relay exercises its streaming path.
    const third = Math.ceil(text.length / 3);
    for (let i = 0; i < text.length; i += third) yield text.slice(i, i + third);
  }

  async *streamText(options: StreamTextOptions): AsyncIterable<string> {
    this.calls += 1;
    for (const sentence of SPOKEN[mockLanguageOf(options.prompt ?? "")]) yield sentence;
  }

  async generateImage(_options: GenerateImageOptions): Promise<GeneratedImage> {
    this.calls += 1;
    return { data: STATIC_ART_PNG, mimeType: "image/png" };
  }

  routeDecision(route: ModelRoute): RouteDecision {
    return { route, provider: "mock", model: MOCK_MODEL_ID };
  }
}
