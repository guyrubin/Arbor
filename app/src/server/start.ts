import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import type { ArborConfig } from "../config/env.js";

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
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[Arbor Server] ${config.arborEnv} listening on http://localhost:${config.port}`);
  });
};
