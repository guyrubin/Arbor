#!/usr/bin/env node
/**
 * STORE-2 G3 (bundle level) — scan the built web bundle for hosted-checkout
 * URLs before it is wrapped into the native binaries.
 *
 * The native shells bundle the same `dist/` as the web app. The web checkout
 * flow itself is platform-gated at runtime (G1/G2 in the vitest suite), and
 * its URLs are server-issued — so NO hosted-checkout hostname should ever be
 * hardcoded in the bundle. If one appears, someone bypassed the gate with a
 * literal link, which is the Apple 3.1.1 / Play Payments auto-rejection class.
 *
 * Run after `npm run build`, before `npx cap sync` (wired into android.yml and
 * ios.yml). Exits non-zero on any hit.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const FORBIDDEN = [/pay\.rev\.cat/, /buy\.stripe\.com/, /billing\.stripe\.com/];

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(js|mjs|cjs|html|css)$/.test(name)) continue;
    if (name === "server.cjs" || name === "server.cjs.map") continue; // server bundle — never shipped in the native shell
    const text = readFileSync(p, "utf8");
    for (const re of FORBIDDEN) {
      if (re.test(text)) hits.push(`${relative(DIST, p)}: ${re.source}`);
    }
  }
};

try {
  walk(DIST);
} catch (err) {
  console.error(`native-checkout-scan: cannot read dist/ (${err.message}) — run \`npm run build\` first`);
  process.exit(2);
}

if (hits.length) {
  console.error("native-checkout-scan FAILED — hosted-checkout URL hardcoded in the client bundle:");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log("native-checkout-scan OK — no hosted-checkout URLs in the client bundle.");
