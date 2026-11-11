import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import type { ArborConfig } from "../config/env.js";
import { loadKnowledgeCardsWithMetadata } from "../knowledge/wiki.js";

export function mountProductionStatic(app: express.Express, distPath: string) {
  // Existing per-guide previews keep their metadata. Unknown or withdrawn
  // routes need the guide shell's root base so nested URLs load their assets.
  app.use(express.static(distPath));
  // B-GA-38: a hashed file this release does not have is a 404, never the app shell
  // (a stale tab's dynamic import then fails cleanly and staleBuild reloads). Hosting
  // forwards its /assets/** misses here; this response's own no-store wins over
  // firebase.json's immutable rule for /assets/**, so the 404 is never cached.
  app.use("/assets", (_req, res) => {
    res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Not found");
  });
  app.get("*", (req, res) => {
    const guidePath = req.path === "/guides" || req.path.startsWith("/guides/");
    res.sendFile(path.join(distPath, guidePath ? "guides/index.html" : "index.html"));
  });
}

export const startHttpServer = async (app: express.Express, config: ArborConfig) => {
  const serverEntry = process.argv[1] || "";
  const isBundledServer = /(^|[\\/])dist[\\/]server\.cjs$/.test(serverEntry);

  if (config.nodeEnv !== "production" && !isBundledServer) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    mountProductionStatic(app, distPath);
  }

  const knowledge = await loadKnowledgeCardsWithMetadata();
  const log = config.arborEnv === "prod" && knowledge.cards.length === 0 ? console.warn : console.log;
  log(`[Arbor Server] Loaded ${knowledge.cards.length} knowledge cards from ${knowledge.loadedFrom || "no resolved knowledge path"}.`);

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[Arbor Server] ${config.arborEnv} listening on http://localhost:${config.port}`);
  });
};
