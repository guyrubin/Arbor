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
  ev("app_open", { source: "instagram", market: "il" }), // non-funnel — ignored
  ev("install", {}), // missing props → "unknown" group
];

describe("aggregateFunnel", () => {
  it("counts install/activation/paid per source", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    const ig = rows.find((r) => r.key === "instagram");
    expect(ig).toEqual({ key: "instagram", install: 2, first_plan: 1, paid: 1 });
    const tk = rows.find((r) => r.key === "tiktok");
    expect(tk).toEqual({ key: "tiktok", install: 1, first_plan: 1, paid: 0 });
  });

  it("ignores non-funnel events", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    const total = rows.reduce((n, r) => n + r.install + r.first_plan + r.paid, 0);
    // 7 funnel rows in SAMPLE (app_open excluded)
    expect(total).toBe(7);
  });

  it("buckets missing group props under 'unknown'", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "__all__");
    expect(rows.find((r) => r.key === "unknown")?.install).toBe(1);
  });

  it("groups by market", () => {
    const rows = aggregateFunnel(SAMPLE, "market", "__all__");
    expect(rows.find((r) => r.key === "il")).toEqual({ key: "il", install: 2, first_plan: 1, paid: 1 });
    expect(rows.find((r) => r.key === "intl")?.install).toBe(1);
  });

  it("filters by campaign", () => {
    const rows = aggregateFunnel(SAMPLE, "source", "launch_il");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ key: "instagram", install: 2, first_plan: 1, paid: 1 });
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
    expect(FUNNEL_EVENTS).toEqual(["install", "first_plan", "paid"]);
  });
});
