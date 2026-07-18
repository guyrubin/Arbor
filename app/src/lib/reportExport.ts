/**
 * Client-side report export (no external deps). Opens a clean, branded,
 * print-styled document in a new tab and triggers the print dialog, where the
 * parent can "Save as PDF" or print. Content is generated from the child's real
 * data. Every report carries Arbor's non-diagnostic framing.
 */
import type { ChildProfile, BehaviorLog, ActionPlan } from "../types";

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
};

/** Professional audiences (IA W4.2) build through the consult preset
 *  serializer (`src/consult/packet.ts`) — audience data ceilings + the
 *  fail-closed clinical scan — and reuse only this module's print shell.
 *  This module itself builds the PARENT's own records. */
export type ProfessionalReportType = "teacher" | "therapist" | "pediatrician";
export type ParentReportType = "weekly" | "snapshot" | "behavior" | "language" | "growth";
export type ReportType = ParentReportType | ProfessionalReportType;

export function isProfessionalReportType(type: ReportType): type is ProfessionalReportType {
  return type === "teacher" || type === "therapist" || type === "pediatrician";
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function recentLogs(logs: BehaviorLog[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return logs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
}
function avgIntensity(logs: BehaviorLog[]) {
  return logs.length ? (logs.reduce((s, l) => s + l.intensity, 0) / logs.length).toFixed(1) : "—";
}
function topTrigger(logs: BehaviorLog[]) {
  const c = new Map<string, number>();
  logs.forEach((l) => c.set(l.behaviorType, (c.get(l.behaviorType) || 0) + 1));
  let top = "—", max = 0;
  c.forEach((v, k) => { if (v > max) { max = v; top = k; } });
  return top;
}

export function buildReport(type: ParentReportType, ctx: ReportContext): ReportDoc {
  return { ...buildReportBody(type, ctx), heroImageUrl: ctx.heroImageUrl };
}

function buildReportBody(type: ParentReportType, ctx: ReportContext): ReportDoc {
  const { child, logs, plans, checkedMilestones, totalMilestones } = ctx;
  const wk = recentLogs(logs, 7);
  const mo = recentLogs(logs, 28);
  const common = `${child.name}, age ${child.age}`;

  switch (type) {
    case "weekly":
      return { title: "Weekly Insight", subtitle: common, sections: [
        { heading: "This week", body: [`${wk.length} moments logged`, `Average intensity: ${avgIntensity(wk)} / 5`, `Most-logged: ${topTrigger(wk)}`] },
        { heading: "Development", body: [`${checkedMilestones} of ${totalMilestones} age-appropriate milestones noticed`] },
        { heading: "Suggested focus", body: child.challenges.slice(0, 2) },
      ]};
    case "snapshot":
      return { title: "Development Snapshot", subtitle: common, sections: [
        { heading: "At a glance", body: [`Age ${child.age}`, `${checkedMilestones} of ${totalMilestones} age-appropriate milestones noticed`] },
        { heading: "Strengths", body: child.strengths },
        { heading: "Where to support", body: child.challenges },
        { heading: "Languages", body: child.languages.join(" · ") },
      ]};
    case "behavior":
      return { title: "Behavior Pattern Report", subtitle: common, sections: [
        { heading: "Summary (28 days)", body: [`${mo.length} moments`, `Average intensity ${avgIntensity(mo)} / 5`, `Most-logged: ${topTrigger(mo)}`] },
        { heading: "Recent events", body: mo.slice(0, 8).map((l) => `${new Date(l.timestamp).toLocaleDateString()} — ${l.behaviorType} (${l.intensity}/5)${l.trigger ? `, trigger: ${l.trigger}` : ""}`) },
        { heading: "What helped", body: mo.map((l) => l.response).filter(Boolean).slice(0, 5) },
      ]};
    case "language":
      return { title: "Language Transition Note", subtitle: common, sections: [
        { heading: "Languages at home", body: child.languages.join(" · ") },
        { heading: "School context", body: child.schoolContext },
        { heading: "Comfort & gaps", body: child.challenges.filter((c) => /language|english|speak|word/i.test(c)).concat(["Emotional vocabulary still developing"]) },
        { heading: "Useful school phrases", body: ["“Can you show me?”", "“Take your time.”", "“Would you like a or b?”"] },
        { heading: "Parent support plan", body: ["Pair new English words with familiar home-language anchors", "Celebrate attempts, not just correctness"] },
      ]};
    case "growth":
      return { title: "Growth Plan Progress", subtitle: common, sections: plans.length ? plans.map((p) => {
        const steps = p.phases.flatMap((ph) => ph.steps);
        const done = steps.filter((s) => s.completed).length;
        return { heading: p.title, body: [`${done}/${steps.length} steps complete`, ...steps.slice(0, 6).map((s) => `${s.completed ? "✓" : "○"} ${s.text}`)] };
      }) : [{ heading: "No active plans", body: "Create a Growth Plan to track progress here." }] };
  }
}

export function openPrintableReport(doc: ReportDoc, childName: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    alert("Please allow pop-ups to export the report, then try again.");
    return;
  }
  const sectionsHtml = doc.sections.map((s) => {
    const items = Array.isArray(s.body) ? s.body.filter(Boolean) : [s.body];
    const body = items.length
      ? (Array.isArray(s.body)
          ? `<ul>${items.map((i) => `<li>${esc(String(i))}</li>`).join("")}</ul>`
          : `<p>${esc(String(items[0]))}</p>`)
      : `<p class="muted">—</p>`;
    return `<section><h2>${esc(s.heading)}</h2>${body}</section>`;
  }).join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(childName)}</title>
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
  <p class="meta">Generated ${new Date().toLocaleDateString()} · Parent-prepared · Non-diagnostic</p>
  ${sectionsHtml}
  <div class="footer">Arbor is non-diagnostic and does not replace professional advice. This report reflects parent observations and is shared with the parent's consent.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
  </body></html>`);
  w.document.close();
}
