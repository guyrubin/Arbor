/* Consult packet — the warm handoff.
 *
 * Assembles a structured, parent-readable summary of the child's longitudinal
 * record so a professional opens the conversation already in context (vs the
 * cold start every competitor begins from). Pure + deterministic: the parent
 * chooses what to include (redaction, Safety L3), and nothing leaves the device
 * until they explicitly export. Non-diagnostic by construction — facts and
 * parent observations only, never a label or assessment.
 */

import { ClinicalLanguageError, findClinicalDiagnosisTerm } from "../lib/clinicalScan";
import { translate, type UiLang } from "../lib/i18n";
import { DOMAIN_LABEL } from "../lib/screening";
import { bandForAgeMonths, milestoneAgeWindow } from "../lib/milestoneData";
import { ageLabel, ageLabelForMonths, ageMonthsFromProfile } from "../lib/childAge";
import { behaviorTypeLabel } from "../content/behaviorTaxonomy";

export interface PacketInputProfile {
  name: string;
  age: number;
  /** RUN-01: months-precise age when known (lib/childAge). Falls back to
   *  `age * 12` — drives the age-windowed milestone denominator. */
  ageMonths?: number;
  languages: string[];
  schoolContext?: string;
  strengths?: string[];
  challenges?: string[];
  /** B-CAREPRO-29: the parent's chosen goals (CI-28 tiles). The packet's
   *  "Current focus" line reads them first, then `challenges`. */
  activeGoals?: { goalId: string; label: string }[];
}
export interface PacketInputLog {
  behaviorType: string;
  intensity: number;
  timestamp: string | number;
  trigger?: string;
  response?: string;
  resolved?: boolean;
}
export interface PacketInputMilestone {
  domain: string;
  title: string;
  checked: boolean;
  /** RUN-01: the checklist age anchor in months (CDC band). Absent on
   *  legacy/custom items — those always count toward the denominator. */
  ageMonths?: number;
  /** UND-4 (AR-CAP-08): the parent's actual response — preserved end-to-end.
   *  Absent on legacy items; derived from `checked` in that case. */
  status?: "yes" | "not_sure" | "not_yet";
  /** When the parent recorded the observation (ISO). */
  observedAt?: string;
}
export interface PacketInputPlan {
  title: string;
  issue?: string;
  /** When the plan was created (ISO or ms) — feeds the CARE-7 delta counts. */
  createdAt?: string | number;
}
export interface PacketInputMemory { fact: string; status: string }

/** LC-20 — a phrase the parent logged in Language Lab (the registered `langObs`
 *  sink). Feeds the SLP preset's own section; no other audience receives it. */
export interface PacketInputLangObs {
  phrase: string;
  language?: string;
  /** ISO date the parent recorded it. */
  at?: string | number;
}

/** LC-20 — a parent-logged physical measurement (the `growthEntries` sink).
 *  Feeds the pediatrician preset's own section. Raw numbers as the parent
 *  entered them — never a percentile, centile band or growth verdict. */
export interface PacketInputGrowthEntry {
  date: string;
  heightCm?: number;
  weightKg?: number;
}

/** B-CAREPRO-32 — a value interpolated into a keyed item line. Plain values
 *  are the family's own words or numbers; the object forms are resolved per
 *  language at serialize time:
 *   · `{ key, vars }`       — a nested dictionary string (domain, plural, label);
 *   · `{ list, join }`      — a list joined with the language's separator;
 *   · `{ ageMonths }`       — an age label in the reader's language;
 *   · `{ momentType }`      — a stored behaviour type through its i18n label
 *                             (named so a recipient payload never carries the
 *                             raw log field name, server/sharedPacket guard);
 *   · `{ languageName }`    — a profile/observation language name, localized
 *                             when it is a known language, else as written. */
export type PacketVar =
  | string
  | number
  | { key: string; vars?: Record<string, PacketVar>; fallback?: string }
  | { list: PacketVar[]; join: "and" | "comma" | "semicolon" }
  | { ageMonths: number }
  | { momentType: string }
  | { languageName: string };

/** LC-13 / B-CAREPRO-32: `text` is the English line (every existing reader
 *  keeps working and English output is byte-identical); `textKey` + `vars`
 *  render the same line in the reader's language through `itemText`. */
export interface PacketItem { id: string; text: string; textKey?: string; vars?: Record<string, PacketVar> }

const KNOWN_LANGUAGE_NAMES = ["hebrew", "english", "arabic", "russian", "french"] as const;

/** List separators per language. Hebrew's "and" is the prefix ו־, joined to
 *  the next word ("עברית ואנגלית"). */
const LIST_SEPARATOR: Record<UiLang, Record<"and" | "comma" | "semicolon", string>> = {
  en: { and: " and ", comma: ", ", semicolon: "; " },
  he: { and: " ו", comma: ", ", semicolon: "; " },
};

function resolveVar(v: PacketVar, lang: UiLang): string | number {
  if (typeof v === "string" || typeof v === "number") return v;
  if ("key" in v) {
    const out = translate(lang, v.key, resolveVars(v.vars, lang));
    // A key the dictionary does not carry (a custom domain id) reads as its
    // human fallback, never as the raw key.
    return out === v.key && v.fallback !== undefined ? v.fallback : out;
  }
  if ("list" in v) {
    const parts = v.list.map((x) => String(resolveVar(x, lang)));
    return parts.join(LIST_SEPARATOR[lang][v.join]);
  }
  if ("ageMonths" in v) return ageLabelForMonths(v.ageMonths, (k, vars) => translate(lang, k, vars));
  if ("momentType" in v) return behaviorTypeLabel(v.momentType, (k) => translate(lang, k), "full");
  const raw = v.languageName.trim();
  const known = (KNOWN_LANGUAGE_NAMES as readonly string[]).find((n) => raw.toLowerCase() === n);
  return known ? translate(lang, `ob.lang.${known}`) : raw;
}

function resolveVars(vars: Record<string, PacketVar> | undefined, lang: UiLang): Record<string, string | number> | undefined {
  if (!vars) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(vars)) out[k] = resolveVar(v, lang);
  return out;
}

/** B-CAREPRO-32 — an item line in the reader's language. English returns the
 *  stored `text` unchanged (byte-identical exports); any other language
 *  renders `textKey` with its vars. An item without a key is the family's own
 *  words (reason, question, memory fact, logged phrase) and stays as written. */
export function itemText(item: PacketItem, lang: UiLang = "en"): string {
  if (lang === "en" || !item.textKey) return item.text;
  return translate(lang, item.textKey, resolveVars(item.vars, lang));
}

/** "N time(s)" in the reader's language. */
const timesVar = (n: number): PacketVar => ({ key: n === 1 ? "elev.packet.times.one" : "elev.packet.times.other", vars: { n } });
/** A screening/milestone domain id through its dictionary label. */
const domainVar = (domain: string): PacketVar => ({ key: `screen.domain.${domain}`, fallback: humanDomainLabel(domain) });
/** LC-13 / item 8: `title`/`note` stay the English default so every existing
 *  caller keeps working; `titleKey`/`noteKey` (+ `titleVars`) are what
 *  `serializePacket` renders when a language is passed. A gan teacher receives
 *  a Hebrew packet, not an English scaffold with Hebrew items inside it. */
