// B-GA-38 — which firebase.json rewrite answers a path, and a probe of a running Hosting origin.
//
// Hosting serves an existing file first, then the first matching rewrite. A removed hashed chunk
// under /assets/ used to fall through to the SPA shell, cached `immutable`, and the stale tab's
// dynamic import failed on its MIME type (10-11 Nov 2026). Now /assets/** misses go to arbor-api,
// which answers 404 with `Cache-Control: no-store` (src/server/start.ts). On production Hosting a
// header the service sets itself wins over firebase.json, so that 404 is never cached immutable.
// The emulator overlays firebase.json headers on proxied responses instead; --emulator reports
// that one check as INFO.
//
//   node scripts/hosting-routes.mjs --base http://127.0.0.1:5000 --emulator   # emulator over app/dist
//   node scripts/hosting-routes.mjs --base https://arborparentingapp.com
//
// Exit 1 when any check fails. hostingRoutes.test.ts checks the rule list itself in CI.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FIREBASE_JSON = fileURLToPath(new URL("../../firebase.json", import.meta.url));

/** What each path resolves to through the rewrite list when no file exists there. */
export const ROUTE_CASES = [
  ["/assets/FamilyTopicSheet-OLDHASH.js", "run:arbor-api"],
  ["/assets/today/missing.png", "run:arbor-api"],
  ["/assets/", "run:arbor-api"],
  ["/", "/index.html"],
  ["/some/deep/path", "/index.html"],
  ["/assets-old/x.js", "/index.html"],
  ["/asset/x.js", "/index.html"],
  ["/guides", "/guides/index.html"],
  ["/guides/x", "/guides/index.html"],
  ["/api/health", "run:arbor-api"],
  ["/healthz", "run:arbor-api"],
  ["/webhooks/stripe", "run:arbor-api"],
  ["/privacy", "/privacy.html"],
  ["/terms", "/terms.html"],
  ["/support", "/support.html"],
  ["/for-professionals", "/for-professionals.html"]
];

export const loadHosting = (file = FIREBASE_JSON) => JSON.parse(readFileSync(file, "utf8")).hosting;

// Only the glob forms firebase.json uses: literal paths, `/prefix/**` and `**`. Anything else
// throws, so a new pattern extends this matcher instead of being silently misread.
const globToRegExp = (glob) => {
  if (glob === "**") return /^.*$/u;
  const prefix = glob.endsWith("/**") ? glob.slice(0, -3) : glob;
  if (/[*?[\]{}()!@+]/u.test(prefix)) throw new Error(`unsupported glob in test matcher: ${glob}`);
  const escaped = prefix.replace(/[.\\^$|]/gu, "\\$&");
  return new RegExp(glob.endsWith("/**") ? `^${escaped}(?:/.*)?$` : `^${escaped}$`, "u");
};

const ruleMatches = (rule, path) => {
  if (rule.regex) throw new Error(`regex rules are not modelled here: ${rule.regex}`);
  return globToRegExp(rule.source ?? rule.glob).test(path);
};

/** The rewrite a path falls through to: its destination, run:<service>, or 404 when none matches. */
export const resolveRewrite = (hosting, path) => {
  const rule = (hosting.rewrites ?? []).find((r) => ruleMatches(r, path));
  if (!rule) return "404";
  return rule.run ? `run:${rule.run.serviceId}` : rule.destination;
};

/** Every Cache-Control value firebase.json attaches to a path, in rule order. */
export const cacheControlFor = (hosting, path) =>
  (hosting.headers ?? [])
    .filter((r) => ruleMatches(r, path))
    .flatMap((r) => r.headers.filter((h) => h.key.toLowerCase() === "cache-control").map((h) => h.value));

// ---- probe of a running origin ----------------------------------------------------------

const probe = async (base, path) => {
  const res = await fetch(new URL(path, base), { redirect: "manual" });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") ?? "", cache: res.headers.get("cache-control") ?? "", body };
};

export const probeOrigin = async (base, { emulator = false } = {}) => {
  const results = [];
  const check = (name, ok, r, info = false) =>
    results.push({ name, ok: Boolean(ok), info: info && !ok, seen: `${r.status} ${r.type} | cache-control: ${r.cache || "-"}` });

  const root = await probe(base, "/");
  check("/ serves the app shell", root.status === 200 && root.type.startsWith("text/html"), root);
  const entry = /<script[^>]+src="(?:\.\/|\/)?(assets\/[^"]+\.js)"/u.exec(root.body)?.[1];

  const missing = await probe(base, `/assets/B-GA-38-missing-${Date.now().toString(36)}.js`);
  check("missing /assets/*.js is 404", missing.status === 404, missing);
  check("missing /assets/*.js is not the HTML shell", !missing.type.startsWith("text/html") && !missing.body.includes("<html"), missing);
  check("missing /assets/*.js is not cached immutable", !/immutable/iu.test(missing.cache), missing, emulator);

  if (entry) {
    const asset = await probe(base, `/${entry}`);
    check(`existing /${entry} is 200 JavaScript`, asset.status === 200 && /javascript/u.test(asset.type), asset);
    check(`existing /${entry} is cached immutable`, /immutable/iu.test(asset.cache), asset);
  } else {
    check("the shell names its entry script", false, root);
  }

  const deep = await probe(base, "/some/deep/path");
  check("/some/deep/path serves the app shell", deep.status === 200 && deep.type.startsWith("text/html") && deep.body === root.body, deep);
  const guide = await probe(base, "/guides/x");
  check("/guides/x serves guide HTML", guide.status === 200 && guide.type.startsWith("text/html"), guide);
  const health = await probe(base, "/api/health");
  check("/api/health reaches the API (200 JSON)", health.status === 200 && /json/u.test(health.type), health);
  return results;
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const at = process.argv.indexOf("--base");
  const base = at > 0 ? process.argv[at + 1] : "";
  if (!base) {
    console.error("usage: node scripts/hosting-routes.mjs --base <origin> [--emulator]");
    process.exit(2);
  }
  const emulator = process.argv.includes("--emulator");
  const results = await probeOrigin(base, { emulator });
  for (const r of results) console.log(`${r.ok ? "PASS" : r.info ? "INFO" : "FAIL"}  ${r.name}  [${r.seen}]`);
  if (emulator && results.some((r) => r.info)) console.log("INFO: the emulator overlays firebase.json headers on proxied responses; production keeps the service's own Cache-Control.");
  process.exit(results.every((r) => r.ok || r.info) ? 0 : 1);
}
