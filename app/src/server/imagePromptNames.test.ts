/**
 * B-KID-40 (KB-45) — the child's name never travels to the image model.
 * Unit tests on the scrub + a route test that captures the prompt
 * /generate-comic hands the (mock) image model.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { childNamesFrom, letteredWithoutNames, mentionsName, replaceNames } from "./imagePromptNames.js";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

describe("B-KID-40: the scrub", () => {
  it("collects usable names only", () => {
    expect(childNamesFrom("  Noa ", undefined, 7, "", "N", "Noa", "דילן")).toEqual(["Noa", "דילן"]);
  });
  it("replaces names case-insensitively, regex characters included", () => {
    expect(replaceNames("noa and NOA meet Dylan", ["Noa"], "the hero")).toBe("the hero and the hero meet Dylan");
    expect(replaceNames("A+B (x)", ["A+B"], "the hero")).toBe("the hero (x)");
    expect(mentionsName("דילן קופץ", ["דילן"])).toBe(true);
  });
  it("a lettered field that names a child is dropped; one that does not is kept", () => {
    expect(letteredWithoutNames("Noa's Great Day", ["Noa"])).toBe("");
    expect(letteredWithoutNames("I can do it!", ["Noa"])).toBe("I can do it!");
  });
});

describe("B-KID-40: /generate-comic sends no name to the image model", () => {
  const prompts: string[] = [];
  const model = {
    generateJson: async () => ({}),
    generateImage: async (req: { prompt: string }) => { prompts.push(req.prompt); return { data: "a", mimeType: "image/png" }; },
    async *streamText() {}, async *generateJsonStream() {},
  } as unknown as ModelProvider;
  let server: Server;
  let baseUrl = "";
  beforeAll(async () => {
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json());
    app.use("/api", createApiRouter({ config, modelProvider: model, memoryStore: new LocalMemoryStore(), consentStore: new LocalConsentStore(),
      shareStore: new LocalShareStore(), framework: loadFramework(), entitlementStore,
      referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
      consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config) }));
    await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  const post = (body: unknown) => fetch(`${baseUrl}/api/generate-comic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("page, cover and sidekick: neither name appears anywhere in the prompt", async () => {
    prompts.length = 0;
    const page = await post({ heroName: "Zephyrina", sidekickName: "Barnaby", theme: "Zephyrina shares blocks with Barnaby", setting: "Zephyrina's room", dialogue: "Come on, Barnaby!", sfx: ["POP!"] });
    expect(page.status).toBe(200);
    const cover = await post({ heroName: "Zephyrina", cover: true, title: "Zephyrina and the Giant", theme: "a giant adventure" });
    expect(cover.status).toBe(200);
    expect(prompts).toHaveLength(2);
    for (const p of prompts) {
      expect(p).not.toMatch(/zephyrina|barnaby/i);
      expect(p).not.toContain("Hero name");
    }
    expect(prompts[0]).toContain("the hero shares blocks with the sidekick");
    expect(prompts[0]).toContain("Include a friendly younger sidekick beside the hero");
    expect(prompts[0]).toContain("Do not draw any speech bubbles"); // the name-bearing line is dropped
    expect(prompts[1]).not.toContain("lettered big and bold"); // the name-bearing title is dropped
  });

  it("a nameless title and line are still lettered", async () => {
    prompts.length = 0;
    await post({ heroName: "Zephyrina", cover: true, title: "The Brave Day", theme: "x" });
    await post({ heroName: "Zephyrina", theme: "x", dialogue: "I can do it!" });
    expect(prompts[0]).toContain('the title "The Brave Day"');
    expect(prompts[1]).toContain('"I can do it!"');
  });

  it("B-KID-55 (KB-05): no forced family-home setting, no default SFX lettering; both only when passed", async () => {
    prompts.length = 0;
    await post({ theme: "a hill at dusk" });
    await post({ theme: "a hill at dusk", setting: "a windy beach", sfx: ["POP!"] });
    expect(prompts[0]).not.toContain("Setting:");
    expect(prompts[0]).not.toContain("family home");
    expect(prompts[0]).not.toContain("KA-POW");
    expect(prompts[0]).toContain("Do not draw any sound-effect words.");
    expect(prompts[0]).toContain("Do not draw any speech bubbles or sentences.");
    expect(prompts[1]).toContain("Setting: a windy beach.");
    expect(prompts[1]).toContain("POP!");
  });

  it("B-KID-55: journey pages send no dialogue and journey covers send no title (the DOM carries both)", () => {
    const player = readFileSync(path.resolve(__dirname, "..", "components", "stories", "HeroScenePlayer.tsx"), "utf8");
    expect(player).not.toContain("dialogue: scene.dialogue");
    const tab = readFileSync(path.resolve(__dirname, "..", "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    const cover = tab.slice(tab.indexOf("const coverPageArgs = () =>"), tab.indexOf("} : undefined;", tab.indexOf("const coverPageArgs = () =>")));
    expect(cover).toContain("cover: true as const,");
    expect(cover).not.toMatch(/^\s*title:/m);
  });

  it("the hero-journey prompt tells the model never to name anyone in imagePrompt", () => {
    const api = readFileSync(path.resolve(__dirname, "..", "routes", "api.ts"), "utf8");
    expect(api).toContain('Never use anyone\'s name in imagePrompt: call the child "the hero".');
    expect(api).not.toMatch(/Hero name: \$\{/);
  });
});
