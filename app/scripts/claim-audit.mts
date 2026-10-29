/**
 * BD-13 — the claim audit, as a list for review.
 *
 *   npx tsx scripts/claim-audit.mts            one line per claim: key · topics · basis · EN · HE
 *   npx tsx scripts/claim-audit.mts --json     the same rows as JSON
 *
 * Reads the shipped dictionaries (lib/i18n.ts + lib/i18nElevation) through
 * lib/claimAudit.ts; the guard that keeps the list true is
 * src/lib/claimAudit.test.ts. Known-false claims print first: they need a copy
 * decision. Round 2: the shipped marketing pages (app/public/marketing) are
 * listed too, with any forbidden claim and any price lib/pricing.ts does not
 * hold. Partner copy outside the repo is Guy's review.
 */
import process from "node:process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../src/lib/i18n.js";
import { elevationEn, elevationHe } from "../src/lib/i18nElevation/index.js";
import { KNOWN_PRICE_DISCREPANCIES, auditClaimCopy, auditMarketingPage, marketingPrices, type ClaimRow } from "../src/lib/claimAudit.js";

const MARKETING = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "marketing");
const listPages = (dir: string, prefix = ""): string[] =>
  readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    const rel = prefix ? `${prefix}/${n}` : n;
    return statSync(full).isDirectory() ? listPages(full, rel) : /\.(html|md)$/.test(n) ? [rel] : [];
  });
const marketing = listPages(MARKETING).map((rel) => {
  const html = readFileSync(path.join(MARKETING, rel), "utf8");
  return { page: rel, findings: auditMarketingPage(html), prices: [...new Set(marketingPrices(html))], guy: KNOWN_PRICE_DISCREPANCIES[rel]?.guy ?? null };
});

const rows = auditClaimCopy({ ...elevationEn, ...en }, { ...elevationHe, ...he });
const order = (r: ClaimRow) => (r.knownFalse || r.denied.length ? 0 : r.basis ? 2 : 1);
rows.sort((a, b) => order(a) - order(b) || a.key.localeCompare(b.key));

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ copy: rows, marketing }, null, 2)}\n`);
} else {
  const basisOf = (r: ClaimRow) =>
    r.knownFalse ? `KNOWN FALSE — ${r.knownFalse}` : r.basis ? (r.basis.kind === "fact" ? `fact: ${r.basis.note}` : r.basis.kind) : "UNREGISTERED";
  const lines = [`Arbor claim audit — ${rows.length} claim strings (EN + HE)`];
  for (const r of rows) {
    lines.push(`\n${r.key}  [${[...r.topics, ...r.denied.map((d) => `DENIED:${d}`)].join(", ")}]  ${basisOf(r)}`);
    lines.push(`  EN  ${r.en}`);
    lines.push(`  HE  ${r.he}`);
  }
  lines.push(`\n\nMarketing pages — ${marketing.length} files`);
  for (const m of marketing) {
    if (!m.findings.length && !m.prices.length && !m.guy) continue;
    lines.push(`\n${m.page}  prices [${m.prices.join(", ")}]${m.findings.length ? `  FINDINGS: ${m.findings.join("; ")}` : ""}`);
    if (m.guy) lines.push(`  ${m.guy}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}
