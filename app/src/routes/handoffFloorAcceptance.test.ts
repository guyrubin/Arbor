/**
 * B-ASKJB-44 acceptance (round 8) through the three note routes: every row of
 * src/lib/__fixtures__/handoffFloorAcceptance.json as a School Brief strategy
 * (/api/generate-handoff, the parent's words = logged triggers), as the
 * teacher AND professional handoff notes of /api/chat and of /api/council
 * (the parent's words = the message). A row whose line routes the whole answer
 * to crisis help (409 / outputBlocked) is never silently changed and counts as
 * met. EN and HE.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "./api.js";
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

type Row = { id: string; label: string; note: string; parent: string; main: string; required: string };
const here = path.dirname(fileURLToPath(import.meta.url));
const ROWS: Row[] = JSON.parse(readFileSync(path.join(here, "..", "lib", "__fixtures__", "handoffFloorAcceptance.json"), "utf8")).rows;
const isHebrew = (text: string) => /[א-ת]/.test(text);
const wanted = (row: Row): string[] =>
  row.required === "keep" ? [row.note] : row.required === "drop" ? [""] : row.required === "keep|fn" ? [row.note, ""] : [row.required.slice("part:".length)];

let draft: Record<string, unknown> = {};
let notes = { teacher: "", professional: "" };
const contract = () => ({
  text: "",
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [{ label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." }],
  todayPlan: ["Name the feeling and offer two choices."],
  parentScript: "I can see this is hard. Let's take one breath together.",
  avoid: ["Long lectures in the moment."],
  observe: ["When it starts and how long it lasts."],
  escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: notes,
  sourceCardsUsed: [],
});
const stubModelProvider = {
  async *generateJsonStream() {
    const doc = JSON.stringify(contract());
    for (let i = 0; i < doc.length; i += 64) yield doc.slice(i, i + 64);
  },
  generateJson: async (options: { route?: string }) => {
    if (options?.route === "handoff_structured") return JSON.parse(JSON.stringify(draft));
    if (options?.route === "creative_low_risk") return { takeaway: "Transitions ask a lot.", suggestion: "Offer two choices." };
    return { safe: true, reason: "" };
  },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

let server: Server;
let baseUrl = "";
beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createApiRouter({
    config, modelProvider: stubModelProvider, memoryStore: new LocalMemoryStore(), shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))); });

const doneOf = (raw: string): Record<string, any> | undefined => {
  for (const block of raw.split("\n\n")) {
    if (!/^event:\s*done/m.test(block)) continue;
    const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    return JSON.parse(data);
  }
  return undefined;
};
/** The parent's words as a chat message; a row with none gets a question (never a report). */
const messageFor = (row: Row) => row.parent || (isHebrew(row.note) ? "מה אפשר לעשות יחד השבוע?" : "What can we do together this week?");

describe("B-ASKJB-44 acceptance table — through /api/generate-handoff, /api/chat and /api/council (EN + HE)", () => {
  it("every row as a School Brief strategy", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const misses: string[] = [];
    for (const row of ROWS) {
      draft = { title: "School note", date: day, overview: "Noa does best with a warning.", keyStrengths: ["Curious"], classroomChallenges: [],
        languageSupportPlan: ["Short phrases"], suggestedTeacherStrategies: ["Give a two-minute warning", row.note],
        crisisEscalationTrigger: "If refusals last much longer than usual for two weeks, mention it to the family." };
      const logs = row.parent ? row.parent.split("\n").map((line) => ({ behaviorType: "Moment", trigger: line, response: "", day })) : [];
      const res = await fetch(`${baseUrl}/api/generate-handoff`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childProfile: { name: "Noa", age: 4 }, language: isHebrew(row.note) ? "he" : "en", logs, milestones: [] }),
      });
      const json = (await res.json()) as Record<string, any>;
      if (res.status === 409 && json.escalationCategory) continue;
      const kept = (json.suggestedTeacherStrategies as string[] | undefined)?.slice(1) ?? [];
      const out = kept[0] ?? "";
      if (res.status !== 200 || kept.length > 1 || !wanted(row).includes(out)) misses.push(`${row.id} ${row.label}: required ${row.required}, got ${res.status} ${JSON.stringify(out)}`);
    }
    expect(misses, misses.join("\n")).toEqual([]);
  }, 120_000);

  for (const route of ["chat", "council"] as const) {
    it(`every row as the teacher and the professional note of /api/${route}`, async () => {
      const misses: string[] = [];
      for (const row of ROWS) {
        notes = { teacher: row.note, professional: row.note };
        const res = await fetch(`${baseUrl}/api/${route}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message: messageFor(row), childProfile: { id: "c1", name: "Noa" }, language: isHebrew(row.note) ? "he" : "en" }),
        });
        const done = doneOf(await res.text());
        if (done?.outputBlocked) continue;
        const got = done?.contract?.handoffNotes as { teacher?: string; professional?: string } | undefined;
        for (const field of ["teacher", "professional"] as const) {
          const out = got?.[field] ?? "<missing>";
          if (!wanted(row).includes(out)) misses.push(`${row.id} ${row.label} (${field}): required ${row.required}, got ${JSON.stringify(out)}`);
        }
      }
      expect(misses, misses.join("\n")).toEqual([]);
    }, 180_000);
  }
});
