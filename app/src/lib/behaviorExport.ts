/**
 * B-ASKJB-14 — the behaviour-log PDF export, moved out of BehaviorsTab so the
 * Journal's "Hard moments" view prints the SAME document Behaviors prints.
 *
 * `buildBehaviorExportHtml` is pure (snapshot-tested); `exportBehaviorPdf`
 * opens the print window. The printed report keeps its own static palette —
 * design tokens don't apply to the export window (m3-hex-sweep skip).
 * Every log field is HTML-escaped (the `context` column used to go in raw).
 */
import { escapeHtml } from "./behaviorUtils";
import { fmtDayTime } from "./formatDate";
import type { UiLang } from "./i18n";
import type { BehaviorLog } from "../types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type BehaviorExportRow = Pick<BehaviorLog, "timestamp" | "behaviorType" | "intensity" | "durationMinutes" | "resolved" | "trigger"> &
  Partial<Pick<BehaviorLog, "context" | "response">>;

export function buildBehaviorExportHtml(
  logs: readonly BehaviorExportRow[],
  opts: { t: Translate; lang: UiLang; now?: number },
): string {
  const { t, lang } = opts;
  const rows = logs
    .map(
      (l) =>
        `<tr><td>${escapeHtml(fmtDayTime(l.timestamp, lang))}</td><td>${escapeHtml(l.behaviorType)}</td><td>${escapeHtml(l.context || "")}</td><td>${l.intensity}/5</td><td>${l.durationMinutes}m</td><td>${l.resolved ? t("beh.resolved") : t("beh.open")}</td><td>${escapeHtml(l.trigger)}</td><td>${escapeHtml(l.response ?? "")}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><title>${t("beh.pdf.title")}</title>
      <style>body{font-family:Georgia,serif;color:#14160f;padding:32px} h1{font-size:20px} table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px} th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top} th{background:#f0ece0}</style>
      </head><body>
      <h1>${t("beh.pdf.heading")}</h1>
      <p>${t("beh.pdf.generated", { date: fmtDayTime(opts.now ?? Date.now(), lang), n: logs.length })}</p>
      <table><thead><tr><th>${t("beh.pdf.col.when")}</th><th>${t("beh.pdf.col.type")}</th><th>${t("beh.pdf.col.where")}</th><th>${t("beh.pdf.col.intensity")}</th><th>${t("beh.pdf.col.duration")}</th><th>${t("beh.pdf.col.status")}</th><th>${t("beh.triggerField")}</th><th>${t("beh.parentAction")}</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`;
}

/** Open the print window with the export (no-op when a popup is blocked). */
export function exportBehaviorPdf(logs: readonly BehaviorExportRow[], opts: { t: Translate; lang: UiLang }): void {
  const html = buildBehaviorExportHtml(logs, opts);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
