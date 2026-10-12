import { describe, it, expect } from "vitest";
import { aggregateFunnel, campaignsOf, ratePct, FUNNEL_EVENTS, type FunnelEventDoc } from "./attributionFunnel";
import { UTM_KEYS } from "./attribution";

const ev = (event: string, props: Record<string, unknown> = {}): FunnelEventDoc => ({ event, props });

const SAMPLE: FunnelEventDoc[] = [
  ev("install", { source: "instagram", market: "il", utm_campaign: "launch_il" }),
  ev("install", { source: "instagram", market: "il", utm_campaign: "launch_il" }),
  ev("first_plan", { source: "instagram", market: "il", utm_campaign: "launch_il" }),
  ev("paid", { source: "instagram", market: "il", utm_campaign: "launch_il" }),
  ev("install", { source: "tiktok", market: "intl", utm_campaign: "evergreen" }),
  ev("first_plan", { source: "tiktok", market: "intl", utm_campaign: "evergreen" }),
  ev("activated", { source: "instagram", market: "il", utm_campaign: "launch_il" }),
  ev("app_open", { source: "instagram", market: "il" }), // non-funnel — ignored
  ev("install", {}), // missing props → "unknown" group
];

describe("aggregateFunnel", () => {
  it("counts install/activation/paid per source", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    const ig = rows.find((r) => r.key === "instagram");
    expect(ig).toEqual({ key: "instagram", install: 2, first_plan: 1, activated: 1, paid: 1 });
    const tk = rows.find((r) => r.key === "tiktok");
    expect(tk).toEqual({ key: "tiktok", install: 1, first_plan: 1, activated: 0, paid: 0 });
  });

  it("ignores non-funnel events", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    const total = rows.reduce((n, r) => n + r.install + r.first_plan + r.activated + r.paid, 0);
    // 8 funnel rows in SAMPLE (app_open excluded)
    expect(total).toBe(8);
  });

  it("buckets missing group props under 'unknown'", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    expect(rows.find((r) => r.key === "unknown")?.install).toBe(1);
  });

  it("groups by market", () => {
    const rows = aggregateFunnel(SAMPLE, "market", "__all__");
    expect(rows.find((r) => r.key === "il")).toEqual({ key: "il", install: 2, first_plan: 1, activated: 1, paid: 1 });
    expect(rows.find((r) => r.key === "intl")?.install).toBe(1);
  });

  it("filters by campaign", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "launch_il");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ key: "instagram", install: 2, first_plan: 1, activated: 1, paid: 1 });
  });

  it("sorts by install descending", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    expect(rows[0].key).toBe("instagram"); // 2 installs, top
  });
});

describe("campaignsOf", () => {
  it("returns distinct sorted campaigns present in the data", () => {
    expect(campaignsOf(SAMPLE)).toEqual(["evergreen", "launch_il"]);
  });
});

describe("ratePct", () => {
  it("computes a whole-percentage conversion", () => {
    expect(ratePct(1, 2)).toBe("50%");
    expect(ratePct(1, 3)).toBe("33%");
  });
  it("returns an em dash when the denominator is zero", () => {
    expect(ratePct(0, 0)).toBe("—");
  });
});

describe("UTM scheme constants", () => {
  it("UTM_KEYS covers the five canonical params", () => {
    expect(UTM_KEYS).toEqual(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
  });
  it("FUNNEL_EVENTS match the loop event names the dashboard reads", () => {
    // N1-03: `activated` is a real stage now — the funnel could not tell a
    // family that came BACK from one that finished setup (lib/activation.ts).
    expect(FUNNEL_EVENTS).toEqual(["install", "first_plan", "activated", "paid"]);
  });
});

/* ── B-CAREPRO-30 — the dashboard reads the cross-family cohort reader ────── */
import { cohortRowsToFunnel } from "./attributionFunnel";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { en, he } from "./i18n";
import { NO_PILL_ROW_TABS, pillRowFor, sectionForTab } from "./navigation";

describe("B-CAREPRO-30 · cohortRowsToFunnel", () => {
  it("maps /admin/cohorts acquisition rows onto funnel counts (unknown stage ignored, missing = 0)", () => {
    const rows = cohortRowsToFunnel([
      { key: "tiktok", stages: [{ stage: "install", count: 3 }, { stage: "first_plan", count: 1 }] },
      { key: "instagram", stages: [{ stage: "install", count: 9 }, { stage: "activated", count: 2 }, { stage: "paid", count: 1 }, { stage: "child_name", count: 7 }] },
    ]);
    expect(rows).toEqual([
      { key: "instagram", install: 9, first_plan: 0, activated: 2, paid: 1 },
      { key: "tiktok", install: 3, first_plan: 1, activated: 0, paid: 0 },
    ]);
    expect(cohortRowsToFunnel([])).toEqual([]);
  });
});

describe("B-CAREPRO-30 · AttributionTab reads every family, counts only, no fallbacks", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tab = readFileSync(path.join(here, "..", "components", "tabs", "AttributionTab.tsx"), "utf8");

  it("reads GET /api/admin/cohorts, never the operator's own users/{uid}/events", () => {
    expect(tab.length).toBeGreaterThan(3000);
    expect(tab).toContain("/api/admin/cohorts?groupBy=${groupBy}&since=");
    expect(tab).toContain("cohortRowsToFunnel(report.funnels?.acquisition ?? [])");
    expect(tab).not.toMatch(/users\/\$\{uid\}\/events/);
    expect(tab).not.toContain("getDocs(");
    // NEGATIVE CONTROL: the pre-change own-uid read is what the rule catches.
    expect(/users\/\$\{uid\}\/events/.test("getDocs(collection(db, `users/${uid}/events`))")).toBe(true);
  });

  it("no English || fallbacks and no rate column (counts only)", () => {
    expect(tab).not.toMatch(/\bt\([^)]*\)\s*\|\|/);
    expect(tab).not.toContain("ratePct(");
    expect(tab).not.toContain("fallback:");
    // NEGATIVE CONTROL
    expect(/\bt\([^)]*\)\s*\|\|/.test('t("attr.title") || "Attribution"')).toBe(true);
  });

  it("every attr.* key the tab asks for exists EN + HE", () => {
    const keys = new Set([...tab.matchAll(/"(attr\.[a-zA-Z.]+)"/g)].map((m) => m[1]).filter((k) => !k.endsWith(".")));
    expect(keys.size).toBeGreaterThan(15);
    for (const k of keys) {
      expect(en[k], `${k} EN`).toBeTruthy();
      expect(he[k], `${k} HE`).toMatch(/[\u0590-\u05FF]/);
    }
  });

  it("renders without the Care pill row (highlight stays Care)", () => {
    expect(NO_PILL_ROW_TABS.has("attribution")).toBe(true);
    expect(sectionForTab("attribution").id).toBe("care");
    expect(pillRowFor(sectionForTab("attribution"), "attribution")).toEqual([]);
    // POSITIVE CONTROL: Consult keeps the Care pills.
    expect(pillRowFor(sectionForTab("consult"), "consult").length).toBeGreaterThan(1);
  });
});
