import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_FACT_CHAR_CAP, APPROVED_FACT_ITEM_CHAR_CAP, selectApprovedFacts } from "../memory/memoryService";
import type { MemoryReviewItem } from "../types";
import { basedOnLines, FOCUS_MAX_FACTS, PROMPT_FACT_CHAR_CAP, PROMPT_FACT_ITEM_CAP, selectPromptFacts, TALK_MAX_FACTS } from "./basedOn";

const NOW = Date.parse("2026-10-12T18:00:00Z");

const item = (id: string, fact: string, daysAgo: number, status: MemoryReviewItem["status"] = "approved", retention = "3 months"): MemoryReviewItem => ({
  memoryId: id,
  childId: "c1",
  status,
  fact,
  source: "chat",
  retention,
  createdAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  latestEventId: `e-${id}`,
});

describe("selectPromptFacts matches the server selector", () => {
  it("shares the character caps, the focus cap, and the talk default", () => {
    expect(PROMPT_FACT_CHAR_CAP).toBe(APPROVED_FACT_CHAR_CAP);
    expect(PROMPT_FACT_ITEM_CAP).toBe(APPROVED_FACT_ITEM_CHAR_CAP);
    expect(FOCUS_MAX_FACTS).toBe(5);
    const env = readFileSync(path.resolve(__dirname, "../config/env.ts"), "utf8");
    expect(env).toContain("MEMORY_PROMPT_MAX_FACTS || 40");
    expect(TALK_MAX_FACTS).toBe(40);
    const route = readFileSync(path.resolve(__dirname, "../routes/api.ts"), "utf8");
    expect(route).toContain("purpose: \"todays-focus\"");
    expect(route.slice(route.indexOf("purpose: \"todays-focus\""), route.indexOf("purpose: \"todays-focus\"") + 600)).toContain("maxFacts: 5");
  });

  it("keeps input order with no query; a bedtime question ranks the bath fact; pending and expired stay out", () => {
    const items = [
      item("old", "She loves the moon story", 40),
      item("bath", "Bedtime goes better after a warm bath", 2),
      item("park", "The park slide is the favourite", 1),
      item("wait", "Still a proposal", 0, "pending"),
      item("gone", "An old note that should have expired", 200, "approved", "90 days"),
    ];
    for (const query of ["", "warm bath before bedtime"]) {
      const server = selectApprovedFacts(items as unknown as Parameters<typeof selectApprovedFacts>[0], { query, maxFacts: 5, now: NOW }).map((row) => row.memoryId + ":" + row.fact);
      const client = selectPromptFacts(items, { query, maxFacts: 5, now: NOW }).map((row) => row.memoryId + ":" + row.fact);
      expect(client).toEqual(server);
    }
    expect(selectPromptFacts(items, { query: "warm bath before bedtime", maxFacts: 5, now: NOW })[0].memoryId).toBe("bath");
    expect(selectPromptFacts(items, { maxFacts: 5, now: NOW }).map((row) => row.memoryId)).toEqual(["old", "bath", "park"]);
  });
});

describe("basedOnLines names facts only when the count matches", () => {
  const items = [item("park", "The park slide is the favourite", 1), item("bath", "Bedtime goes better after a warm bath", 2)];
  const profile = { name: "Noa", age: 4, interests: ["slides"] };

  it("names the facts and the allow-listed field names when the server count matches", () => {
    const lines = basedOnLines({ items, profile, maxFacts: FOCUS_MAX_FACTS, reportedFactCount: 2, now: NOW });
    expect(lines.facts.map((fact) => fact.memoryId)).toEqual(["park", "bath"]);
    expect(lines.facts[0].fact).toBe("The park slide is the favourite");
    expect(lines.fields).toEqual(expect.arrayContaining(["name", "age", "interests"]));
    expect(lines.fields).not.toContain("challenges");
  });

  it("a drifted count names no fact", () => {
    expect(basedOnLines({ items, profile, maxFacts: 5, reportedFactCount: 1, now: NOW }).facts).toEqual([]);
    expect(basedOnLines({ items, profile, maxFacts: 5, now: NOW }).facts).toEqual([]);
    expect(basedOnLines({ items, profile, maxFacts: 5, reportedFactCount: 0, now: NOW }).facts).toEqual([]);
  });
});
