// Stamp dist/sw.js with a unique build id so its bytes change every deploy.
// A changed service-worker file is how the browser detects an update, activates
// the new worker, and (via the controllerchange handler in main.tsx) reloads
// open tabs onto the latest build instead of serving a stale cached shell.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SW = "dist/sw.js";
if (!existsSync(SW)) {
  console.error(`[stamp-sw] ${SW} not found — did the build run? Skipping.`);
  process.exit(0);
}

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const src = readFileSync(SW, "utf8");

if (!src.includes("__BUILD_ID__")) {
  console.warn("[stamp-sw] no __BUILD_ID__ token in sw.js — already stamped or template changed.");
  process.exit(0);
}

writeFileSync(SW, src.replaceAll("__BUILD_ID__", buildId));
console.log(`[stamp-sw] sw.js cache stamped: arbor-shell-${buildId}`);
