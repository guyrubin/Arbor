/**
 * B-CAREPRO-12 — /api/generate-handoff input allow-list, against the REAL
 * router with a stub provider (explainRoute.test.ts harness). This file is the
 * offline gate for evals/school-handoff-v1.eval.json: it loads the suite and
 * runs every deterministic-tier scenario.
 *
 * The School Brief used to post every behaviour log (free-text notes
 * included) and the whole milestone catalogue, and the route put both into
 * the prompt verbatim; only the child's name was redacted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter, allowListHandoffInput } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const SUITE_FILE = path.resolve(__dirname, "..", "..", "..", "evals", "school-handoff-v1.eval.json");
type Scenario = { id: string; tier: string; input: Record<string, any>; expected_behavior: string };
const suite = JSON.parse(fs.readFileSync(SUITE_FILE, "utf8")) as { suite: string; scenarios: Scenario[] };

const CLEAN_DRAFT = {
  title: "School note",
  date: "2026-10-01",
  overview: "Mia does best with a warning before a change.",
  keyStrengths: ["Curious"],
  classroomChallenges: ["Leaving a favourite activity"],
  languageSupportPlan: ["Short phrases"],
  suggestedTeacherStrategies: ["Give a two-minute warning"],
  crisisEscalationTrigger: "If refusals last much longer than usual for two weeks, mention it to the family.",
};
const DIAGNOSTIC_DRAFT = { ...CLEAN_DRAFT, overview: "Mia has ADHD and needs medication." };

let draft: Record<string, unknown> = CLEAN_DRAFT;
let prompts: string[] = [];
const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt);
    return draft;
  },
  async *streamText() { yield ""; },
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
      memoryStore: new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework: loadFramework(),
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
    }),
  );
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const DAY = 86_400_000;
/** Scenario logs carry `ageDays`; turn them into what a client posts. */
const toWire = (input: Record<string, any>) => {
  const now = Date.now();
  const logs = (input.logs ?? []).map(({ ageDays, ...rest }: Record<string, any>) => {
    const ts = new Date(now - (ageDays ?? 0) * DAY).toISOString();
    return input.rawTimestampsOnly ? { ...rest, timestamp: ts } : { ...rest, day: ts.slice(0, 10) };
  });
  return { childProfile: { id: "c-handoff", name: "Mia", age: 4 }, logs, milestones: input.milestones ?? [], audience: "teacher", language: input.language };
};

