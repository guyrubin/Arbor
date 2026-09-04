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
import * as accountSettings from "./accountSettings";
import * as actionbar from "./actionbar";
import * as agefilter from "./agefilter";
import * as aierrors from "./aierrors";
import * as aiHonesty from "./aiHonesty";
import * as auth from "./auth";
import * as carehonesty from "./careHonesty";
import * as careprofile from "./careprofile";
import * as celebrate from "./celebrate";
import * as childmemory from "./childmemory";
import * as childsignals from "./childsignals";
import * as closeloop from "./closeloop";
import * as coachcontract from "./coachcontract";
import * as continueModule from "./continue";
import * as evening from "./evening";
import * as growthCare from "./growthCare";
import * as foundation from "./foundation";
import * as fullpicture from "./fullpicture";
import * as gate from "./gate";
import * as growth from "./growth";
import * as growthTruth from "./growthTruth";
import * as journal from "./journal";
import * as kidRegister from "./kidRegister";
import * as learnCare from "./learnCare";
import * as lifecycle from "./lifecycle";
import * as memorydisclosure from "./memorydisclosure";
import * as personal from "./personal";
import * as planclarity from "./planclarity";
import * as promise from "./promise";
import * as recap from "./recap";
import * as returnhooks from "./returnhooks";
import * as safety from "./safety";
import * as screeningcalm from "./screeningcalm";
import * as searchnav from "./searchnav";
import * as sidebar from "./sidebar";
import * as sincevisit from "./sincevisit";
import * as spine from "./spine";
import * as states from "./states";
import * as storeShell from "./storeShell";
import * as syncstatus from "./syncstatus";
import * as today from "./today";
import * as trustcenter from "./trustcenter";
import * as waveE from "./waveE";
import * as waveR from "./waveR";
import * as wow from "./wow";

// ── Module registry: ONE entry per line, same ALPHABETICAL order. ─────────────
const MODULES: ReadonlyArray<{ en: Record<string, string>; he: Record<string, string> }> = [
  accountSettings,
  actionbar,
  agefilter,
  aierrors,
  aiHonesty,
  auth,
  carehonesty,
  careprofile,
  celebrate,
  childmemory,
  childsignals,
  closeloop,
  coachcontract,
  continueModule,
  evening,
  growthCare,
  foundation,
  fullpicture,
  gate,
  growth,
  growthTruth,
  journal,
  kidRegister,
  learnCare,
  lifecycle,
  memorydisclosure,
  personal,
  planclarity,
  promise,
  recap,
  returnhooks,
  safety,
  screeningcalm,
  searchnav,
  sidebar,
  sincevisit,
  spine,
  states,
  storeShell,
  syncstatus,
  today,
  trustcenter,
  waveE,
  waveR,
  wow,
];

/** Merged Elevation dictionaries, consumed once by src/lib/i18n.ts. */
export const elevationEn: Record<string, string> = Object.assign({}, ...MODULES.map((m) => m.en));
export const elevationHe: Record<string, string> = Object.assign({}, ...MODULES.map((m) => m.he));