export interface PacketSection {
  id: string;
  title: string;
  note?: string;
  titleKey?: string;
  titleVars?: Record<string, string | number>;
  noteKey?: string;
  items: PacketItem[];
}
export interface ConsultPacket {
  childLabel: string;
  generatedAt: string;
  sections: PacketSection[];
}

const DAY = 86_400_000;
function toMs(ts: string | number): number {
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

export interface BuildPacketInput {
  profile: PacketInputProfile;
  logs: PacketInputLog[];
  milestones: PacketInputMilestone[];
  plans: PacketInputPlan[];
  memory: PacketInputMemory[];
  nowMs: number;
  windowDays?: number;
  /** CARE-7: when this audience last received an export (ISO or ms). Present
   *  ⇒ the packet gains a computed, counts-only "Since the last export" delta
   *  section. Absent (no prior export) ⇒ no delta section — fail quiet. */
  lastExportedAt?: string | number;
  /** B-CAREPRO-17: WHO received that last export. Present ⇒ the delta
   *  section's heading names them ("Since you last shared with the
   *  pediatrician (date)") instead of the generic "Since the last export". */
  lastExportedAudience?: ConsultAudience | "self";
  /** LC-20: the parent's one-line reason for the visit. When present it is the
   *  FIRST section of every packet, so the clinician does not open by asking
   *  the question the parent already answered. The parent's own words. */
  reason?: string;
  /** LC-12 + LC-20: the questions the parent prepared in Appointments. They
   *  ride into the packet so the prep work reaches the room. */
  questions?: string[];
  /** LC-20: phrases from Language Lab — the SLP preset's own evidence. */
  langObs?: PacketInputLangObs[];
  /** LC-20: parent-logged measurements — the pediatrician preset's own
   *  evidence. Numbers as entered; never a percentile or growth verdict. */
  growthEntries?: PacketInputGrowthEntry[];
}

/* ── LC-17b — ONE input assembler for every packet call site ─────────────────
 *
 * The consent preview (components/sections/TrustedSharing) and the recipient
 * view (server/sharedPacket) are only "the same view" if they are built from
 * the same INPUT. They were not, in three ways:
 *
 *  · the client dropped every log `trigger`, so a parent granting
 *    `report_behavioral_health` approved a preview with NO triggers section
 *    while the recipient read the parent's own free-text trigger words;
 *  · only the client derived `ageMonths`, so the age label and the
 *    age-windowed milestone denominator differed between the two views;
 *  · only the client passed each milestone's `ageMonths`, which is what that
 *    denominator is windowed on.
 *
 * The two report call sites (Reports.useReportExport, AskSpecialist) dropped
 * `trigger` too — which made `behavioral_health` byte-identical to `therapist`
 * for every real user, since the triggers section has no other source.
 *
 * So every call site assembles its input HERE, once. The raw shapes below are
 * the app's own record types (ChildProfile, BehaviorLog, Milestone,
 * ActionPlan, a folded memory item) narrowed to the fields a packet reads, and
 * every value is re-validated at runtime — the server's Firestore documents
 * arrive untyped, so the cast at that boundary must not be trusted. */

/** Raw child-profile fields as a call site holds them (a `ChildProfile`, or a
 *  Firestore document). Normalized by `buildPacketInput`. */
export interface RawPacketProfile {
  name: string;
  age: number;
  /** Explicit months, when onboarding captured months rather than a DOB. */
  ageMonths?: number;
  /** ISO YYYY-MM-DD — the gold source for the months-precise age. */
  birthDate?: string;
  /** B-DATA-03: the date `ageMonths` was true on, so a DOB-less age still ages. */
  ageMonthsAsOf?: string;
  languages: string[];
  schoolContext?: string;
  strengths?: string[];
  challenges?: string[];
  /** B-CAREPRO-29: `ChildProfile.activeGoals` (only goalId + label are read;
   *  a Firestore document is untrusted — `rawGoals` drops malformed rows). */
  activeGoals?: { goalId: string; label: string }[];
}
/** Raw behaviour-log fields (a `BehaviorLog`, or a Firestore document). */
export interface RawPacketLog {
  behaviorType: string;
  intensity: number;
  timestamp: string | number;
  trigger?: string;
  response?: string;
  resolved?: boolean;
}
/** Raw milestone fields (a `Milestone`, or a Firestore document) — the
 *  parent's response is read from `observationStatus`/`observationUpdatedAt`,
 *  the names the record itself carries, so no call site re-maps them. */
export interface RawPacketMilestone {
  domain: string;
  title: string;
  checked: boolean;
  ageMonths?: number;
  observationStatus?: "yes" | "not_sure" | "not_yet";
  observationUpdatedAt?: string;
}
/** Raw action-plan fields (an `ActionPlan`, or a Firestore document). */
export interface RawPacketPlan { id?: string; title: string; issue?: string; createdAt?: string | number }
/** Raw memory-ledger fields (a folded memory item, or a Firestore document). */
export interface RawPacketMemory { fact: string; status: string }

/** The child record every packet call site holds, before normalization. */
export interface RawChildRecord {
  profile: RawPacketProfile;
  logs: RawPacketLog[];
  milestones: RawPacketMilestone[];
  plans: RawPacketPlan[];
  memory: RawPacketMemory[];
}

const rawStr = (v: unknown): string => (typeof v === "string" ? v : "");
const rawNum = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const rawStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
/** B-CAREPRO-29: chosen goals → {goalId, label}; anything malformed is dropped. */
const rawGoals = (v: unknown): { goalId: string; label: string }[] =>
  Array.isArray(v)
    ? v.flatMap((g) => {
        const goalId = rawStr((g as { goalId?: unknown } | null)?.goalId);
        const label = rawStr((g as { label?: unknown } | null)?.label);
        return goalId && label ? [{ goalId, label }] : [];
      })
    : [];
const rawOptStr = (v: unknown): string | undefined => rawStr(v) || undefined;
const rawOptNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const rawTs = (v: unknown): string | number =>
  typeof v === "number" && Number.isFinite(v) ? v : rawStr(v) || 0;

/** Plan creation time: the stored field when present, else recovered from the
 *  `plan-<epoch-ms>` id ArborContext mints. Unparseable → undefined (the plan
 *  simply never counts as "new" in the delta; fail quiet, never guess). */
const rawPlanCreatedAt = (p: RawPacketPlan): string | number | undefined => {
  if (typeof p.createdAt === "number" || (typeof p.createdAt === "string" && p.createdAt)) {
    return p.createdAt;
  }
  const m = /^plan-(\d+)$/.exec(rawStr(p.id));
  if (!m) return undefined;
  const ms = Number(m[1]);
  return Number.isFinite(ms) ? ms : undefined;
};

/** Assemble a `BuildPacketInput` from a raw child record. The ONE mapping —
 *  preview, recipient view, and both report surfaces call it. Discipline-
 *  specific extras (reason, questions, langObs, growthEntries, lastExportedAt)
 *  are spread on by the call site that actually holds them. */
export function buildPacketInput(record: RawChildRecord, nowMs: number): BuildPacketInput {
  const p = record.profile;
  const at = new Date(nowMs);
  return {
    profile: {
      name: rawStr(p.name) || "This child",
      age: rawNum(p.age),
      // Months-precise age from the best source the record carries (birth date
      // → explicit months → years × 12). Drives the age LABEL and the
      // age-windowed milestone denominator, so both share sides derive it.
      ageMonths:
        ageMonthsFromProfile(
          { age: rawNum(p.age), birthDate: rawOptStr(p.birthDate), ageMonths: rawOptNum(p.ageMonths), ageMonthsAsOf: rawOptStr(p.ageMonthsAsOf) },
          at
        ) ?? undefined,
      languages: rawStrArr(p.languages),
      schoolContext: rawOptStr(p.schoolContext),
      strengths: rawStrArr(p.strengths),
      challenges: rawStrArr(p.challenges),
      activeGoals: rawGoals(p.activeGoals),
    },
    logs: record.logs.map((l) => ({
      behaviorType: rawStr(l.behaviorType),
      intensity: rawNum(l.intensity),
      timestamp: rawTs(l.timestamp),
      // The parent's own words for what came first — the ONLY source of the
      // behavioural preset's `triggers` section, and of the trigger lines a
      // share recipient reads. Never drop it on one side of a seam.
      trigger: rawOptStr(l.trigger),
      response: rawOptStr(l.response),
      resolved: l.resolved === true,
    })),
    milestones: record.milestones.map((m) => ({
      domain: rawStr(m.domain),
      title: rawStr(m.title),
      checked: m.checked === true,
      ageMonths: rawOptNum(m.ageMonths),
      // UND-4: the parent's actual response, validated against the closed
      // literal set — anything else is dropped (fail quiet) and the legacy
      // `checked` flag decides.
      status:
        m.observationStatus === "yes" || m.observationStatus === "not_sure" || m.observationStatus === "not_yet"
          ? m.observationStatus
          : undefined,
      observedAt: rawOptStr(m.observationUpdatedAt),
    })),
    plans: record.plans.map((pl) => ({
      title: rawStr(pl.title),
      issue: rawOptStr(pl.issue),
      createdAt: rawPlanCreatedAt(pl),
    })),
    memory: record.memory.map((m) => ({ fact: rawStr(m.fact), status: rawStr(m.status) })),
    nowMs,
  };
}

/** Effective parent response for a milestone: the explicit wave-2 observation
 *  status when present, else derived from the legacy `checked` flag. */
const effectiveObservation = (m: PacketInputMilestone): "yes" | "not_sure" | "not_yet" =>
  m.status ?? (m.checked ? "yes" : "not_yet");

/** ISO date (YYYY-MM-DD) or null when the timestamp is absent/invalid. */
const isoDay = (ts?: string | number): string | null => {
  if (ts == null || ts === "") return null;
  const t = toMs(ts);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};

/* RUN-01 — a packet that leaves the app must read like a human wrote it.
 *
 *  · Domain keys go through the SAME human label map the Development /
 *    Screening surfaces render ("Thinking & attention", never
 *    "cognition_executive_function"). Non-canonical domains (custom items)
 *    fall back to a de-snaked, capitalised form so an identifier never leaks.
 *  · The milestone denominator is AGE-WINDOWED: the child's current CDC band
 *    plus the one before it (the checklists a well-child visit would look
 *    at). A 5-year-old is never measured against the 2-month checklist.
 *    NOTE for lane G: `milestoneInAgeWindow` is the small local helper the
 *    brief allows; lane G adds the shared one on `lib/milestoneData.ts` and
 *    this call site should switch to it. */

/** Human label for a developmental-domain id (Development's own map). */
export function humanDomainLabel(domain: string): string {
  const known = (DOMAIN_LABEL as Record<string, string>)[domain];
  if (known) return known;
  const plain = domain.replace(/_/g, " ").trim();
  return plain ? plain.charAt(0).toUpperCase() + plain.slice(1) : domain;
}

/** Is this milestone inside the child's age window (current band or the one
 *  immediately before it)? Items with no age anchor always count. */
export function milestoneInAgeWindow(milestoneAgeMonths: number | undefined, childAgeMonths: number): boolean {
  // Lane G: ONE window definition app-wide (lib/milestoneData.milestoneAgeWindow):
  // current CDC band + the one before it; unanchored items always count.
  return milestoneAgeWindow(childAgeMonths).includes(milestoneAgeMonths);
}

/** Age in months the packet windows against: explicit months, else years × 12. */
const childAgeMonthsOf = (profile: PacketInputProfile): number =>
  typeof profile.ageMonths === "number" && Number.isFinite(profile.ageMonths) ? profile.ageMonths : Math.max(0, profile.age) * 12;

/** Assemble the packet from the child's record. Empty sources yield no section. */
export function buildConsultPacket(input: BuildPacketInput): ConsultPacket {
  const { profile, logs, milestones, plans, memory, nowMs } = input;
  const windowDays = input.windowDays ?? 30;
  const since = nowMs - windowDays * DAY;
  const recent = logs.filter((l) => toMs(l.timestamp) >= since);

  const sections: PacketSection[] = [];

  // 0) LC-20 — WHY THE PARENT IS COMING. Every preset used to open with
  //    "About", so a clinician read four dated, structured sections and still
  //    had to ask the first question. When the parent writes a line, it opens
  //    the packet. Their own words, unedited, never a paraphrase.
  const reason = (input.reason ?? "").trim();
  if (reason) {
    sections.push({
      id: "reason",
      title: "What I'd like help with",
      note: "In the parent's own words.",
      titleKey: "elev.packet.section.reason", noteKey: "elev.packet.note.reason",
      items: [{ id: "reason-line", text: reason }],
    });
  }

  // 1) Who the child is.
  const basicsVars: Record<string, PacketVar> = { name: profile.name, age: { ageMonths: childAgeMonthsOf(profile) } };
  const aboutItems: PacketItem[] = [
    profile.languages.length
      ? {
          id: "about-basics",
          text: `${profile.name}, ${ageLabel(profile)}, speaks ${profile.languages.join(" and ")}.`,
          textKey: "elev.packet.item.basicsLangs",
          vars: { ...basicsVars, languages: { list: profile.languages.map((l) => ({ languageName: l })), join: "and" } },
        }
      : { id: "about-basics", text: `${profile.name}, ${ageLabel(profile)}.`, textKey: "elev.packet.item.basics", vars: basicsVars },
  ];
  if (profile.schoolContext) aboutItems.push({ id: "about-school", text: `Setting: ${profile.schoolContext}.`, textKey: "elev.packet.item.setting", vars: { setting: profile.schoolContext } });
  if (profile.strengths?.length) aboutItems.push({ id: "about-strengths", text: `Strengths: ${profile.strengths.join(", ")}.`, textKey: "elev.packet.item.strengths", vars: { list: { list: profile.strengths, join: "comma" } } });
  // B-CAREPRO-29: the parent's chosen goals lead (keyed, so a Hebrew reader
  // gets the Hebrew tile label); free-text challenges follow, as written.
  const goals = profile.activeGoals ?? [];
  const challenges = (profile.challenges ?? []).filter((c) => !goals.some((g) => g.label.toLowerCase() === c.toLowerCase()));
  if (goals.length || challenges.length) {
    aboutItems.push({
      id: "about-focus",
      text: `Current focus: ${[...goals.map((g) => g.label), ...challenges].join(", ")}.`,
      textKey: "elev.packet.item.focus",
      vars: { list: { list: [...goals.map((g): PacketVar => ({ key: `elev.goal.tile.${g.goalId}`, fallback: g.label })), ...challenges], join: "comma" } },
    });
  }
  sections.push({ id: "about", title: `About ${profile.name}`, titleKey: "elev.packet.section.about", titleVars: { name: profile.name }, items: aboutItems });

  // 2) What's been happening — top recent concerns by frequency.
  if (recent.length) {
    const counts = new Map<string, { n: number; maxIntensity: number }>();
    for (const l of recent) {
      const c = counts.get(l.behaviorType) ?? { n: 0, maxIntensity: 0 };
      c.n += 1; c.maxIntensity = Math.max(c.maxIntensity, l.intensity);
      counts.set(l.behaviorType, c);
    }
    const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
    const items: PacketItem[] = top.map(([type, c], i) => ({
      id: `pattern-${i}`,
      text: `${type}: ${c.n} time${c.n === 1 ? "" : "s"} in the last ${windowDays} days${c.maxIntensity >= 4 ? ", sometimes intense" : ""}.`,
      textKey: c.maxIntensity >= 4 ? "elev.packet.item.patternIntense" : "elev.packet.item.pattern",
      vars: { type: { momentType: type }, times: timesVar(c.n), days: windowDays },
    }));
    sections.push({
      id: "patterns",
      title: `What we've been seeing (last ${windowDays} days)`,
      titleKey: "elev.packet.section.patterns", titleVars: { days: windowDays },
      noteKey: "elev.packet.note.patterns",
      // Deliberately scan-clean wording (CARE-2): the fail-closed clinical-term
      // scan runs on non-clinician egress, so the reassurance note itself must
      // not contain a scanned term.
      note: "Parent-logged moments — observations only, never an assessment.",
      items,
    });
  }

  // 3) Development snapshot — milestone coverage in the parent's OWN response
  //    groups (UND-4 / AR-CAP-08: the packet preserves observed / not sure,
  //    with observation dates — for a provider, "parent is unsure" is a useful
  //    signal). RUN-01: the packet NEVER lists what the parent has NOT seen —
  //    an unmarked item is "never asked", not "not observed", and a list of
  //    them reads as a deficit sheet to a professional. So: the section
  //    exists only once the parent has recorded at least one observation;
  //    it carries noticed counts (age-windowed) + the parent's own responses;
  //    domain ids render through the human label map. Counts and factual
  //    titles only — never a percentage, score, or verdict.
  const observed = milestones.filter((m) => effectiveObservation(m) === "yes");
  const notSure = milestones.filter((m) => effectiveObservation(m) === "not_sure");
  if (observed.length || notSure.length) {
    const childMonths = childAgeMonthsOf(profile);
    const inWindow = milestones.filter((m) => milestoneInAgeWindow(m.ageMonths, childMonths));
    const observedInWindow = inWindow.filter((m) => effectiveObservation(m) === "yes");
    const MAX_LISTED = 6;
    const groupLine = (id: string, label: string, labelKey: string, group: PacketInputMilestone[]): PacketItem | null => {
      if (group.length === 0) return null;
      const shown = group.slice(0, MAX_LISTED);
      const listed = shown.map((m) => {
        const date = isoDay(m.observedAt);
        return `${m.title} (${humanDomainLabel(m.domain)}${date ? `, ${date}` : ""})`;
      });
      const more = group.length > MAX_LISTED ? `; and ${group.length - MAX_LISTED} more` : "";
      // Milestone titles stay as catalogued (GD-6); the scaffold, the domain
      // and the "and N more" tail are the reader's language.
      const entries: PacketVar[] = shown.map((m) => {
        const date = isoDay(m.observedAt);
        return date
          ? { key: "elev.packet.item.milestoneDated", vars: { title: m.title, domain: domainVar(m.domain), date } }
          : { key: "elev.packet.item.milestone", vars: { title: m.title, domain: domainVar(m.domain) } };
      });
      return {
        id,
        text: `${label} (${group.length}): ${listed.join("; ")}${more}.`,
        textKey: group.length > MAX_LISTED ? "elev.packet.item.groupMore" : "elev.packet.item.group",
        vars: { label: { key: labelKey }, n: group.length, list: { list: entries, join: "semicolon" }, ...(group.length > MAX_LISTED ? { more: group.length - MAX_LISTED } : {}) },
      };
    };
    const byDomain = new Map<string, { done: number; total: number }>();
    for (const m of inWindow) {
      const d = byDomain.get(m.domain) ?? { done: 0, total: 0 };
      d.total += 1; if (effectiveObservation(m) === "yes") d.done += 1;
      byDomain.set(m.domain, d);
    }
    const band = bandForAgeMonths(childMonths);
    const windowLabel = band.label;
    const overallTotal = observed.length !== observedInWindow.length;
    const items: PacketItem[] = [
      {
        id: "dev-overall",
        text: `${observedInWindow.length} of ${inWindow.length} milestones on the ${windowLabel} checklists noticed so far` +
          (overallTotal ? ` (${observed.length} noticed in total).` : "."),
        textKey: overallTotal ? "elev.packet.item.devOverallTotal" : "elev.packet.item.devOverall",
        vars: { done: observedInWindow.length, total: inWindow.length, band: { ageMonths: band.months }, all: observed.length },
      },
      ...[
        groupLine("dev-observed", "Observed", "elev.packet.item.observed", observed),
        groupLine("dev-not-sure", "Not sure yet", "elev.packet.item.notSure", notSure),
      ].filter((it): it is PacketItem => it !== null),
      ...[...byDomain.entries()]
        .filter(([, d]) => d.total > 0)
        .map(([domain, d], i) => ({
          id: `dev-${i}`,
          text: `${humanDomainLabel(domain)}: ${d.done} of ${d.total} noticed.`,
          textKey: "elev.packet.item.devDomain",
          vars: { domain: domainVar(domain), done: d.done, total: d.total },
        })),
    ];
    sections.push({ id: "development", title: "Development snapshot", titleKey: "elev.packet.section.development", items });
  }

  // 4) What's been tried — active plans (shows the family is already working on it).
  if (plans.length) {
    const items: PacketItem[] = plans.slice(0, 4).map((p, i) => (p.issue
      ? { id: `tried-${i}`, text: `${p.title} — for ${p.issue}.`, textKey: "elev.packet.item.triedFor", vars: { title: p.title, issue: p.issue } }
      : { id: `tried-${i}`, text: p.title }));
    sections.push({ id: "tried", title: "What we've already tried", titleKey: "elev.packet.section.tried", items });
  }

  // 5) What Arbor remembers — approved longitudinal facts (the moat).
  const approved = memory.filter((m) => m.status === "approved");
  if (approved.length) {
    const items: PacketItem[] = approved.slice(0, 8).map((m, i) => ({ id: `mem-${i}`, text: m.fact }));
    sections.push({
      id: "memory",
      title: "Context worth knowing",
      note: "Approved notes from your history with Arbor.",
      titleKey: "elev.packet.section.memory", noteKey: "elev.packet.note.memory",
      items,
    });
  }

  // 5b) LC-20 — SLP evidence: the phrases the parent actually logged. This
  //     section exists ONLY in the SLP preset's ceiling, which is what finally
  //     makes "SLP Summary" a different document from "Pediatrician Summary".
  //     Parent-recorded phrases, dated — no scoring, no articulation verdict.
  if (input.langObs?.length) {
    const items: PacketItem[] = input.langObs.slice(0, 12).map((o, i) => {
      const day = isoDay(o.at);
      const lang = o.language ? ` [${o.language}]` : "";
      const text = `${o.phrase}${lang}${day ? ` (${day})` : ""}`;
      if (!o.language && !day) return { id: `lang-${i}`, text };
      return {
        id: `lang-${i}`,
        text,
        textKey: `elev.packet.item.phrase${o.language ? "Lang" : ""}${day ? "Dated" : ""}`,
        vars: { phrase: o.phrase, language: { languageName: o.language ?? "" }, date: day ?? "" },
      };
    });
    sections.push({
      id: "language-observations",
      title: "Phrases we have heard",
      note: "Parent-recorded phrases, as heard at home.",
      titleKey: "elev.packet.section.language", noteKey: "elev.packet.note.language",
      items,
    });
  }

  // 5c) LC-20 — pediatrician evidence: the measurements the parent logged, as
  //     entered. NEVER a percentile, centile band, or growth verdict; the
  //     clinician plots these against their own charts.
  if (input.growthEntries?.length) {
    const items: PacketItem[] = [...input.growthEntries]
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, 8)
      .map((g, i) => {
        const parts = [
          g.heightCm != null ? `${g.heightCm} cm` : null,
          g.weightKg != null ? `${g.weightKg} kg` : null,
        ].filter(Boolean);
        const partVars: PacketVar[] = [
          ...(g.heightCm != null ? [{ key: "elev.packet.item.cm", vars: { n: g.heightCm } }] : []),
          ...(g.weightKg != null ? [{ key: "elev.packet.item.kg", vars: { n: g.weightKg } }] : []),
        ];
        return {
          id: `growth-${i}`,
          text: `${isoDay(g.date) ?? g.date}: ${parts.join(", ")}`,
          textKey: "elev.packet.item.measurement",
          vars: { date: isoDay(g.date) ?? g.date, parts: { list: partVars, join: "comma" as const } },
        };
      })
      .filter((it) => !/: $/.test(it.text));
    if (items.length) {
      sections.push({
        id: "growth-measurements",
        title: "Measurements we have taken",
        note: "Parent-recorded measurements, as entered at home.",
        titleKey: "elev.packet.section.measurements", noteKey: "elev.packet.note.measurements",
        items,
      });
    }
  }

  // 5d) LC-20 — behavioural evidence: what the parent noticed came BEFORE the
  //     hard moments, in their own words, with counts. Only the behavioral
  //     health preset's ceiling includes it.
  const triggerCounts = new Map<string, number>();
  for (const l of recent) {
    const trigger = (l.trigger ?? "").trim();
    if (trigger) triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1);
  }
  if (triggerCounts.size) {
    const items: PacketItem[] = [...triggerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([trigger, n], i) => ({
        id: `trigger-${i}`,
        text: `"${trigger}" — noted ${n} time${n === 1 ? "" : "s"}.`,
        textKey: "elev.packet.item.trigger",
        vars: { quote: trigger, times: timesVar(n) },
      }));
    sections.push({
      id: "triggers",
      title: "What we noticed came first",
      note: "The parent's own words for what preceded a hard moment — counts, not causes.",
      titleKey: "elev.packet.section.triggers", noteKey: "elev.packet.note.triggers",
      items,
    });
  }

  // 5e) LC-12 + LC-20 — the questions the parent prepared in Appointments.
  //     Prep work that used to stop at the Appointments screen now reaches the
  //     room. Every audience gets them: they are the parent's questions.
  const questions = (input.questions ?? []).map((q) => q.trim()).filter(Boolean);
  if (questions.length) {
    sections.push({
      id: "questions",
      title: "Questions I want to ask",
      titleKey: "elev.packet.section.questions",
      items: questions.slice(0, 10).map((q, i) => ({ id: `question-${i}`, text: q })),
    });
  }

  // 6) Since the last export (CARE-7) — a computed, counts-only delta that
  //    appears ONLY when a prior export to this audience exists. It rides the
  //    same fail-closed ceiling guards as every other section; no authored
  //    clinical content lives here.
  if (input.lastExportedAt != null) {
    const lastMs = toMs(input.lastExportedAt);
    if (Number.isFinite(lastMs) && lastMs > 0 && lastMs <= nowMs) {
      const newLogs = logs.filter((l) => {
        const t = toMs(l.timestamp);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const newPlans = plans.filter((p) => {
        if (p.createdAt == null) return false;
        const t = toMs(p.createdAt);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const newlyNoticed = milestones.filter((m) => {
        if (effectiveObservation(m) !== "yes" || !m.observedAt) return false;
        const t = toMs(m.observedAt);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const s = (n: number) => (n === 1 ? "" : "s");
      // B-CAREPRO-17: the heading names who last received it — honest about
      // what the anchor is (the last time THIS audience got a summary), until
      // B-CAREPRO-37 re-anchors it on the visit itself.
      const sinceKey = input.lastExportedAudience && input.lastExportedAudience !== "teacher"
        ? `elev.packet.section.sinceShared.${input.lastExportedAudience}`
        : "elev.packet.section.sinceLast";
      const sinceVars = { date: isoDay(lastMs) ?? "" };
      sections.push({
        id: "since-last-visit",
        title: translate("en", sinceKey, sinceVars),
        note: "What was added since this summary was last prepared for this audience — counts only.",
        titleKey: sinceKey, titleVars: sinceVars,
        noteKey: "elev.packet.note.sinceLast",
        items: [
          { id: "delta-logs", text: `${newLogs} new moment${s(newLogs)} logged.`, textKey: `elev.packet.item.deltaLogs.${newLogs === 1 ? "one" : "other"}`, vars: { n: newLogs } },
          { id: "delta-plans", text: `${newPlans} action plan${s(newPlans)} added.`, textKey: `elev.packet.item.deltaPlans.${newPlans === 1 ? "one" : "other"}`, vars: { n: newPlans } },
          { id: "delta-milestones", text: `${newlyNoticed} milestone${s(newlyNoticed)} newly noticed.`, textKey: `elev.packet.item.deltaMilestones.${newlyNoticed === 1 ? "one" : "other"}`, vars: { n: newlyNoticed } },
        ],
      });
    }
  }

  return {
    childLabel: profile.name,
    generatedAt: new Date(nowMs).toISOString().slice(0, 10),
    sections,
  };
}

/** LC-13 / item 8: the packet's own SCAFFOLD in the reader's language. Section
 *  titles and the two header lines resolve through `titleKey`/`noteKey` (set at
 *  build time) when `lang` is given; a section without a key falls back to the
 *  English `title`, so an un-migrated caller is never left with a blank
 *  heading. Item TEXT is parent- and log-derived and is not translated here. */
export function sectionTitle(section: PacketSection, lang: UiLang = "en"): string {
  return section.titleKey ? translate(lang, section.titleKey, section.titleVars) : section.title;
}

/** As above, for the italic note line under a heading. */
export function sectionNote(section: PacketSection, lang: UiLang = "en"): string | undefined {
  if (section.noteKey) return translate(lang, section.noteKey);
  return section.note;
}

/** Render the packet to shareable Markdown, omitting any redacted item ids and
 *  any section the parent emptied. `lang` renders the scaffold — headings and
 *  the prepared line — in the parent's language (default English). */
export function serializePacket(packet: ConsultPacket, excludedIds: Set<string> = new Set(), lang: UiLang = "en"): string {
  const lines: string[] = [
    `# ${translate(lang, "elev.packet.header", { name: packet.childLabel })}`,
    `_${translate(lang, "elev.packet.prepared", { date: packet.generatedAt })}_`,
    "",
  ];
  for (const section of packet.sections) {
    const items = section.items.filter((it) => !excludedIds.has(it.id));
    if (items.length === 0) continue;
    lines.push(`## ${sectionTitle(section, lang)}`);
    const note = sectionNote(section, lang);
    if (note) lines.push(`_${note}_`);
    for (const it of items) lines.push(`- ${itemText(it, lang)}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** AIX-S3(a): append a parent-reviewed note (e.g. the Arbor Vision handoff
 *  note) to a serialized packet under its own heading. Pure + total: an empty
 *  or whitespace note returns the packet unchanged, so callers can pass the
 *  composer's live value directly. The note is parent-editable text — it rides
 *  only into exports the parent explicitly triggers. */
export function appendParentNote(packetMarkdown: string, note: string, heading: string): string {
  const trimmed = note.trim();
  if (!trimmed) return packetMarkdown;
  return `${packetMarkdown.trimEnd()}\n\n## ${heading}\n\n${trimmed}\n`;
}

/** Count of includable items (for the UI's "N details selected"). */
export function countIncluded(packet: ConsultPacket, excludedIds: Set<string>): number {
  return packet.sections.reduce(
    (n, s) => n + s.items.filter((it) => !excludedIds.has(it.id)).length,
    0
  );
}

/** LC-06: a packet with nothing beyond the profile's "about" section has
 *  nothing to hand a professional — the consult surface shows its empty state
 *  (log a moment first) instead of an export bar for a one-line packet. The
 *  "about" section is always emitted, so `sections.length === 0` is never
 *  true; this is the honest emptiness test. */
export function isConsultPacketEmpty(packet: ConsultPacket): boolean {
  return packet.sections.every((s) => s.id === "about");
}

/* Audience presets (IA W4.1 + CARE-7) — one packet builder, five audiences,
 * each with a DEFINED data ceiling:
 *
 *  - teacher (non-clinician): capped at the School-Brief curated ceiling —
 *    profile-level context + what the family already tries. NO log-derived
 *    patterns, NO milestone coverage, NO memory-ledger facts, NO log-derived
 *    delta counts (the packet never carries raw behavior-log fields for ANY
 *    audience; for a teacher even the derived sections stay behind the
 *    ceiling). The shared fail-closed clinical-term scan
 *    (`src/lib/clinicalScan.ts`) runs on every teacher build AND serialization.
 *  - therapist / pediatrician / slp / behavioral_health (clinicians):
 *    log-derived patterns + approved memory facts + the computed
 *    since-last-export delta are IN ceiling. EXEMPT from the term scan by
 *    policy — "speech delay" is legitimate shorthand in an SLP or
 *    pediatrician summary.
 *
 * No preset, clinician or not, may export "riskLevel", "milestonesPercent",
 * or a percentage readiness figure — those tokens appear in NO export. */

export type ConsultAudience = "teacher" | "therapist" | "pediatrician" | "slp" | "behavioral_health";

export interface ConsultPreset {
  audience: ConsultAudience;
  /** Section ids (from `buildConsultPacket`) this audience may receive. */
  sections: readonly string[];
  dataCeiling: {
    /** Frequency/intensity patterns derived from the behavior log. */
    logDerivedPatterns: boolean;
    /** Parent-approved longitudinal memory facts. */
    approvedMemoryFacts: boolean;
  };
  /** Fail-closed clinical-diagnosis-term scan (non-clinician audiences only). */
  clinicalTermScan: boolean;
}

/** LC-20: the parent's reason for the visit and their prepared questions open
 *  and close every CLINICIAN packet — the parent's own words, not child data
 *  derived by Arbor, so no clinician ceiling excludes them.
 *
 *  LC-11b — they are NOT in the teacher ceiling. Both are composed on the
 *  consult surface in explicitly clinician-facing language ("The one thing I
 *  most want to talk about is…", questions prepared for an appointment), so a
 *  parent writing "Should we get him assessed?" was writing to a clinician and
 *  had it carried verbatim into the teacher's copy by Copy / Download / Send.
 *  A teacher-facing line has ONE door — the School Brief, where the parent
 *  reviews every field. Removing them from this preset also removes the
 *  dead-end where a normal English sentence containing "delay" tripped the
 *  teacher term scan and disabled every export verb on the screen: the
 *  sections are capped out before the guard ever sees them. */
const PARENT_VOICE_SECTIONS = ["reason", "questions"] as const;

/** The shared clinician ceiling (CARE-7): same base sections, same data
 *  ceiling, term-scan exempt — one policy, no forks. Each clinician audience
 *  then adds the ONE evidence section its own discipline actually reads
 *  (LC-20: four "professional" reports used to be byte-identical documents
 *  that differed only in their title). */
const CLINICIAN_SECTIONS = ["about", "patterns", "development", "tried", "memory", "since-last-visit"] as const;
const CLINICIAN_CEILING = { logDerivedPatterns: true, approvedMemoryFacts: true } as const;
const clinicianPreset = (audience: ConsultAudience, extraSections: readonly string[] = []): ConsultPreset => ({
  audience,
  sections: [...PARENT_VOICE_SECTIONS, ...CLINICIAN_SECTIONS, ...extraSections],
  dataCeiling: { ...CLINICIAN_CEILING },
  clinicalTermScan: false,
});

export const CONSULT_PRESETS: Record<ConsultAudience, ConsultPreset> = {
  teacher: {
    audience: "teacher",
    // LC-11b: no parent-voice sections — see PARENT_VOICE_SECTIONS above.
    sections: ["about", "tried"],
    dataCeiling: { logDerivedPatterns: false, approvedMemoryFacts: false },
    clinicalTermScan: true,
  },
  // The generalist ceiling — everything shared, no discipline-specific evidence.
  therapist: clinicianPreset("therapist"),
  // Physical measurements the parent logged, as entered (never a percentile).
  pediatrician: clinicianPreset("pediatrician", ["growth-measurements"]),
  // The phrases the parent actually heard at home.
  slp: clinicianPreset("slp", ["language-observations"]),
  // What the parent noticed came first, in their own words, with counts.
  behavioral_health: clinicianPreset("behavioral_health", ["triggers"]),
};

/** Tokens that appear in NO export, for ANY audience (clinician or not). */
export const FORBIDDEN_EXPORT_TOKENS = ["riskLevel", "milestonesPercent"] as const;

/** Clinician-ceiling egress guard for clinician-facing exports that live
 *  OUTSIDE the consult packet (the Copilot practice summary, the monitoring
 *  printable — IA W4.5). Same policy as the clinician presets: term-scan-EXEMPT,
 *  but ceiling-bound — the forbidden tokens fail closed, and so does any
 *  percentage figure, because exports carry counts, never percentages. */
export function assertClinicianExportCeiling(text: string): void {
  for (const token of FORBIDDEN_EXPORT_TOKENS) {
    if (text.includes(token)) {
      throw new ClinicalLanguageError(token, `Export blocked: forbidden token "${token}" must not appear in any export.`);
    }
  }
  const pct = /\d+(?:\.\d+)?\s*%/.exec(text);
  if (pct) {
    throw new ClinicalLanguageError(pct[0], `Export blocked: percentage figure "${pct[0]}" — exports carry counts, never percentages.`);
  }
}

/** Flatten a packet to plain text for the ceiling guards. */
function packetToText(packet: ConsultPacket): string {
  return packet.sections
    .flatMap((s) => [s.title, s.note ?? "", ...s.items.map((it) => it.text)])
    .join("\n");
}

/** Cap a packet to the preset's section ceiling. */
function capToPreset(preset: ConsultPreset, packet: ConsultPacket): ConsultPacket {
  const allowed = new Set(preset.sections);
  return { ...packet, sections: packet.sections.filter((s) => allowed.has(s.id)) };
}

/** Fail-closed egress guards: forbidden tokens block EVERY audience; the
 *  clinical-diagnosis-term scan blocks non-clinician audiences only. */
function assertWithinCeiling(preset: ConsultPreset, text: string): void {
  for (const token of FORBIDDEN_EXPORT_TOKENS) {
    if (text.includes(token)) {
      throw new ClinicalLanguageError(token, `Consult packet blocked: forbidden token "${token}" must not appear in any export.`);
    }
  }
  if (preset.clinicalTermScan) {
    const violation = findClinicalDiagnosisTerm(text);
    if (violation) {
      throw new ClinicalLanguageError(violation, `Consult packet blocked: clinical-diagnosis term "${violation}" is not allowed in a ${preset.audience} packet.`);
    }
  }
}

/** Build the packet capped to the audience preset's data ceiling. Fail-closed:
 *  a non-clinician (teacher) packet throws on any clinical-diagnosis term. */
export function buildPresetPacket(audience: ConsultAudience, input: BuildPacketInput): ConsultPacket {
  const preset = CONSULT_PRESETS[audience];
  const packet = capToPreset(preset, buildConsultPacket(input));
  assertWithinCeiling(preset, packetToText(packet));
  return packet;
}

/** Serialize a preset packet — re-caps the sections and re-runs the guards at
 *  the egress seam, so a redaction/edit path can never route around the
 *  build-time scan. */
export function serializePresetPacket(
  audience: ConsultAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set(),
  lang: UiLang = "en"
): string {
  const preset = CONSULT_PRESETS[audience];
  const md = serializePacket(capToPreset(preset, packet), excludedIds, lang);
  assertWithinCeiling(preset, md);
  return md;
}

/* ── CARE-2 — recipient shared view ──────────────────────────────────────────
 * The read-only packet a share RECIPIENT (co-parent / viewer / professional)
 * may see. This is the ONLY egress for recipient-facing child data: it builds
 * through `buildConsultPacket`, caps sections to exactly what the grant's
 * stable scope IDs (lib/shareScopes.ts) unlock, and re-runs the same
 * fail-closed guards (`assertWithinCeiling`: forbidden tokens for everyone,
 * clinical-diagnosis term scan for non-clinician recipients) on the final
 * text. Raw subcollection documents never leave the server — only these
 * derived, counts-only section lines do.
 */

/** Stable share-scope ID → the packet sections it unlocks. FAILS CLOSED: a
 *  scope not in this map (e.g. an unmigrated legacy string) unlocks nothing.
 *  The report_* scopes mirror their audience preset ceilings exactly. */
export const SHARED_SCOPE_SECTIONS: Record<string, readonly string[]> = {
  story_timeline: ["patterns"],
  weekly_insight: ["patterns", "development"],
  behavior_patterns: ["patterns"],
  milestones: ["development"],
  report_teacher: CONSULT_PRESETS.teacher.sections,
  report_therapist: CONSULT_PRESETS.therapist.sections,
  report_pediatrician: CONSULT_PRESETS.pediatrician.sections,
  report_slp: CONSULT_PRESETS.slp.sections,
  report_behavioral_health: CONSULT_PRESETS.behavioral_health.sections,
};

/** Build the recipient's read-only packet: exactly the sections the granted
 *  scopes unlock, guard-checked at this egress seam. Non-clinician recipients
 *  (co_parent / viewer) ride the non-clinician ceiling — the fail-closed
 *  clinical-diagnosis term scan runs, mirroring the teacher preset policy.
 *  Professionals ride the clinician ceiling (term-scan exempt by the same
 *  policy as therapist/pediatrician presets). The forbidden-token scan runs
 *  for EVERY recipient. Throws `ClinicalLanguageError` (fail closed) rather
 *  than ever emitting guarded content. */
export function buildSharedScopePacket(
  scopes: readonly string[],
  recipientIsClinician: boolean,
  input: BuildPacketInput
): ConsultPacket {
  const allowed = new Set<string>();
  for (const scope of scopes) {
    for (const sectionId of SHARED_SCOPE_SECTIONS[scope] ?? []) allowed.add(sectionId);
  }
  const packet = buildConsultPacket(input);
  const capped: ConsultPacket = { ...packet, sections: packet.sections.filter((s) => allowed.has(s.id)) };
  const guardPreset: ConsultPreset = recipientIsClinician
    ? CONSULT_PRESETS.therapist
    : { audience: "teacher", sections: [...allowed], dataCeiling: CONSULT_PRESETS.teacher.dataCeiling, clinicalTermScan: true };
  assertWithinCeiling(guardPreset, packetToText(capped));
  return capped;
}

/** Print-shell section shape — matches `ReportDoc.sections` in
 *  `lib/reportExport` without importing it (the print shell depends on no
 *  consult types, and this module stays pure). */
export interface PresetPrintSection { heading: string; body: string[] }

/** Render a preset packet as print-shell sections for `openPrintableReport`
 *  (IA W4.2 — the AskSpecialist / Reports PDF path). Same egress contract as
 *  `serializePresetPacket`: re-caps to the audience ceiling, honours parent
 *  redaction (excluded item ids drop, emptied sections vanish), and re-runs
 *  the fail-closed guards on the final text. */
export function presetPacketToPrintSections(
  audience: ConsultAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set(),
  lang: UiLang = "en"
): PresetPrintSection[] {
  const preset = CONSULT_PRESETS[audience];
  const sections: PresetPrintSection[] = [];
  for (const section of capToPreset(preset, packet).sections) {
    const items = section.items.filter((it) => !excludedIds.has(it.id));
    if (items.length === 0) continue;
    const note = sectionNote(section, lang);
    sections.push({
      heading: sectionTitle(section, lang),
      body: [...(note ? [note] : []), ...items.map((it) => itemText(it, lang))],
    });
  }
  assertWithinCeiling(preset, sections.flatMap((s) => [s.heading, ...s.body]).join("\n"));
  return sections;
}

/* ── LC-08 + B-CAREPRO-28 — the ONE export seam for every Consult egress ─────
 * The consult surface's verbs used to build their text through the unguarded
 * `serializePacket` (LC-08), and then — even once guarded — every clinician
 * got the THERAPIST preset on Copy/Download/mail while the SLP phrases and the
 * pediatrician's measurements reached only a separate 10-item PDF menu.
 *
 * B-CAREPRO-28: the audience IS the preset. The parent picks who the summary
 * is for (pediatrician · speech therapist · behaviour/psychology · other
 * clinician · teacher · my records) and Copy, PDF and "Send to someone you
 * trust" all serialize that one preset through this seam:
 *
 *  - a clinician preset → its own ceiling (+ the one evidence section its
 *    discipline reads), term-scan exempt, forbidden tokens + % fail closed;
 *  - teacher   → the teacher preset: curated ceiling, AND the parent note is
 *    scanned for clinical-diagnosis terms BEFORE it joins (fail closed). The
 *    Consult screen hands a teacher to the School Brief instead (LC-11);
 *  - self      → the parent's own records: everything they selected, still
 *    behind the forbidden-token / percentage ceiling.
 *
 * Components may not import `serializePacket` (a source-scan guard enforces
 * it); they call `serializeForExport` / `exportPrintSections` instead. */

export type ExportAudience = ConsultAudience | "self";

/** The audience step, in the order the parent reads it. */
export const EXPORT_AUDIENCES: readonly ExportAudience[] = [
  "pediatrician", "slp", "behavioral_health", "therapist", "teacher", "self",
];
export const DEFAULT_EXPORT_AUDIENCE: ExportAudience = "pediatrician";

/** A stored or caller-supplied audience → a current one. The pre-B-28 value
 *  "clinician" meant the therapist ceiling, so it maps there; anything else
 *  unknown is null (the caller keeps its default). */
export function normalizeExportAudience(value: unknown): ExportAudience | null {
  if (value === "clinician") return "therapist";
  return typeof value === "string" && (EXPORT_AUDIENCES as readonly string[]).includes(value)
    ? (value as ExportAudience)
    : null;
}

/** B-CAREPRO-27 — ONE teacher document. A teacher never receives this
 *  packet's Markdown or print sections: the School Brief is the teacher
 *  egress (per-export approval, curated fields, fail-closed scan, outside-erase
 *  notice — `schoolBrief/schoolBrief.buildSchoolBriefExport`). The teacher
 *  preset still exists: it seeds the brief's free draft (`teacherBriefDraft`)
 *  and caps the `report_teacher` share scope. */
export class TeacherEgressError extends Error {
  constructor() {
    super("A teacher receives the School Brief, never the consult packet text.");
    this.name = "TeacherEgressError";
  }
}

/** Scan the parent note for a non-clinician preset (fail closed). */
function assertNoteAllowed(preset: ConsultPreset, note: string): void {
  if (!preset.clinicalTermScan) return;
  const violation = findClinicalDiagnosisTerm(note);
  if (violation) {
    throw new ClinicalLanguageError(
      violation,
      `Export blocked: clinical-diagnosis term "${violation}" in the parent note is not allowed in a ${preset.audience} export.`
    );
  }
}

/** Serialize a packet for a chosen audience with the parent's note appended
 *  under `noteHeading`. Throws `ClinicalLanguageError` (fail closed — nothing
 *  is returned) when the audience's ceiling or scan is violated. */
export function serializeForExport(
  audience: ExportAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set(),
  note: string = "",
  noteHeading: string = "Parent note",
  lang: UiLang = "en"
): string {
  if (audience === "self") {
    const md = appendParentNote(serializePacket(packet, excludedIds, lang), note, noteHeading);
    assertClinicianExportCeiling(md);
    return md;
  }
  if (audience === "teacher") throw new TeacherEgressError();
  const preset = CONSULT_PRESETS[audience];
  assertNoteAllowed(preset, note);
  const md = appendParentNote(serializePresetPacket(preset.audience, packet, excludedIds, lang), note, noteHeading);
  assertWithinCeiling(preset, md);
  assertClinicianExportCeiling(md);
  return md;
}

/** B-CAREPRO-28 — the PDF twin of `serializeForExport`: the SAME audience,
 *  the same capped sections, the same redaction and the same parent note, as
 *  print-shell sections for `openPrintableReport`. Copy and PDF therefore
 *  carry the same words (consult/exportSeam.test.ts proves it per preset). */
export function exportPrintSections(
  audience: ExportAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set(),
  note: string = "",
  noteHeading: string = "Parent note",
  lang: UiLang = "en"
): PresetPrintSection[] {
  const trimmed = note.trim();
  const noteSection: PresetPrintSection[] = trimmed ? [{ heading: noteHeading, body: [trimmed] }] : [];
  if (audience === "self") {
    const sections: PresetPrintSection[] = [];
    for (const section of packet.sections) {
      const items = section.items.filter((it) => !excludedIds.has(it.id));
      if (items.length === 0) continue;
      const sNote = sectionNote(section, lang);
      sections.push({ heading: sectionTitle(section, lang), body: [...(sNote ? [sNote] : []), ...items.map((it) => itemText(it, lang))] });
    }
    const out = [...sections, ...noteSection];
    assertClinicianExportCeiling(out.flatMap((s) => [s.heading, ...s.body]).join("\n"));
    return out;
  }
  if (audience === "teacher") throw new TeacherEgressError();
  const preset = CONSULT_PRESETS[audience];
  assertNoteAllowed(preset, note);
  const out = [...presetPacketToPrintSections(audience, packet, excludedIds, lang), ...noteSection];
  const text = out.flatMap((s) => [s.heading, ...s.body]).join("\n");
  assertWithinCeiling(preset, text);
  assertClinicianExportCeiling(text);
  return out;
}

/* ── B-CAREPRO-27 — the School Brief's free draft, from the teacher preset ───
 * A Free parent used to meet a paywall before any teacher document existed,
 * while Consult's teacher audience minted a second, deterministic document.
 * Now the brief editor OPENS on this draft — built from the teacher preset's
 * ceiling (about + what the family already tries; never logs, milestones or
 * memory) in the parent's language — and "Draft with Arbor" (Plus) replaces it
 * through /generate-handoff. Any line the clinical-term scan would refuse is
 * left out of the draft (the parent can still type it; the export scan stays
 * the gate). */
export interface TeacherBriefDraft {
  overview: string;
  keyStrengths: string[];
  suggestedTeacherStrategies: string[];
}

export function teacherBriefDraft(input: BuildPacketInput, lang: UiLang = "en"): TeacherBriefDraft {
  const packet = capToPreset(CONSULT_PRESETS.teacher, buildConsultPacket(input));
  const items = (id: string) => packet.sections.find((s) => s.id === id)?.items ?? [];
  const clean = (line: string) => line.trim().length > 0 && !findClinicalDiagnosisTerm(line);
  return {
    // overview ← the teacher preset's "about" lines (strengths have their own list)
    overview: items("about").filter((it) => it.id !== "about-strengths").map((it) => itemText(it, lang)).filter(clean).join(" "),
    // keyStrengths ← the profile's strengths, as the parent wrote them
    keyStrengths: (input.profile.strengths ?? []).filter(clean),
    // suggestedTeacherStrategies ← what the family already tries
    suggestedTeacherStrategies: items("tried").map((it) => itemText(it, lang)).filter(clean),
  };
}
