/**
 * lib/plans/planPrint — B-BOOK-79 door (b): "Print {name}'s plan", the
 * PARENT-ONLY printed copy of an approved Everyday plan. The twin of the book
 * on paper: the title, the approval line, the three steps as the grown-ups do
 * them, the box, every page's line as the child hears it, the pattern's red
 * lines and its sources — rendered on the device from the stored row and the
 * pattern definition (zero calls), delivered through the one print shell
 * (lib/reportExport.deliverPrintableHtml).
 *
 *   · no photo and no hero art: text only — a real photo never reaches paper;
 *   · a diagonal watermark names it a parent copy on every page;
 *   · the data-consent line says whose data it is and how to share it;
 *   · Hebrew is a right-to-left document (dir="rtl"): the pages run in
 *     reading order, right to left, and every line keeps its own direction;
 *   · a COUNT of confirmed nights, never a rate or a verdict.
 */
import { deliverPrintableHtml, slugForFile } from "../reportExport";
import { isolate } from "../i18n";
import { fmtDay } from "../formatDate";
import { getPattern } from "../library/plans/planBooks";
import { planBookFromDoc, type PlanBookDoc } from "../library/plans/planBookDoc";
import { fillHero, heGender, lineFor } from "../library/bookText";
import { planString } from "./planStrings";
import { nightsCount } from "./planWeek";
import type { BookLang, BookReaderChild } from "../library/types";

export interface PlanPrintInput {
  doc: PlanBookDoc;
  child: Pick<BookReaderChild, "name" | "gender">;
  lang: BookLang;
  now: Date;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The whole printable document, or null when the row no longer composes
 *  (a pattern withdrawn, a malformed row) — nothing is printed then. */
export function renderPlanPrintHtml({ doc, child, lang, now }: PlanPrintInput): string | null {
  const book = planBookFromDoc(doc);
  const def = getPattern(doc.pattern);
  if (!book || !def) return null;
  const name = isolate(child.name?.split(" ")[0] || (lang === "he" ? "הילד" : "your child"));
  const gender = heGender(child.gender);
  const s = (key: Parameters<typeof planString>[0], vars?: Record<string, string | number>) => planString(key, lang, vars);
  const dir = lang === "he" ? "rtl" : "ltr";
  const date = fmtDay(new Date(doc.approvedAt), lang);
  const pages = [book.cover, ...book.pages].map((p) => fillHero(lineFor(p.text, lang, gender), name, lang));
  const list = (items: readonly string[]) => `<ol>${items.map((t) => `<li dir="auto">${esc(t)}</li>`).join("")}</ol>`;
  const bullets = (items: readonly string[]) => `<ul>${items.map((t) => `<li dir="auto">${esc(t)}</li>`).join("")}</ul>`;
  const box = book.box?.map((b) => b.label[lang]) ?? [];
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(s("print.title", { name }))}</title>
  <style>
    @page { size: A4; margin: 22mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Nunito', -apple-system, system-ui, sans-serif; color: #29333f; max-width: 720px; margin: 0 auto; padding: 32px 24px; position: relative; }
    .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #69747f; margin: 0 0 6px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .sub { color: #69747f; font-size: 13px; margin: 0 0 4px; }
    .meta { color: #9aa0a8; font-size: 12px; margin: 0 0 22px; }
    section { margin-bottom: 20px; break-inside: avoid; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #1f8a5a; margin: 0 0 8px; }
    p, li { font-size: 14px; line-height: 1.55; }
    ol, ul { margin: 0; padding-inline-start: 22px; }
    li { margin-bottom: 6px; }
    .pages li { padding-inline-start: 4px; }
    .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: -1; }
    .watermark span { transform: rotate(-28deg); font-size: 34px; font-weight: 800; color: #29333f; opacity: .07; white-space: nowrap; }
    .consent { margin-top: 26px; padding: 12px 14px; border: 1px solid #e8edea; border-radius: 10px; color: #29333f; font-size: 12px; }
    .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e8edea; color: #69747f; font-size: 11px; }
    @media print { body { padding: 0; max-width: none; } }
  </style></head><body>
  <div class="watermark" aria-hidden="true"><span>${esc(s("print.watermark", { name }))}</span></div>
  <p class="kicker">${esc(s("print.kicker"))}</p>
  <h1 dir="auto">${esc(s("print.title", { name }))} — ${esc(def.title[lang])}</h1>
  <p class="sub" dir="auto">${esc(def.parentWords[lang])}</p>
  <p class="meta">${esc(s("print.approved", { date, days: doc.durationDays }))} ${esc(s("print.nights", { count: nightsCount(doc) }))}</p>
  <section><h2>${esc(s("print.steps"))}</h2>${list(book.parent.planSteps.map((l) => l[lang]))}</section>
  ${box.length ? `<section><h2>${esc(s("print.box"))}</h2>${bullets(box)}</section>` : ""}
  <section class="pages"><h2>${esc(s("print.pages", { name }))}</h2>${list(pages)}</section>
  <section><h2>${esc(s("print.watchFor"))}</h2>${bullets(book.parent.watchFor.map((w) => w[lang]))}</section>
  <section><h2>${esc(s("print.sources"))}</h2>${bullets(book.parent.sources.map((l) => l[lang]))}</section>
  <p class="consent" dir="auto">${esc(s("print.consent", { name, date: fmtDay(now, lang) }))}</p>
  <p class="footer">${esc(s("print.footer"))}</p>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
  </body></html>`;
}

/** The parent's tap: render on the device, hand to the one print shell. */
export async function openPrintablePlan(input: PlanPrintInput): Promise<void> {
  const html = renderPlanPrintHtml(input);
  if (!html) return;
  const title = planString("print.title", input.lang, { name: input.child.name?.split(" ")[0] || "" });
  await deliverPrintableHtml(html, `${slugForFile(input.doc.pattern)}-${slugForFile(input.child.name ?? "")}.html`, title);
}