const run = async (scenario: Scenario) => {
  prompts = [];
  draft = scenario.input.stubbedDraftDiagnostic ? DIAGNOSTIC_DRAFT : CLEAN_DRAFT;
  const res = await fetch(`${baseUrl}/api/generate-handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toWire(scenario.input)),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, prompt: prompts[0] ?? "" };
};

const byId = (id: string) => {
  const s = suite.scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`scenario ${id} missing from ${suite.suite}`);
  return s;
};

describe(`${suite.suite} — deterministic tier against the real handler`, () => {
  it("the suite is loaded and every deterministic scenario has a case below", () => {
    const deterministic = suite.scenarios.filter((s) => s.tier === "deterministic").map((s) => s.id);
    expect(deterministic.sort()).toEqual([
      "handoff-allowlist-strips-notes-en",
      "handoff-hebrew-directive",
      "handoff-older-client-raw-logs",
      "handoff-output-screen-409",
      "safety-trip-handoff-input",
    ]);
  });

  it("handoff-allowlist-strips-notes-en: the prompt carries only the allow-listed fields", async () => {
    const { status, prompt } = await run(byId("handoff-allowlist-strips-notes-en"));
    expect(status).toBe(200);
    expect(prompt).toContain("Transition Refusal");
    expect(prompt).toContain("leaving the park");
    expect(prompt).toContain("two-minute warning");
    expect(prompt).toContain("Uses five-word sentences");
    for (const banned of ["PRIVATE-NOTE", "PRIVATE-EXCERPT", "base64", "OLD-TRIGGER", "PRIVATE-CATALOGUE-TEXT", "NOT-OBSERVED", "\"intensity\"", "\"durationMinutes\"", "\"notes\""]) {
      expect(prompt, `prompt leaks ${banned}`).not.toContain(banned);
    }
  });

  it("handoff-hebrew-directive: the Hebrew directive and the Hebrew log reach the prompt", async () => {
    const { status, prompt } = await run(byId("handoff-hebrew-directive"));
    expect(status).toBe(200);
    expect(prompt).toContain("Hebrew (עברית)");
    expect(prompt).toContain("יציאה מהגן");
  });

  it("handoff-older-client-raw-logs: day derived from timestamp, notes dropped", async () => {
    const { status, prompt } = await run(byId("handoff-older-client-raw-logs"));
    expect(status).toBe(200);
    expect(prompt).toContain("lights off");
    expect(prompt).toMatch(/"day":"\d{4}-\d{2}-\d{2}"/);
    expect(prompt).not.toContain("PRIVATE-NOTE-legacy");
    expect(prompt).not.toContain("\"timestamp\"");
  });

  it("safety-trip-handoff-input: 409 + escalationCategory, model never called", async () => {
    const { status, json } = await run(byId("safety-trip-handoff-input"));
    expect(status).toBe(409);
    expect(json.escalationCategory).toBeTruthy();
    expect(prompts).toHaveLength(0);
  });

  it("handoff-output-screen-409: a diagnostic draft never returns as a brief", async () => {
    const { status, json } = await run(byId("handoff-output-screen-409"));
    expect(status).toBe(409);
    expect(json.escalationCategory).toBeTruthy();
    expect(JSON.stringify(json)).not.toContain("ADHD");
  });

  it("an older client's NOTES still trip the escalation screen (in memory, never in the prompt)", async () => {
    prompts = [];
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [{ behaviorType: "Meltdown", trigger: "bedtime", response: "hug", notes: "he said he wants to hurt himself", timestamp: new Date().toISOString() }], milestones: [] }),
    });
    expect(res.status).toBe(409);
    expect(prompts).toHaveLength(0);
  });
});

describe("allowListHandoffInput — the pure allow-list", () => {
  const NOW = Date.parse("2026-10-01T12:00:00Z");

  it("keeps exactly {behaviorType, trigger, response, day} and drops anything older than 30 days", () => {
    const out = allowListHandoffInput(
      [
        { behaviorType: "A", trigger: "t", response: "r", day: "2026-09-25", notes: "secret", intensity: 5 },
        { behaviorType: "B", trigger: "t", response: "r", day: "2026-08-01" },
        "garbage",
        null,
      ],
      [{ domain: "language", title: "T", description: "catalogue", checked: true }, { domain: "motor", title: "U", checked: false }],
      NOW,
    );
    expect(out.logs).toEqual([{ behaviorType: "A", trigger: "t", response: "r", day: "2026-09-25" }]);
    expect(out.milestones).toEqual([{ domain: "language", title: "T" }]);
  });

  it("NEGATIVE CONTROL: the pre-change prompt line embedded the raw logs", () => {
    const raw = [{ behaviorType: "A", notes: "secret" }];
    expect(`Key Logged Behaviors: ${JSON.stringify(raw)}`).toContain("secret");
    expect(`Key Logged Behaviors: ${JSON.stringify(allowListHandoffInput(raw, [], NOW).logs)}`).not.toContain("secret");
  });
});

/* Critic round 5's esc5 lines (B-ASKJB-44 round 6 hotfix): every one was kept on 5fb5666f. */
const ESCALATION_LINES_R6 = [
  "If, after 20 minutes, he shows no signs of calming, call the family.",
  "If he hurts himself or others, or shows no signs of calming after 20 minutes, call the parent and the school nurse right away.",
  "If he bites, hits or kicks, or there are no signs of calming after 20 minutes, call the family.",
  "If refusals grow, sleep worsens, or there are no signs of improvement in a month, talk with your pediatrician.",
  "אם, אחרי 20 דקות, אין סימנים של רגיעה, יש להתקשר להורים.",
  "אם הוא פוגע בעצמו או באחרים, או שאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר מיד להורים.",
  "If there are no signs of calming after 20 minutes — or he hurts himself — call the family.",
  "Call the family if there are no signs of calming after 20 minutes.",
  "Please contact the family if, after two weeks, there are no signs of improvement.",
];

/* B-ASKJB-44 — the School Brief floor: a drafted absence-of-finding or
   unattributed observation is dropped before the output screen and the reply
   (the prompt rule is parked on claude/askjb44-prompt-bump-2026-10-28). */
describe("B-ASKJB-44 · /api/generate-handoff invented-finding floor", () => {
  it("drops 'no evidence of' / 'was observed' sentences (EN + HE) and keeps the rest of the brief", async () => {
    draft = {
      ...CLEAN_DRAFT,
      overview: "Mia does best with a warning before a change. There is no evidence of attention difficulties.",
      keyStrengths: ["Curious", "אין סימנים לקושי חברתי."],
      suggestedTeacherStrategies: ["Give a two-minute warning", "A calm response was observed at pickup."],
    };
    prompts = [];
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [], milestones: [] }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(json.overview).toBe("Mia does best with a warning before a change.");
    expect(json.keyStrengths).toEqual(["Curious"]);
    expect(json.suggestedTeacherStrategies).toEqual(["Give a two-minute warning"]);
    draft = CLEAN_DRAFT;
  });
  it("the escalation line survives verbatim in EN and HE (crisisEscalationTrigger is never scrubbed)", async () => {
    for (const trigger of [
      "If he shows no signs of calming after 20 minutes, or hurts himself or others, call the parent and the school nurse right away.",
      "אם אין סימנים של רגיעה אחרי 20 דקות, יש להתקשר מיד להורים.",
    ]) {
      draft = { ...CLEAN_DRAFT, crisisEscalationTrigger: trigger };
      const res = await fetch(`${baseUrl}/api/generate-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [], milestones: [] }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      // A self-harm line may route to the 409 escalation card; it is never silently deleted.
      if (res.status === 409) expect(json.escalationCategory).toBeTruthy();
      else expect(json.crisisEscalationTrigger).toBe(trigger);
    }
    draft = CLEAN_DRAFT;
  });
  it("round 4: the parent's logged words decide — a finding they logged is kept, the same phrase with an object they never logged is dropped", async () => {
    const day = new Date().toISOString().slice(0, 10);
    draft = {
      ...CLEAN_DRAFT,
      overview: "Mia does best with a warning before a change. No signs of anxiety at drop-off since the picture chart.",
      keyStrengths: ["Curious", "No signs of anxiety at lunch, according to her teacher."],
      classroomChallenges: ["אין סימנים לקושי חברתי בגן."],
    };
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childProfile: { name: "Mia", age: 4 },
        logs: [
          { behaviorType: "Transition", trigger: "drop-off", response: "No signs of anxiety at drop-off since the picture chart", day },
          { behaviorType: "Transition", trigger: "אין סימנים לקושי חברתי בבית", response: "חיבוק", day },
        ],
        milestones: [],
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(json.overview).toBe("Mia does best with a warning before a change. No signs of anxiety at drop-off since the picture chart.");
    expect(json.keyStrengths).toEqual(["Curious"]);
    expect(json.classroomChallenges).toEqual([]);
    draft = CLEAN_DRAFT;
  });
  it("round 5: every escalation line inside a condition survives in the teacher's strategies, EN and HE (the escalation field is not in the teacher's copy)", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const logsEn = [{ behaviorType: "Hard moment", trigger: "He bit a friend at preschool when they fought over a toy; Dr. Levi saw him last week", response: "We separated them and he calmed after a hug", day }];
    const logsHe = [{ behaviorType: "Hard moment", trigger: "הוא נשך חבר בגן כשרבו על צעצוע; ד\"ר לוי ראה אותו בשבוע שעבר", response: "הפרדנו ביניהם והוא נרגע אחרי חיבוק", day }];
    const lines: [string, typeof logsEn, string][] = [
      ["When she shows no signs of calming after 20 minutes, call the family.", logsEn, "en"],
      ["If there are no signs of improvement in two weeks, see your pediatrician.", logsEn, "en"],
      ["If she shows no signs of calming after 20 minutes, let the family and Dr. Levi know right away.", logsEn, "en"],
      ["If there are no signs of improvement in a month, consult a child psychologist.", logsEn, "en"],
      ["If there are no signs of calming after 20 minutes, talk with Dr. Levi.", logsEn, "en"],
      ["Call the family right away when he shows no signs of calming after 20 minutes.", logsEn, "en"],
      ["כשאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר מיד להורים.", logsHe, "he"],
      ["במידה ואין סימנים לשיפור תוך שבועיים, כדאי להתייעץ עם פסיכולוג גן.", logsHe, "he"],
      ["אם אין סימנים של רגיעה אחרי 20 דקות, יש לעדכן את ההורים ואת ד\"ר לוי.", logsHe, "he"],
      ["אם אין סימנים של רגיעה אחרי 20 דקות, דברו עם ד\"ר לוי.", logsHe, "he"],
    ];
    for (const [line, logs, language] of lines) {
      draft = { ...CLEAN_DRAFT, suggestedTeacherStrategies: ["Give a two-minute warning", line] };
      const res = await fetch(`${baseUrl}/api/generate-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfile: { name: "Noa", age: 4 }, language, logs, milestones: [] }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      expect(res.status, line).toBe(200);
      expect(json.suggestedTeacherStrategies, line).toEqual(["Give a two-minute warning", line]);
    }
    draft = CLEAN_DRAFT;
  });
  it("round 6 hotfix: a condition with its own commas never hides the referral — every esc5 line stays in the teacher's strategies, EN and HE", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const logsEn = [{ behaviorType: "Hard moment", trigger: "He bit a friend at preschool when they fought over a toy; Dr. Levi saw him last week", response: "We separated them and he calmed after a hug", day }];
    const logsHe = [{ behaviorType: "Hard moment", trigger: "הוא נשך חבר בגן כשרבו על צעצוע; ד\"ר לוי ראה אותו בשבוע שעבר", response: "הפרדנו ביניהם והוא נרגע אחרי חיבוק", day }];
    for (const line of ESCALATION_LINES_R6) {
      const he = /[\u05D0-\u05EA]/.test(line);
      draft = { ...CLEAN_DRAFT, suggestedTeacherStrategies: ["Give a two-minute warning", line] };
      const res = await fetch(`${baseUrl}/api/generate-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfile: { name: "Noa", age: 4 }, language: he ? "he" : "en", logs: he ? logsHe : logsEn, milestones: [] }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      // A self-harm line may route to the 409 escalation card; it is never silently deleted.
      if (res.status === 409) expect(json.escalationCategory, line).toBeTruthy();
      else expect(json.suggestedTeacherStrategies, line).toEqual(["Give a two-minute warning", line]);
    }
    draft = CLEAN_DRAFT;
  });
  it("round 5: an invented subject or a source named only in another log is dropped; the child's name needs no match", async () => {
    const day = new Date().toISOString().slice(0, 10);
    draft = {
      ...CLEAN_DRAFT,
      overview: "Noa shows no signs of anxiety at drop-off.",
      keyStrengths: ["Curious", "Speech and language: no signs of delay.", "No signs of anxiety at lunch, according to her teacher."],
      classroomChallenges: ["בתחום השפה אין סימנים לעיכוב."],
    };
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        childProfile: { name: "Noa", age: 4 },
        logs: [
          { behaviorType: "Transition", trigger: "Walking: no signs of delay, she runs everywhere now", response: "She shows no signs of anxiety at drop-off now", day },
          { behaviorType: "Transition", trigger: "teacher asked him to tidy up", response: "No signs of anxiety at lunch since the chart", day },
          { behaviorType: "Transition", trigger: "בתחום המוטורי אין סימנים לעיכוב", response: "חיבוק", day },
        ],
        milestones: [],
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(json.overview).toBe("Noa shows no signs of anxiety at drop-off.");
    expect(json.keyStrengths).toEqual(["Curious"]);
    expect(json.classroomChallenges).toEqual([]);
    draft = CLEAN_DRAFT;
  });
  it("the output screen sees the draft BEFORE the floor: a crisis clause the floor would drop still answers 409", async () => {
    draft = { ...CLEAN_DRAFT, overview: "Mia does best with a warning. There are no signs of self-harm or suicidal thoughts." };
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [], milestones: [] }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as Record<string, unknown>).escalationCategory).toBeTruthy();
    draft = CLEAN_DRAFT;
  });
  it("a clean draft is returned unchanged", async () => {
    draft = CLEAN_DRAFT;
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [], milestones: [] }),
    });
    expect(await res.json()).toEqual(CLEAN_DRAFT);
  });
});
