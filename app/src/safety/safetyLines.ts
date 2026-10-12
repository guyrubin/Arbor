/**
 * v3 EXTRA-CARE — the help lines a page offers, chosen the way Safety chooses
 * them (LC-14: the family's market first, else the UI language; W2-CAREPRO r1:
 * the second call is the emergency line or the family's own talk line).
 *
 * SafetyTab keeps its own pinned wiring (helplineOrderFor, the full-width
 * primary tel button, the directory groups); the Care landing's compact
 * "Help and safety" card reads the SAME directory through this module, so
 * the two pages can never offer different numbers.
 * safety/safetyLines.test.ts holds the drift check against SafetyTab.
 */
import {
  HELPLINE_DIRECTORY,
  EMERGENCY_HELPLINE_IDS,
  dangerLineFor,
  helplineOrderFor,
  type DangerLine,
  type HelplineEntry,
  type HelplineRegion,
} from "./escalation";
import { loadAttribution } from "../lib/attribution";

/** Every region the directory carries, in its own order. */
const DIRECTORY_REGIONS: readonly HelplineRegion[] = Array.from(new Set(HELPLINE_DIRECTORY.map((h) => h.region)));

/** The attribution markets that name a helpline region directly. */
const MARKET_REGIONS = ["il", "nl", "be"];

/** The family's region hint: the attribution market when it names one,
 *  otherwise the UI language. */
export function safetyHint(uiLang: string): string {
  let market: string | null = null;
  try { market = loadAttribution()?.market ?? null; } catch { market = null; }
  return market && MARKET_REGIONS.includes(market) ? market : uiLang;
}

/** The ordered regions, the primary line and the second call — Safety's selection. */
export function safetyLinesFor(
  uiLang: string,
  regions: readonly HelplineRegion[] = DIRECTORY_REGIONS,
): { order: HelplineRegion[]; primary: HelplineEntry; danger: DangerLine | null } {
  const order = helplineOrderFor(safetyHint(uiLang)).filter((r) => regions.includes(r));
  const primary = HELPLINE_DIRECTORY.find((h) => h.region === order[0]) ?? HELPLINE_DIRECTORY[0];
  return { order, primary, danger: dangerLineFor(order, primary) };
}

/** The Care card's two calls: the emergency line and the family's talk line.
 *  When the family's region has no talk line in the directory, `findLine`
 *  says so and the card opens Safety's by-country list; no foreign number is
 *  ever offered in its place. */
export function careSafetyLines(uiLang: string): { emergency: HelplineEntry | null; talk: HelplineEntry | null; findLine: boolean } {
  const { primary, danger } = safetyLinesFor(uiLang);
  if (EMERGENCY_HELPLINE_IDS.has(primary.id)) {
    return {
      emergency: primary,
      talk: danger?.kind === "talk" ? danger.entry : null,
      findLine: danger?.kind === "find",
    };
  }
  return { emergency: danger?.kind === "emergency" ? danger.entry : null, talk: primary, findLine: false };
}

/** Reduce a free-typed phone to a dialable tel: target (digits and + only). */
export const dialablePhone = (phone: string): string => phone.replace(/[^\d+]/g, "");

/** The family's first saved contact, when it has a dialable phone — the same
 *  row Safety shows under its one tap. */
export function firstDialableContact(contacts: readonly { name?: string; phone?: string }[]): { name: string; phone: string; tel: string } | null {
  const first = contacts[0];
  const phone = (first?.phone ?? "").trim();
  const tel = dialablePhone(phone);
  if (!first || !tel) return null;
  return { name: (first.name ?? "").trim(), phone, tel };
}

/** The device-local "last reviewed" note Safety writes (swept with the child). */
export const safetyReviewedKey = (childId: string): string => `arbor.safetyReviewed.${childId}`;

export function readSafetyReviewed(childId: string): string | null {
  try { return localStorage.getItem(safetyReviewedKey(childId)); } catch { return null; }
}
