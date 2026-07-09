/* ════════════════════════════════════════════════════════════════════════════
   i18nElevation — the Elevation Wave string seam (E1/E2/E5/E8 substrate).

   Every Elevation workstream keeps its user-visible strings in its OWN module
   file in this folder (never in src/lib/i18n.ts directly). Each module exports
   two flat records, `en` and `he`, whose keys are ALL namespaced "elev.*"
   (e.g. "elev.pulse.journal.week"). Hebrew = calm Israeli-parent transcreation,
   outcome language, never AI/tech framing.

   REGISTRATION RECIPE (parallel-agent safe — distinct lines only):
   1. Create src/lib/i18nElevation/<yourModule>.ts exporting `en` + `he`.
   2. Add ONE import line below, at the ALPHABETICAL position for your module
      name (one module per line — never touch another module's line).
   3. Add ONE registry entry in MODULES, same alphabetical position.
   Merge semantics: src/lib/i18n.ts spreads these UNDER the existing
   dictionaries, so existing keys always win — which is why "elev.*"
   namespacing is mandatory (a non-namespaced key would silently lose).
   ════════════════════════════════════════════════════════════════════════════ */

// ── Module imports: ONE line per module, ALPHABETICAL by module name. ─────────
import * as agechips from "./agechips";
import * as auth from "./auth";
import * as careprofile from "./careprofile";
import * as celebrate from "./celebrate";
import * as foundation from "./foundation";
import * as gate from "./gate";
import * as growth from "./growth";
import * as journal from "./journal";
import * as personal from "./personal";
import * as sidebar from "./sidebar";
import * as spine from "./spine";
import * as today from "./today";
import * as wow from "./wow";

// ── Module registry: ONE entry per line, same ALPHABETICAL order. ─────────────
const MODULES: ReadonlyArray<{ en: Record<string, string>; he: Record<string, string> }> = [
  agechips,
  auth,
  careprofile,
  celebrate,
  foundation,
  gate,
  growth,
  journal,
  personal,
  sidebar,
  spine,
  today,
  wow,
];

/** Merged Elevation dictionaries, consumed once by src/lib/i18n.ts. */
export const elevationEn: Record<string, string> = Object.assign({}, ...MODULES.map((m) => m.en));
export const elevationHe: Record<string, string> = Object.assign({}, ...MODULES.map((m) => m.he));
