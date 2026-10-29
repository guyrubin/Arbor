/**
 * BD-13 — the claim audit, as a list for review.
 *
 *   npx tsx scripts/claim-audit.mts            one line per claim: key · topics · basis · EN · HE
 *   npx tsx scripts/claim-audit.mts --json     the same rows as JSON
 *
 * Reads the shipped dictionaries (lib/i18n.ts + lib/i18nElevation) through
 * lib/claimAudit.ts; the guard that keeps the list true is
 * src/lib/claimAudit.test.ts. Known-false claims print first: they need a copy
 * decision. Marketing pages and partner copy are outside these dictionaries.
 */
import process from "node:process";
import { en, he } from "../src/lib/i18n.js";
import { elevationEn, elevationHe } from "../src/lib/i18nElevation/index.js";
import { auditClaimCopy, type ClaimRow } from "../src/lib/claimAudit.js";

const rows = auditClaimCopy({ ...elevationEn, ...en }, { ...elevationHe, ...he });
const order = (r: ClaimRow) => (r.knownFalse || r.denied.length ? 0 : r.basis ? 2 : 1);
rows.sort((a, b) => order(a) - order(b) || a.key.localeCompare(b.key));

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
} else {
  const basisOf = (r: ClaimRow) =>
    r.knownFalse ? `KNOWN FALSE — ${r.knownFalse}` : r.basis ? (r.basis.kind === "fact" ? `fact: ${r.basis.note}` : r.basis.kind) : "UNREGISTERED";
  const lines = [`Arbor claim audit — ${rows.length} claim strings (EN + HE)`];
  for (const r of rows) {
    lines.push(`\n${r.key}  [${[...r.topics, ...r.denied.map((d) => `DENIED:${d}`)].join(", ")}]  ${basisOf(r)}`);
    lines.push(`  EN  ${r.en}`);
    lines.push(`  HE  ${r.he}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}
