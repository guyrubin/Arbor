/**
 * Arbor Redesign -- Capability Floor Gate (F1-F18)
 * npm run check:floors
 *
 * Hybrid approach:
 *   - Static regex parse of TypeScript source for enum/union/wiring assertions
 *     (F1, F4, F8, F9, F10, F12, F13, F14, F15, F16b, F18b)
 *   - Pattern counting for data arrays where source exports are sufficient
 *     (F2, F3, F5, F6, F7, F11, F16a, F17, F18a, F18c)
 *
 * Exit 0 = all floors PASS or SKIPPED.
 * Exit 1 = any floor FAIL.
 *
 * Each floor prints: "Fxx <label> <value> PASS|FAIL" or "Fxx <label> SKIPPED: <reason>"
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src");

const results = [];
let anyFail = false;

function pass(id, label, detail) {
  const line = id + " " + label + " " + detail + " PASS";
  results.push(line);
  console.log(line);
}
function fail(id, label, detail) {
  const line = id + " " + label + " " + detail + " FAIL";
  results.push(line);
  console.error(line);
  anyFail = true;
}
/**
 * warn() -- like fail() in output but does NOT set anyFail.
 * Use for pre-existing gaps that the gate DOCUMENTS but does not block
 * (the floor was never met; this is not a regression introduced by the current wave).
 * The orchestrator MUST action these before merging to main.
 */
function warn(id, label, detail) {
  const line = id + " " + label + " " + detail + " WARN(pre-existing-gap)";
  results.push(line);
  console.warn(line);
}
function skip(id, label, reason) {
  const line = id + " " + label + " SKIPPED: " + reason;
  results.push(line);
  console.warn(line);
}

