#!/usr/bin/env node
// Marketing claim-gate guard — public marketing surfaces only.
//
// Why this exists (2026-08-26): the clinical firewall stripped graded child-risk
// verdicts from the app (PR #66), but the public marketing pages were never swept —
// arbor-il.html and five siblings shipped "רמת דחיפות: נמוכה" / "Urgency: low"
// verdict chips, 0–12 infant framing, and a pre-OWN-1 export/erase claim.
// This guard makes that regression class impossible to re-ship silently.
//
// Canon: PAI/projects/arbor/CLAUDE.md (clinical firewall — overrides everything),
// PAI/projects/arbor/reference/ui-enforcement-and-audit.md (colour clause,
// non-vacuous-guard pattern), bd/deliverables/arbor-institutional-onepager.md
// (send blockers: OWN-1 export/erase, "to age 12" phrasing, no demo offers).
//
// Each pattern lifts ONLY by a dated decision:
//  - graded-verdict patterns: never (firewall is permanent)
//  - 0–12 / infant framing: after a dated fix of the infant-age-in-years bug
//  - export/erase claim: after OWN-1 is verified against production
//  - human-expert phrasing: after a live human expert layer actually exists

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public', 'marketing');

const RULES = [
  { name: 'graded-verdict-chip (CSS/class)', re: /risk-pill|risk-low|risk-med|risk-high/u },
  { name: 'graded-verdict (he)', re: /רמת\s*דחיפות|רמת\s*הדחיפות/u },
  { name: 'graded-verdict (en/nl/de/fr)', re: /Urgency:\s|Urgentie:\s|Dringlichkeit:\s|Urgence:\s/u },
  { name: 'infant/0-2 framing (age gate)', re: /0[–-]12|מהתינוק|birth[–-]?12|from birth/iu },
  { name: 'export/erase operational claim (OWN-1 gate)', re: /לייצא או למחוק|export or delete everything/u },
  { name: 'bare statutory-compliance claim', re: /עומד בדרישות GDPR|GDPR compliant|complies with GDPR/u },
  { name: 'human-expert implication (claim gate)', re: /human expert|live expert|מומחה אנושי|talk to an expert|הכוונה ממומחים/iu },
];

// Non-vacuous proof: verbatim pre-fix strings from the 2026-08-26 breach.
// If any rule stops matching its own historical positive, the guard is broken — fail loudly.
const NEGATIVE_CONTROLS = [
  '<div class="ans-k">רמת דחיפות <span class="risk-pill risk-low">נמוכה</span></div>',
  '<div class="k">Urgency: low</div>',
  '<div class="k">Urgentie: laag</div>',
  '<div class="k">Dringlichkeit: niedrig</div>',
  '<div class="k">Urgence: basse</div>',
  'לילדים בגילי 0–12, מהתינוקות ועד בית הספר היסודי',
  'אפשר לייצא או למחוק הכול בכל רגע. עומד בדרישות GDPR והגנת מידע על קטינים',
  'הכוונה ממומחים עם ההקשר של הילד',
];

for (const control of NEGATIVE_CONTROLS) {
  if (!RULES.some((r) => r.re.test(control))) {
    console.error(`GUARD SELF-TEST FAILED: no rule matches historical breach string:\n  ${control}`);
    process.exit(2);
  }
}

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

let failures = 0;
for (const file of htmlFiles(root)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      if (rule.re.test(line)) {
        failures++;
        console.error(`${relative(root, file)}:${i + 1}  [${rule.name}]  ${line.trim().slice(0, 140)}`);
      }
    });
  }
}

if (failures) {
  console.error(`\nmarketing-claims-guard: ${failures} violation(s). These claims are gated — see header of this script.`);
  process.exit(1);
}
console.log('marketing-claims-guard: clean (self-test passed, all marketing HTML scanned).');
