/**
 * B-SHELL-20 (a) — the string literals a leaf's `data-primary-move` stamps can
 * render. A stamp is either `data-primary-move="x"` or an expression
 * `data-primary-move={cond ? "a" : "b"}` (multi-route leaves: ConsultTab
 * consult/handoff, TrustedSharing sharing/care-team, TimelineTab
 * journal/timeline); every quoted literal inside the expression is a move the
 * leaf can declare. framework-check requires the route's contract move to be in
 * this set, so a stamp that differs from its contract fails the build.
 *
 * Pure (string in, Set out) so surfaceContract.render.test.ts can run the
 * negative test against a synthetic leaf.
 */
/** The expression minus its comparison operands (`activeTab === "care-team"`
 *  names the ROUTE, not a move) — only the values a stamp can render remain. */
const operands = (expr) =>
  expr.replace(/[!=]==?\s*(["'])[^"'\n]*\1/g, "").replace(/(["'])[^"'\n]*\1\s*[!=]==?/g, "");

export function primaryMoveLiterals(source) {
  const out = new Set();
  const re = /\bdata-primary-move=(?!-)/g;
  let m;
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length;
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const end = source.indexOf(ch, i + 1);
      if (end > i) out.add(source.slice(i + 1, end));
      continue;
    }
    if (ch !== "{") continue;
    // balanced braces → the attribute expression; collect its string literals
    let depth = 0;
    let j = i;
    for (; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}" && --depth === 0) break;
    }
    const expr = source.slice(i + 1, j);
    for (const lit of operands(expr).matchAll(/"([^"\n]+)"|'([^'\n]+)'/g)) out.add(lit[1] ?? lit[2]);
  }
  // Spread-object form: `const stamp = { "data-primary-move": cond ? "a" : "b" }`
  // (ConsultTab, TimelineTab, PlansTab, SchoolBrief) — the property's value up
  // to the next `,` or `}` at depth 0.
  const prop = /["']data-primary-move["']\s*:\s*/g;
  while ((m = prop.exec(source))) {
    let j = m.index + m[0].length;
    let depth = 0;
    for (; j < source.length; j++) {
      const c = source[j];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
      else if (c === "," && depth === 0) break;
    }
    const expr = source.slice(m.index + m[0].length, j);
    for (const lit of operands(expr).matchAll(/"([^"\n]+)"|'([^'\n]+)'/g)) out.add(lit[1] ?? lit[2]);
  }
  return out;
}

/** The keys of RETIRED_ROUTES in lib/routes.ts — a retired id redirects and
 *  never renders its leaf, so its contract move is not stamped there. */
export function retiredRouteIds(routesSource) {
  const start = routesSource.indexOf("export const RETIRED_ROUTES");
  if (start < 0) return new Set();
  const body = routesSource.slice(routesSource.indexOf("{", start) + 1, routesSource.indexOf("};", start));
  const out = new Set();
  for (const m of body.replace(/\/\/.*$/gm, "").matchAll(/^\s*"?([a-zA-Z-]+)"?\s*:/gm)) out.add(m[1]);
  return out;
}

/** route → primaryMove, parsed from the contract source the app itself reads. */
export function contractMoves(contractSource) {
  const out = new Map();
  for (const m of contractSource.matchAll(/route: "([a-zA-Z-]+)",[\s\S]{0,400}?primaryMove: "([a-z0-9-]+)"/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}
