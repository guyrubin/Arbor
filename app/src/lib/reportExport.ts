/**
 * Client-side report export (no external deps). Opens a clean, branded,
 * print-styled document in a new tab and triggers the print dialog, where the
 * parent can "Save as PDF" or print. Content is generated from the child's real
 * data. Every report carries Arbor's non-diagnostic framing.
 */
import { ageLabel } from "./childAge";
import type { ChildProfile, BehaviorLog, ActionPlan } from "../types";
import type { LangObservation } from "../growth/vocabAgg";
import { fmtDay } from "./formatDate";
import { topMomentDisplay } from "../hooks/useWeeklyRecap";

export type ReportSection = { heading: string; body: string | string[] };
export type ReportDoc = {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  /** Optional stylized hero portrait (data: or https URL) shown in the brand
   *  lockup. Only the privacy-safe descriptor avatar should ever be passed here. */
  heroImageUrl?: string;
};

export type ReportContext = {
  child: ChildProfile;
  logs: BehaviorLog[];
  plans: ActionPlan[];
  checkedMilestones: number;
  totalMilestones: number;
  /** Optional stylized hero portrait to anchor the printed document to the child.
   *  Callers pass this ONLY for the descriptor (stylized) avatar — never a real photo. */
  heroImageUrl?: string;
  /** LC-19: the parent's logged language observations (the `langObs` sink) —
   *  the ONLY source for the Language Transition Note's child-specific lines. */
  langObs?: LangObservation[];
};

/* LC-19 — the Language Transition Note is built from the child's record
 * (profile languages + school context + the parent's logged phrases), never
 * from canned sentences presented as observations. The one general block
 * that remains is labelled as Arbor's suggestion on EVERY line, so a teacher
 * can never mistake it for something the parent observed. */
export const GENERAL_SUGGESTION_LABEL = "Suggested by Arbor (general):";
export const SUGGESTED_SCHOOL_PHRASES: readonly string[] = ["“Can you show me?”", "“Take your time.”", "“Would you like a or b?”"];
/** Recent phrases quoted in the note (parent's own words, newest first). */
const LANG_PHRASES_MAX = 6;

/** Professional audiences (IA W4.2) build through the consult preset
 *  serializer (`src/consult/packet.ts`) — audience data ceilings + the
 *  fail-closed clinical scan — and reuse only this module's print shell.
 *  This module itself builds the PARENT's own records. */
export type ProfessionalReportType = "teacher" | "therapist" | "pediatrician" | "slp" | "behavioral_health";
export type ParentReportType = "weekly" | "snapshot" | "behavior" | "language" | "growth";
export type ReportType = ParentReportType | ProfessionalReportType;

const PROFESSIONAL_REPORT_TYPES: readonly ProfessionalReportType[] = ["teacher", "therapist", "pediatrician", "slp", "behavioral_health"];

