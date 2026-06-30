import React from "react";
import { DOMAIN_META } from "../../practice/content";
import type { PracticeDomain } from "../../types";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Per-domain milestone overview (Epic 1 "visual dashboard").
 *
 * CLINICAL FIREWALL (Wave-3 pattern): this renders a COUNT of parent-noticed
 * milestones per domain — never a 0–100 "signal", polygon, ring, percentage, or
 * any verdict on the child. The count register is the only quantity the firewall
 * allows: a parent-owned tally ("{reached} of {total} noticed"), not a competence
 * score. Self-contained — no chart dependency.
 */
export interface DomainNoticedCount {
  domain: PracticeDomain;
  /** Milestones the parent has noticed (checked) in this domain. */
  reached: number;
  /** Total milestones in this domain's checklist. */
  total: number;
}

export default function DomainRadar({ counts }: { counts: DomainNoticedCount[] }) {
  const { t } = useLanguage();

  return (
    <ul className="space-y-2.5" role="list" aria-label={t("aria.domainRadar")}>
      {counts.map((c) => {
        const meta = DOMAIN_META[c.domain];
        return (
          <li
            key={c.domain}
            className="flex items-center justify-between gap-3 rounded-xl p-3"
            style={{ background: meta.soft }}
            aria-label={t("devscore.noticed.aria", { domain: meta.label, reached: c.reached, total: c.total })}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} aria-hidden />
              <span className="text-[12px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
            </span>
            <span className="text-end">
              <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                {c.reached} / {c.total}
              </span>
              <span className="block text-[10px]" style={{ color: "var(--arbor-muted)" }}>
                {t("devscore.noticed.short")}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