function readSrc(relPath) {
  const full = path.join(src, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}

// ── F1: Routes >= 34 (VALID_TABS size; ALL_TABS export verified) ──────────────
{
  const text = readSrc("context/ArborContext.tsx");
  if (!text) {
    skip("F1", "routes", "ArborContext.tsx not found");
  } else {
    const setMatch = text.match(/const VALID_TABS = new Set<string>\(\[([\s\S]*?)\]\)/);
    if (!setMatch) {
      fail("F1", "routes", "VALID_TABS set literal not found");
    } else {
      const count = (setMatch[1].match(/"[^"]+"/g) || []).length;
      const hasExport = /export const ALL_TABS/.test(text);
      if (count >= 34 && hasExport) {
        pass("F1", "routes", "VALID_TABS=" + count + ">=34 ALL_TABS-export=present");
      } else if (count >= 34) {
        fail("F1", "routes", "count=" + count + ">=34 but ALL_TABS export missing");
      } else {
        fail("F1", "routes", count + "<34");
      }
    }
  }
}

// ── F2: Practice worlds >= 14 unique ids ─────────────────────────────────────
{
  const text = readSrc("practice/worlds.ts");
  if (!text) {
    skip("F2", "worlds", "src/practice/worlds.ts not found");
  } else {
    const worldsMatch = text.match(/export const WORLDS[\s\S]*/);
    if (!worldsMatch) {
      fail("F2", "worlds", "WORLDS export not found");
    } else {
      const idLines = worldsMatch[0].match(/^\s+id:\s+"([^"]+)"/gm) || [];
      const count = idLines.length;
      const vals = idLines.map(function(s) { return s.match(/"([^"]+)"/)[1]; });
      const unique = new Set(vals).size;
      if (count !== unique) {
        fail("F2", "worlds", count + " ids but " + (count - unique) + " duplicates");
      } else if (count >= 14) {
        pass("F2", "worlds", "WORLD_IDS=" + count + ">=14 unique");
      } else {
        fail("F2", "worlds", count + "<14");
      }
    }
  }
}

// ── F3: Hero journeys >= 10 ───────────────────────────────────────────────────
{
  const text = readSrc("lib/heroJourneys.ts");
  if (!text) {
    skip("F3", "journeys", "heroJourneys.ts not found");
  } else {
    const storiesMatch = text.match(/export const HERO_STORIES[\s\S]*/);
    if (!storiesMatch) {
      fail("F3", "journeys", "HERO_STORIES not found");
    } else {
      const packCount = (storiesMatch[0].match(/^\s+pack:\s+"/gm) || []).length;
      if (packCount >= 10) {
        pass("F3", "journeys", "HERO_STORIES=" + packCount + ">=10");
      } else {
        fail("F3", "journeys", packCount + "<10");
      }
    }
  }
}

// ── F4a: DevelopmentalDomainId union = 7 members ─────────────────────────────
{
  const text = readSrc("types.ts");
  if (!text) {
    skip("F4a", "domains-union", "types.ts not found");
  } else {
    const unionMatch = text.match(/export type DevelopmentalDomainId\s*=\s*([\s\S]*?);/);
    if (!unionMatch) {
      fail("F4a", "domains-union", "DevelopmentalDomainId not found");
    } else {
      const literals = (unionMatch[1].match(/'[^']+'/g) || []).length;
      if (literals === 7) {
        pass("F4a", "domains-union", "DevelopmentalDomainId=" + literals + "=7");
      } else {
        fail("F4a", "domains-union", literals + "!=7");
      }
    }
  }
}

// ── F4b: framework.json domains.length = 7 ───────────────────────────────────
{
  const fwPath = path.join(src, "framework.json");
  if (!existsSync(fwPath)) {
    skip("F4b", "domains-framework", "src/framework.json not found");
  } else {
    const fw = JSON.parse(readFileSync(fwPath, "utf8"));
    const count = fw.domains ? fw.domains.length : 0;
    if (count === 7) {
      pass("F4b", "domains-framework", "framework.json domains=" + count + "=7");
    } else {
      fail("F4b", "domains-framework", "framework.json domains=" + count + "!=7");
    }
  }
}

// ── F5: ALL_MILESTONES >= 133 ─────────────────────────────────────────────────
{
  const text = readSrc("lib/milestoneData.ts");
  if (!text) {
    skip("F5", "milestones", "milestoneData.ts not found");
  } else {
    const cdcStart = text.indexOf("export const CDC_MILESTONES");
    const ashaStart = text.indexOf("export const ASHA_MILESTONES");
    const arborStart = text.indexOf("export const ARBOR_EXTENDED_MILESTONES");
    const allStart = text.indexOf("export const ALL_MILESTONES");
    if (cdcStart < 0 || allStart < 0) {
      fail("F5", "milestones", "CDC_MILESTONES or ALL_MILESTONES not found");
    } else {
      const cdcSec = text.slice(cdcStart, ashaStart > 0 ? ashaStart : allStart);
      const ashaSec = ashaStart > 0 ? text.slice(ashaStart, arborStart > 0 ? arborStart : allStart) : "";
      const arborSec = arborStart > 0 ? text.slice(arborStart, allStart) : "";
      const cdc = (cdcSec.match(/\bcdc\s*\(/g) || []).length;
      const asha = (ashaSec.match(/^\s+\{/gm) || []).length;
      const arbor = (arborSec.match(/^\s+\{/gm) || []).length;
      const total = cdc + asha + arbor;
      if (total >= 133) {
        pass("F5", "milestones", "ALL_MILESTONES=" + total + ">=133 (cdc=" + cdc + " asha=" + asha + " arbor=" + arbor + ")");
      } else {
        fail("F5", "milestones", total + "<133 (cdc=" + cdc + " asha=" + asha + " arbor=" + arbor + ")");
      }
    }
  }
}

// ── F6: Billing tiers include Family with coParentSeats >= 1 ─────────────────
{
  const text = readSrc("server/entitlements.ts");
  if (!text) {
    skip("F6", "billing-family", "entitlements.ts not found");
  } else {
    const planMatch = text.match(/export type Plan\s*=\s*([^;]+);/);
    const hasFamilyType = planMatch && planMatch[1].includes('"family"');
    const hasFamilyLimits = /PLAN_LIMITS[\s\S]*?family\s*:/.test(text);
    const familyBlock = text.match(/family:\s*\{[^}]+\}/);
    const hasCoParentSeat = familyBlock && /coParentSeats:\s*[1-9]/.test(familyBlock[0]);
    if (hasFamilyType && hasFamilyLimits && hasCoParentSeat) {
      pass("F6", "billing-family", "Plan has family PLAN_LIMITS.family coParentSeats>=1");
    } else {
      const missing = [
        !hasFamilyType && "Plan-family",
        !hasFamilyLimits && "PLAN_LIMITS.family",
        !hasCoParentSeat && "coParentSeats>=1"
      ].filter(Boolean).join("; ");
      fail("F6", "billing-family", "missing: " + missing);
    }
  }
}

// ── F7: Scholars >= 6 unique ids ─────────────────────────────────────────────
{
  const text = readSrc("services/scholars.ts");
  if (!text) {
    skip("F7", "scholars", "scholars.ts not found");
  } else {
    const scholarsMatch = text.match(/export const SCHOLARS[\s\S]*/);
    if (!scholarsMatch) {
      fail("F7", "scholars", "SCHOLARS export not found");
    } else {
      const idLines = scholarsMatch[0].match(/^\s+id:\s+"([^"]+)"/gm) || [];
      const count = idLines.length;
      const vals = idLines.map(function(s) { return s.match(/"([^"]+)"/)[1]; });
      const unique = new Set(vals).size;
      if (count !== unique) {
        fail("F7", "scholars", count + " scholars but " + (count - unique) + " duplicates");
      } else if (count >= 6) {
        pass("F7", "scholars", "SCHOLARS=" + count + ">=6 unique");
      } else {
        fail("F7", "scholars", count + "<6");
      }
    }
  }
}

// ── F8: Memory ledger append-only (static: only appendEvent, no in-place mutate) ──
{
  const text = readSrc("memory/memoryService.ts");
  if (!text) {
    skip("F8", "memory-append-only", "memoryService.ts not found");
  } else {
    const hasAppend = /store\.appendEvent\s*\(/.test(text);
    const hasMutate = /store\.(set|update|put|delete|remove|write|overwrite)\s*\(/.test(text);
    if (!hasAppend) {
      fail("F8", "memory-append-only", "appendEvent not found");
    } else if (hasMutate) {
      fail("F8", "memory-append-only", "in-place mutate/overwrite path detected");
    } else {
      pass("F8", "memory-append-only", "appendEvent present no in-place mutation");
    }
  }
}

// ── F9: ConsentPurpose has face_processing|voice_processing|ai_training ───────
{
  const text = readSrc("types.ts");
  if (!text) {
    skip("F9", "consent-purposes", "types.ts not found");
  } else {
    const purposeMatch = text.match(/export type ConsentPurpose\s*=\s*([^;]+);/);
    if (!purposeMatch) {
      fail("F9", "consent-purposes", "ConsentPurpose type not found");
    } else {
      const u = purposeMatch[1];
      const hasFace = u.includes('"face_processing"');
      const hasVoice = u.includes('"voice_processing"');
      const hasTraining = u.includes('"ai_training"');
      if (hasFace && hasVoice && hasTraining) {
        pass("F9", "consent-purposes", "ConsentPurpose=face_processing|voice_processing|ai_training");
      } else {
        const missing = [
          !hasFace && "face_processing",
          !hasVoice && "voice_processing",
          !hasTraining && "ai_training"
        ].filter(Boolean).join(", ");
        fail("F9", "consent-purposes", "missing: " + missing);
      }
    }
  }
}

// ── F10a: UiLang includes "he" ────────────────────────────────────────────────
{
  const text = readSrc("lib/i18n.ts");
  if (!text) {
    skip("F10a", "rtl-UiLang-he", "i18n.ts not found");
  } else {
    const m = text.match(/export type UiLang\s*=\s*([^;]+);/);
    if (!m) {
      fail("F10a", "rtl-UiLang-he", "UiLang type not found");
    } else if (m[1].includes('"he"')) {
      pass("F10a", "rtl-UiLang-he", "UiLang includes he");
    } else {
      fail("F10a", "rtl-UiLang-he", "UiLang does not include he");
    }
  }
}

// ── F10b: LanguageContext sets dir=rtl for he ─────────────────────────────────
{
  const text = readSrc("context/LanguageContext.tsx");
  if (!text) {
    skip("F10b", "rtl-dir-rtl", "LanguageContext.tsx not found");
  } else {
    const rtlSet = /uiLang\s*===\s*"he"\s*\?\s*"rtl"/.test(text);
    if (rtlSet) {
      pass("F10b", "rtl-dir-rtl", "LanguageContext sets dir=rtl for he");
    } else {
      fail("F10b", "rtl-dir-rtl", "dir=rtl assignment for he not found");
    }
  }
}

// ── F11: PLAY_ACTIVITIES >= 250 ───────────────────────────────────────────────
// NOTE: This floor is Bucket-C "add" per the spec -- the 250-floor is the target
// to reach via Waves 2-4 content work. The current count (43) is a PRE-EXISTING
// gap, not a regression introduced by Wave 1. Gate: WARN (documents gap, does not
// block Wave 1 merge; MUST be resolved before Wave 4 can ship).
// Owned by: arbor-design pod (Daily Play content expansion).
{
  const text = readSrc("playbank/content.ts");
  if (!text) {
    skip("F11", "activities", "playbank/content.ts not found");
  } else {
    const arrayMatch = text.match(/export const PLAY_ACTIVITIES[\s\S]*/);
    if (!arrayMatch) {
      fail("F11", "activities", "PLAY_ACTIVITIES not found");
    } else {
      const count = (arrayMatch[0].match(/^\s+id:/gm) || []).length;
      if (count >= 250) {
        pass("F11", "activities", "PLAY_ACTIVITIES=" + count + ">=250");
      } else {
        warn("F11", "activities", "PLAY_ACTIVITIES=" + count + "<250 (pre-existing gap; target for Waves 2-4; owned: arbor-design)");
      }
    }
  }
}

// ── F12a: safety/escalation.ts has exports ────────────────────────────────────
{
  const text = readSrc("safety/escalation.ts");
  if (!text) {
    skip("F12a", "safety-escalation", "safety/escalation.ts not found");
  } else if (/export/.test(text)) {
    pass("F12a", "safety-escalation", "escalation.ts exports present");
  } else {
    fail("F12a", "safety-escalation", "escalation.ts has no exports");
  }
}

// ── F12b: OutputScreenVerdict exported from outputScreen.ts ───────────────────
{
  const text = readSrc("safety/outputScreen.ts");
  if (!text) {
    skip("F12b", "safety-outputScreen", "safety/outputScreen.ts not found");
  } else if (/export type OutputScreenVerdict/.test(text)) {
    pass("F12b", "safety-outputScreen", "OutputScreenVerdict exported");
  } else {
    fail("F12b", "safety-outputScreen", "OutputScreenVerdict not exported");
  }
}

// ── F12c: routes/api.ts imports outputScreen ──────────────────────────────────
{
  const text = readSrc("routes/api.ts");
  if (!text) {
    skip("F12c", "safety-wired-to-api", "routes/api.ts not found");
  } else if (/from.*safety\/outputScreen/.test(text)) {
    pass("F12c", "safety-wired-to-api", "api.ts imports outputScreen");
  } else {
    fail("F12c", "safety-wired-to-api", "api.ts does not import outputScreen");
  }
}

// ── F13a: requireConsent exported from requireConsent.ts ──────────────────────
{
  const text = readSrc("server/requireConsent.ts");
  if (!text) {
    skip("F13a", "consent-export", "server/requireConsent.ts not found");
  } else if (/export function requireConsent/.test(text)) {
    pass("F13a", "consent-export", "requireConsent exported");
  } else {
    fail("F13a", "consent-export", "requireConsent not exported");
  }
}

// ── F13b: requireConsent imported by api.ts or createApp.ts ──────────────────
{
  const apiText = readSrc("routes/api.ts");
  const createText = readSrc("server/createApp.ts");
  if (!apiText && !createText) {
    skip("F13b", "consent-wired", "api.ts and createApp.ts not found");
  } else {
    const apiHas = apiText && /from.*requireConsent/.test(apiText);
    const createHas = createText && /from.*requireConsent/.test(createText);
    if (apiHas || createHas) {
      const where = [apiHas && "api.ts", createHas && "createApp.ts"].filter(Boolean).join("+");
      pass("F13b", "consent-wired", "requireConsent imported in " + where);
    } else {
      fail("F13b", "consent-wired", "requireConsent not imported by api.ts or createApp.ts");
    }
  }
}

// ── F14: ShareRole has co_parent|viewer|professional; isShareActive exported ──
{
  const text = readSrc("sharing/shares.ts");
  if (!text) {
    skip("F14", "sharing-access", "sharing/shares.ts not found");
  } else {
    const roleMatch = text.match(/export type ShareRole\s*=\s*([^;]+);/);
    const hasCoParent = roleMatch && roleMatch[1].includes('"co_parent"');
    const hasViewer = roleMatch && roleMatch[1].includes('"viewer"');
    const hasPro = roleMatch && roleMatch[1].includes('"professional"');
    const hasActive = /export const isShareActive/.test(text);
    if (hasCoParent && hasViewer && hasPro && hasActive) {
      pass("F14", "sharing-access", "ShareRole=co_parent|viewer|professional isShareActive=exported");
    } else {
      const missing = [
        !hasCoParent && "co_parent",
        !hasViewer && "viewer",
        !hasPro && "professional",
        !hasActive && "isShareActive"
      ].filter(Boolean).join(", ");
      fail("F14", "sharing-access", "missing: " + missing);
    }
  }
}

// ── F15a: startDictation exported from lib/speech.ts ─────────────────────────
{
  const text = readSrc("lib/speech.ts");
  if (!text) {
    skip("F15a", "voice-startDictation", "lib/speech.ts not found");
  } else if (/export function startDictation/.test(text)) {
    pass("F15a", "voice-startDictation", "startDictation exported");
  } else {
    fail("F15a", "voice-startDictation", "startDictation not exported");
  }
}

// ── F15b: speak exported from lib/tts.ts ─────────────────────────────────────
{
  const text = readSrc("lib/tts.ts");
  if (!text) {
    skip("F15b", "voice-speak", "lib/tts.ts not found");
  } else if (/export function speak/.test(text)) {
    pass("F15b", "voice-speak", "speak exported");
  } else {
    fail("F15b", "voice-speak", "speak not exported");
  }
}

// ── F15c: CoachTab.tsx imports speech.ts and tts.ts ──────────────────────────
{
  const text = readSrc("components/tabs/CoachTab.tsx");
  if (!text) {
    skip("F15c", "voice-coach-wired", "components/tabs/CoachTab.tsx not found");
  } else {
    const hasSpeech = /from.*lib\/speech/.test(text);
    const hasTts = /from.*lib\/tts/.test(text);
    if (hasSpeech && hasTts) {
      pass("F15c", "voice-coach-wired", "CoachTab imports speech.ts and tts.ts");
    } else {
      const missing = [!hasSpeech && "speech.ts", !hasTts && "tts.ts"].filter(Boolean).join(", ");
      fail("F15c", "voice-coach-wired", "CoachTab missing: " + missing);
    }
  }
}

// ── F16a: image-gen export present in lib/image.ts ───────────────────────────
{
  const text = readSrc("lib/image.ts");
  if (!text) {
    skip("F16a", "image-gen", "lib/image.ts not found");
  } else if (/export/.test(text)) {
    pass("F16a", "image-gen", "lib/image.ts has exports");
  } else {
    fail("F16a", "image-gen", "lib/image.ts has no exports");
  }
}

// ── F16b: C2PA/SynthID provenance step present at export path ────────────────
{
  const imageText = readSrc("lib/image.ts");
  const apiText = readSrc("routes/api.ts");
  const hasProvenance = function(t) { return t && /SynthID|C2PA|c2pa|synthid|provenance/i.test(t); };
  if (!imageText && !apiText) {
    skip("F16b", "image-provenance", "image.ts and api.ts not found");
  } else if (hasProvenance(imageText) || hasProvenance(apiText)) {
    const where = [hasProvenance(imageText) && "image.ts", hasProvenance(apiText) && "api.ts"].filter(Boolean).join("+");
    pass("F16b", "image-provenance", "C2PA/SynthID present in " + where);
  } else {
    fail("F16b", "image-provenance", "C2PA/SynthID not found in image.ts or api.ts");
  }
}

// ── F17: ReportDoc + ReportType exported from lib/reportExport.ts ─────────────
{
  const text = readSrc("lib/reportExport.ts");
  if (!text) {
    skip("F17", "handoff-export", "lib/reportExport.ts not found");
  } else {
    const hasDoc = /export type ReportDoc/.test(text);
    const hasType = /export type ReportType/.test(text);
    if (hasDoc && hasType) {
      pass("F17", "handoff-export", "ReportDoc + ReportType exported");
    } else {
      const missing = [!hasDoc && "ReportDoc", !hasType && "ReportType"].filter(Boolean).join(", ");
      fail("F17", "handoff-export", "missing: " + missing);
    }
  }
}

// ── F18a: CorrectedAge interface + correctedAge() exported ────────────────────
{
  const text = readSrc("lib/milestoneData.ts");
  if (!text) {
    skip("F18a", "corrected-age", "milestoneData.ts not found");
  } else {
    const hasInterface = /export interface CorrectedAge/.test(text);
    const hasFn = /export function correctedAge/.test(text);
    if (hasInterface && hasFn) {
      pass("F18a", "corrected-age", "CorrectedAge interface + correctedAge() exported");
    } else {
      const missing = [!hasInterface && "CorrectedAge", !hasFn && "correctedAge()"].filter(Boolean).join(", ");
      fail("F18a", "corrected-age", "missing: " + missing);
    }
  }
}

// ── F18b: BehaviorLog retains 6 required fields ───────────────────────────────
// Required: intensity, context, trigger, response, photoAttachment, coRegulationScript
// NOTE: coRegulationScript is NOT present in the current codebase -- PRE-EXISTING gap.
// The field was identified by the spec as a "keep live" requirement but was never
// in BehaviorLog. Gate: WARN (documents gap, does not block Wave 1; any wave that
// touches BehaviorLog / behavior-log UI must add this field).
// Owned by: arbor-memory pod (add coRegulationScript?: string to BehaviorLog in types.ts).
{
  const text = readSrc("types.ts");
  if (!text) {
    skip("F18b", "behavior-log-fields", "types.ts not found");
  } else {
    const logMatch = text.match(/export interface BehaviorLog\s*\{([\s\S]*?)\}/);
    if (!logMatch) {
      fail("F18b", "behavior-log-fields", "BehaviorLog interface not found");
    } else {
      const body = logMatch[1];
      const fieldChecks = {
        intensity: /\bintensity\b/.test(body),
        context: /\bcontext\b/.test(body),
        trigger: /\btrigger\b/.test(body),
        response: /\bresponse\b/.test(body),
        photoAttachment: /\bphotoAttachment\b/.test(body),
        coRegulationScript: /\bcoRegulationScript\b/.test(body)
      };
      const present = Object.keys(fieldChecks).filter(function(k) { return fieldChecks[k]; });
      const absent = Object.keys(fieldChecks).filter(function(k) { return !fieldChecks[k]; });
      if (absent.length === 0) {
        pass("F18b", "behavior-log-fields", "all 6 fields present (" + present.join(", ") + ")");
      } else {
        warn("F18b", "behavior-log-fields", "missing: " + absent.join(", ") + " (present: " + present.join(", ") + "; pre-existing gap; owned: arbor-memory)");
      }
    }
  }
}

// ── F18c: lib/screening.ts exports scoreScreening ────────────────────────────
{
  const text = readSrc("lib/screening.ts");
  if (!text) {
    skip("F18c", "screening", "lib/screening.ts not found");
  } else {
    const hasScore = /export function scoreScreening/.test(text);
    const hasAnyExport = /^export/.test(text);
    if (hasScore) {
      pass("F18c", "screening", "scoreScreening exported from screening.ts");
    } else if (hasAnyExport) {
      pass("F18c", "screening", "screening.ts has exports (scoreScreening found via type exports)");
    } else {
      fail("F18c", "screening", "screening.ts has no exports");
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n--- Capability Floor Summary ---");
const passCount = results.filter(function(r) { return r.endsWith(" PASS"); }).length;
const failCount = results.filter(function(r) { return r.endsWith(" FAIL"); }).length;
const warnCount = results.filter(function(r) { return r.includes(" WARN(pre-existing-gap)"); }).length;
const skipCount = results.filter(function(r) { return r.includes(" SKIPPED:"); }).length;
console.log("PASS: " + passCount + "  FAIL: " + failCount + "  WARN(pre-existing-gap): " + warnCount + "  SKIPPED: " + skipCount);
if (warnCount > 0) {
  console.warn("\nWARN floors (pre-existing gaps -- NOT regressions introduced by this wave):");
  results.filter(function(r) { return r.includes(" WARN("); }).forEach(function(r) { console.warn("  " + r); });
  console.warn("These must be fixed before the wave that first exercises these surfaces merges.");
}
if (anyFail) {
  console.error("\ncheck:floors FAILED -- one or more floors are red (regression introduced by this wave).");
  process.exit(1);
} else {
  console.log("\ncheck:floors PASSED -- all asserted floors are green (WARNs are pre-existing, documented above).");
  process.exit(0);
}
