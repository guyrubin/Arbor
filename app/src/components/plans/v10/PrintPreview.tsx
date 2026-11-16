import React, { useMemo } from "react";
import { Icon } from "../../ui/Icon";
import { planString } from "../../../lib/plans/planStrings";
import { renderPlanPrintHtml, type PlanPrintInput } from "../../../lib/plans/planPrint";
import { plansCopy } from "./plansCopy";

/**
 * CP-6, the parent copy: the page that will come out, shown before the print
 * dialog — the same HTML openPrintablePlan prints (words only: no photo, no
 * picture of the child, no grade), in a sandboxed frame that runs no script.
 * Parent register; the child never sees it.
 */
export function PrintPreview({ input, childName, lang, onPrint }: { input: PlanPrintInput; childName: string; lang: "en" | "he"; onPrint: () => void }) {
  const c = plansCopy(lang);
  // The print shell's own script (it opens the print dialog) has no place in a preview.
  const html = useMemo(() => renderPlanPrintHtml(input)?.replace(/<script[\s\S]*?<\/script>/gi, "") ?? null, [input]);
  const label = planString("stage.approved.print", lang, { name: childName });
  return (
    <section className="stack ds-col" style={{ gap: 14, maxWidth: 760, marginInline: "auto", width: "100%" }} data-plan-print-preview="">
      <div className="stack ds-col" style={{ gap: 6 }}>
        <h1 className="cp-h">{label}</h1>
        <p className="cp-lede">{c.printLede(childName)}</p>
      </div>
      {html ? (
        <div className="cp-paper ds-plans-paper">
          <iframe title={label} srcDoc={html} sandbox="" className="ds-plans-paper-frame" />
        </div>
      ) : (
        <p className="cp-lede" role="status">{c.printUnavailable}</p>
      )}
      <button type="button" className="btn primary block" style={{ minHeight: 52 }} disabled={!html} onClick={onPrint} data-plan-print-go="">
        <Icon name="description" size={18} />
        {label}
      </button>
    </section>
  );
}
