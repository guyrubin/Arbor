// Stamp each build so the browser discovers an update. Activation waits for
// existing clients to close; active games and drafts must never be reloaded.
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