export function isProfessionalReportType(type: ReportType): type is ProfessionalReportType {
  return (PROFESSIONAL_REPORT_TYPES as readonly string[]).includes(type);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function recentLogs(logs: BehaviorLog[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return logs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
}
// Clinical firewall (JRNL-1): parent reports carry counts, never a derived
// intensity score — the former avg-intensity helper is intentionally gone.
function resolvedCount(logs: BehaviorLog[]) {
  return logs.filter((l) => l.resolved).length;
}
/* F-11 quarantine (E7 parity with WeeklyTab, via the SHARED topMomentDisplay
 * from hooks/useWeeklyRecap — imported, never duplicated): this document
 * leaves the app, so the two axes must never blur here either.
 *   · behaviorType (schema vocabulary) may print as a computed stat line;
 *   · the parent's free-typed trigger prints QUOTED + truncated
 *     (TRIGGER_QUOTE_MAX), visibly parent words — never a computed stat. */
function modeOf(m: Map<string, number>) {
  let top = "", max = 0;
  m.forEach((v, k) => { if (v > max) { max = v; top = k; } });
  return top;
}
function topMomentLines(logs: BehaviorLog[]): string[] {
  const typeCounts = new Map<string, number>();
  const triggerCounts = new Map<string, number>();
  logs.forEach((l) => {
    const type = (l.behaviorType || "").trim();
    if (type) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    const trig = (l.trigger || "").trim();
    if (trig) triggerCounts.set(trig, (triggerCounts.get(trig) || 0) + 1);
  });
  const topBehaviorType = modeOf(typeCounts);
  const top = topMomentDisplay({
    topTrigger: modeOf(triggerCounts),
    ...(topBehaviorType ? { topBehaviorType } : {}),
  });
  const lines = [`Most-logged: ${top.type || "—"}`];
  if (top.quote) lines.push(`Often-noted trigger, in the parent's words: “${top.quote}”`);
  return lines;
}
/** One event line: behaviorType as the label, the parent's free-typed trigger
 *  quoted + truncated through the same shared quarantine helper. */
function eventLine(l: BehaviorLog): string {
  const m = topMomentDisplay({ topTrigger: l.trigger || "", topBehaviorType: l.behaviorType });
  return `${fmtDay(l.timestamp, "en")} — ${m.type || l.behaviorType}${m.quote ? ` — parent noted: “${m.quote}”` : ""}`;
}

export function buildReport(type: ParentReportType, ctx: ReportContext): ReportDoc {
  return { ...buildReportBody(type, ctx), heroImageUrl: ctx.heroImageUrl };
}

function buildReportBody(type: ParentReportType, ctx: ReportContext): ReportDoc {
  const { child, logs, plans, checkedMilestones, totalMilestones } = ctx;
  const wk = recentLogs(logs, 7);
  const mo = recentLogs(logs, 28);
  const common = `${child.name}, ${ageLabel(child)}`;

  switch (type) {
    case "weekly":
      return { title: "Weekly Insight", subtitle: common, sections: [
        { heading: "This week", body: [`${wk.length} moments logged`, `${resolvedCount(wk)} marked resolved`, ...topMomentLines(wk)] },
        { heading: "Development", body: [`${checkedMilestones} of ${totalMilestones} age-appropriate milestones noticed`] },
        { heading: "Suggested focus", body: child.challenges.slice(0, 2) },
      ]};
    case "snapshot":
      return { title: "Development Snapshot", subtitle: common, sections: [
        { heading: "At a glance", body: [`${ageLabel(child)}`, `${checkedMilestones} of ${totalMilestones} age-appropriate milestones noticed`] },
        { heading: "Strengths", body: child.strengths },
        { heading: "Where to support", body: child.challenges },
        { heading: "Languages", body: child.languages.join(" · ") },
      ]};
    case "behavior":
      return { title: "Behavior Pattern Report", subtitle: common, sections: [
        { heading: "Summary (28 days)", body: [`${mo.length} moments`, `${resolvedCount(mo)} marked resolved`, ...topMomentLines(mo)] },
        { heading: "Recent events", body: mo.slice(0, 8).map(eventLine) },
        { heading: "What helped", body: mo.map((l) => l.response).filter(Boolean).slice(0, 5) },
      ]};
    case "language": {
      // LC-19: child-specific lines come ONLY from the record — profile
      // languages/school context, the parent's language-related focus areas,
      // and the parent's logged phrases (counts per language + quoted words).
      // Empty data → empty bodies (the print shell renders "—"), never a
      // filler sentence about the child.
      const obs = (ctx.langObs ?? []).filter((o) => (o.phrase || "").trim() && (o.language || "").trim());
      const byLang = new Map<string, number>();
      for (const o of obs) byLang.set(o.language.trim(), (byLang.get(o.language.trim()) ?? 0) + 1);
      const perLanguage = [...byLang.entries()].map(([lang, n]) => `${lang}: ${n} word${n === 1 ? "" : "s"} or phrase${n === 1 ? "" : "s"} the parent has noticed`);
      const recent = [...obs]
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, LANG_PHRASES_MAX)
        .map((o) => `${o.language.trim()}, in the parent's words: “${o.phrase.trim()}”`);
      const languageFocus = child.challenges.filter((c) => /language|english|hebrew|dutch|speak|speech|talk|word|vocab/i.test(c));
      return { title: "Language Transition Note", subtitle: common, sections: [
        { heading: "Languages at home", body: child.languages.join(" · ") },
        { heading: "School context", body: child.schoolContext },
        { heading: "Words and phrases the parent has noticed", body: [...perLanguage, ...recent] },
        { heading: "Where the parent asks for support", body: languageFocus },
        { heading: "Phrases that help at school", body: SUGGESTED_SCHOOL_PHRASES.map((p) => `${GENERAL_SUGGESTION_LABEL} ${p}`) },
      ]};
    }
    case "growth":
      return { title: "Growth Plan Progress", subtitle: common, sections: plans.length ? plans.map((p) => {
        const steps = p.phases.flatMap((ph) => ph.steps);
        const done = steps.filter((s) => s.completed).length;
        return { heading: p.title, body: [`${done}/${steps.length} steps complete`, ...steps.slice(0, 6).map((s) => `${s.completed ? "✓" : "○"} ${s.text}`)] };
      }) : [{ heading: "No active plans", body: "Create a Growth Plan to track progress here." }] };
  }
}

/**
 * Native check WITHOUT importing the Capacitor runtime. reportExport is pulled
 * in by many surfaces, and a static @capacitor/core import here dragged the
 * runtime into their module graphs (it timed out AskSpecialist's render test at
 * import). lib/share.ts avoids the same import for the same reason. The WebView
 * injects this global; a browser or test env simply gets false.
 */
const isNativeRuntime = (): boolean => {
  try {
    const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
  } catch {
    return false;
  }
};

/**
 * Export the report.
 *
 * MOB-06: this used to be `window.open` + `window.print()` with a hardcoded
 * English `alert()` on failure. Inside the Capacitor WebView `window.open`
 * yields no printable window and `window.print` does nothing, so on mobile the
 * whole feature was dead and the only feedback was an untranslated pop-up
 * warning. Now: native shares the report file through the existing
 * @capacitor/share pipeline, and web falls back to downloading the same file
 * when the print window is blocked — no alert, no dead end, nothing to
 * translate. Never rejects; callers may fire-and-forget as before.
 */
export async function openPrintableReport(doc: ReportDoc, childName: string): Promise<void> {
  const html = renderPrintableHtml(doc, childName);
  const filename = `${slugForFile(doc.title)}-${slugForFile(childName)}.html`;

  if (isNativeRuntime()) {
    try {
      const [{ Share }, { Filesystem, Directory, Encoding }] = await Promise.all([
        import("@capacitor/share"),
        import("@capacitor/filesystem"),
      ]);
      const written = await Filesystem.writeFile({
        path: filename, data: html, directory: Directory.Cache, encoding: Encoding.UTF8,
      });
      await Share.share({ title: doc.title, files: [written.uri] });
      return;
    } catch {
      /* fall through to the browser path below */
    }
  }

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    // Popup blocked: hand the parent the file instead of a dead-end alert.
    try {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { /* nothing further we can honestly offer */ }
    return;
  }
  w.document.write(html);
  w.document.close();
}

/** Filesystem-safe slug; keeps the report name recognisable in a share sheet.
 *  Fallback is hyphenated on purpose: a bare lowercase word that happens to be
 *  a Material Symbols ligature trips the icon-subset guard as a phantom icon. */
const slugForFile = (value: string) =>
  (value || "arbor-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "arbor-report";

function renderPrintableHtml(doc: ReportDoc, childName: string): string {
  const sectionsHtml = doc.sections.map((s) => {
    const items = Array.isArray(s.body) ? s.body.filter(Boolean) : [s.body];
    const body = items.length
      ? (Array.isArray(s.body)
          ? `<ul>${items.map((i) => `<li>${esc(String(i))}</li>`).join("")}</ul>`
          : `<p>${esc(String(items[0]))}</p>`)
      : `<p class="muted">—</p>`;
    return `<section><h2>${esc(s.heading)}</h2>${body}</section>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(childName)}</title>
  <style>
    @page { margin: 24mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Nunito', -apple-system, system-ui, sans-serif; color: #29333f; max-width: 720px; margin: 0 auto; padding: 32px 24px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom: 4px; }
    .brand .dot { width:24px; height:24px; border-radius:7px; background:#e4f4ec; display:inline-flex; align-items:center; justify-content:center; color:#2a9c66; font-weight:800; }
    .brand .hero { width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid #e4f4ec; background:#fff; }
    .brand b { font-size: 15px; }
    h1 { font-size: 26px; margin: 12px 0 2px; }
    .sub { color:#69747f; font-size: 13px; margin: 0 0 6px; }
    .meta { color:#9aa0a8; font-size: 11px; margin-bottom: 20px; }
    section { margin-bottom: 18px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color:#1f8a5a; margin: 0 0 6px; }
    p, li { font-size: 14px; line-height: 1.55; }
    ul { margin: 0; padding-left: 18px; }
    .muted { color:#9aa0a8; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e8edea; color:#69747f; font-size: 11px; }
    @media print { .noprint { display:none; } }
  </style></head><body>
  <div class="brand">${doc.heroImageUrl
    ? `<img class="hero" src="${doc.heroImageUrl}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="dot">A</span>`}<b>Arbor — Development Fieldbook</b></div>
  <h1>${esc(doc.title)}</h1>
  ${doc.subtitle ? `<p class="sub">${esc(doc.subtitle)}</p>` : ""}
  <p class="meta">Generated ${fmtDay(new Date(), "en")} · Parent-prepared · Non-diagnostic</p>
  ${sectionsHtml}
  <div class="footer">Arbor is non-diagnostic and does not replace professional advice. This report reflects parent observations and is shared with the parent's consent.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
  </body></html>`;
}
