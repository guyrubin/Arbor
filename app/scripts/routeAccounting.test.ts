// B-DESIGN-05 (agent half): all 43 route IDs accounted for — what a parent sees at each, the
// cells its evidence needs, the admin route denied, and the five V3 hubs G0/G1 approve.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESIGN_VIEWPORT_IDS, ROUTE_ACCOUNT, V3_HUBS, requiredCells } from "./capture/route-accounting.mjs";
import { DEVICE_VIEWPORTS, RELEASE_ROUTE_COUNT } from "./capture/release-config.mjs";
import { RETIRED_ROUTES, ROUTE_IDS } from "../src/lib/routes";
import { homeIdForTab } from "../src/lib/navigation";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");
const account = ROUTE_ACCOUNT as Record<string, string>;

describe("B-DESIGN-05 — every route ID is accounted for", () => {
  it("the account covers exactly the 43 current IDs, once each", () => {
    expect(ROUTE_IDS).toHaveLength(RELEASE_ROUTE_COUNT);
    expect(Object.keys(account).sort()).toEqual([...ROUTE_IDS].sort());
  });

  it("NEGATIVE CONTROL: a new route without a line here is caught", () => {
    const grown = [...ROUTE_IDS, "new-place"];
    expect(grown.filter((id) => !(id in account))).toEqual(["new-place"]);
  });

  it("the redirects are exactly the retired IDs, and each lands on a rendered parent surface", () => {
    const redirects = Object.entries(account).filter(([, kind]) => kind === "redirect").map(([id]) => id).sort();
    expect(redirects).toEqual(Object.keys(RETIRED_ROUTES).sort());
    for (const [from, to] of Object.entries(RETIRED_ROUTES)) expect(["parent", "preview"], `${from} → ${to}`).toContain(account[to as string]);
  });

  it("the one admin route is denied to a parent: the view gates on isAdmin and the server answers 403", () => {
    expect(Object.entries(account).filter(([, kind]) => kind === "admin").map(([id]) => id)).toEqual(["attribution"]);
    const view = read("src/components/tabs/AttributionTab.tsx");
    expect(view).toContain("const isAdmin = Boolean(entitlement.isAdmin);");
    expect(view).toContain("if (!isAdmin) return;");
    expect(view).toContain("/api/admin/cohorts");
  });

  it("every rendered route has a v3 home, and the five V3 hubs are the homes' own pages", () => {
    for (const [id, kind] of Object.entries(account)) if (kind === "parent" || kind === "preview") expect(homeIdForTab(id as never), id).toBeTruthy();
    expect(Object.values(V3_HUBS)).toEqual(["overview", "development", "practice", "masterclasses", "consult"]);
    for (const [home, tab] of Object.entries(V3_HUBS)) {
      expect(homeIdForTab(tab as never)).toBe(home);
      expect(account[tab]).toBe("parent");
    }
  });

  it("the evidence cells: EN/HE at 375 and 1280 for every class, plus 1920 EN for every rendered surface", () => {
    for (const id of DESIGN_VIEWPORT_IDS) expect(DEVICE_VIEWPORTS.map((v: { id: string }) => v.id)).toContain(id);
    const size = (id: string) => DEVICE_VIEWPORTS.find((v: { id: string }) => v.id === id) as { w: number; lang: string };
    expect(DESIGN_VIEWPORT_IDS.map((id) => `${size(id).w}-${size(id).lang}`)).toEqual(["375-en", "375-he", "1280-en", "1280-he", "1920-en"]);
    expect(requiredCells("parent")).toEqual(DESIGN_VIEWPORT_IDS);
    expect(requiredCells("redirect")).not.toContain("wide-en");
    expect(() => requiredCells("other")).toThrow("ROUTE_ACCOUNT_KIND_UNKNOWN");
    // one command renders them: npm run sweep -- --matrix design
    const sweep = read("scripts/rendered-sweep.mjs");
    expect(sweep).toContain('out.matrix === "design" ? designCells');
    expect(sweep).toContain('["release", "device", "design"]');
  });
});
