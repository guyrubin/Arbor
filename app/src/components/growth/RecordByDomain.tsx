import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { summariseByDomain, type Observation } from "../../lib/observations";
import { domainName, domainInline, type DomainId } from "../../lib/domains/registry";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { fmtDay } from "../../lib/formatDate";

/**
 * B-GROWTH-30 — "What we know about {name}, by area" (spine Option A).
 *
 * The child's record regrouped by the ONE domain registry: one row per domain
 * that has at least one observation — its name, how many things were noticed
 * in the last 4 weeks, the latest dated item. Tapping a row opens that area's
 * dated list, a door to its milestones and "Ask Arbor about {area}".
 *
 * CLINICAL FIREWALL (spine §9 verdict creep): counts of parent-noticed things
 * and dates only. Rows follow REGISTRY order, never count order; a domain with
 * nothing noticed is not listed (an empty row reads as a gap); no %, no
 * "of {total}", no trend glyph, no chart, no colour per domain — every row
 * wears the same paper. Guarded by firewall.childRecordFill.test.ts and
 * chromaticVerdict.firewall.test.ts.
 */

const SHEET_MAX = 20;

export default function RecordByDomain() {
  const { childProfile, setActiveTab, seedCoach } = useArbor();
  const { t, uiLang } = useLanguage();
  const observations = useObservations();
  const [open, setOpen] = useState<DomainId | null>(null);
  const firstName = (childProfile.name || "").split(" ")[0];

  const rows = useMemo(() => summariseByDomain(observations), [observations]);
  const byDomain = useMemo(() => {
    const m = new Map<DomainId, Observation[]>();
    for (const o of observations) for (const d of o.domains) m.set(d, [...(m.get(d) ?? []), o]);
    return m;
  }, [observations]);

  const itemLabel = (o: Observation): string => {
    const v = o.value;
    switch (v.type) {
      case "moment": return behaviorTypeLabel(v.behaviorType, t);
      case "milestone": return v.title;
      case "keepsake": return v.note;
      case "measurement": return t("elev.growth.record.item.measurement");
      case "word": return t("elev.growth.record.item.word", { phrase: v.phrase, language: v.language });
      case "goal_note": return v.text;
      case "check": return t("elev.growth.record.item.check");
      case "play": return v.title;
      case "practice": return t("elev.growth.record.item.practice");
      case "fact": return v.fact;
    }
  };

  return (
    <section
      data-module="growth-record"
      data-testid="record-by-domain"
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      aria-labelledby="record-by-domain-title"
    >
      <h2 id="record-by-domain-title" className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
        {t("elev.growth.record.title", { name: firstName })}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--arbor-muted)" }} data-testid="record-by-domain-empty">
          {t("elev.growth.record.empty")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.record.sub")}</p>
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--arbor-rule)" }}>
            {rows.map((row) => {
              const list = byDomain.get(row.domain) ?? [];
              const latest = list[0];
              const isOpen = open === row.domain;
              const name = domainName(row.domain, t);
              return (
                <li key={row.domain} data-testid="record-domain-row" data-domain={row.domain} style={{ borderColor: "var(--arbor-rule)" }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`record-sheet-${row.domain}`}
                    onClick={() => setOpen(isOpen ? null : row.domain)}
                    className="flex min-h-11 w-full items-start gap-3 py-3 text-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{name}</span>
                      {row.count4w > 0 && (
                        <span className="block text-[12.5px]" style={{ color: "var(--arbor-ink)" }}>
                          {row.count4w === 1
                            ? t("elev.growth.record.count.one")
                            : t("elev.growth.record.count.many", { n: row.count4w })}
                        </span>
                      )}
                      {latest && (
                        <span className="block truncate text-[12px]" style={{ color: "var(--arbor-muted)" }}>
                          {t("elev.growth.record.latest", { item: itemLabel(latest), date: fmtDay(latest.at, uiLang) })}
                        </span>
                      )}
                    </span>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} size={20} style={{ color: "var(--arbor-muted)" }} />
                  </button>
                  {isOpen && (
                    <div id={`record-sheet-${row.domain}`} data-testid="record-domain-sheet" className="pb-3">
                      <ul className="space-y-1.5">
                        {list.slice(0, SHEET_MAX).map((o) => (
                          <li key={o.id} className="flex items-baseline gap-2 text-[13px]" style={{ color: "var(--arbor-ink)" }}>
                            <span className="flex-shrink-0 text-[12px] tabular-nums" style={{ color: "var(--arbor-muted)" }}>{fmtDay(o.at, uiLang)}</span>
                            <span className="min-w-0 break-words">{itemLabel(o)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("milestones")}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold"
                          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                        >
                          {t("elev.growth.record.sheet.milestones")}
                        </button>
                        <button
                          type="button"
                          data-testid="record-domain-ask"
                          onClick={() => seedCoach({
                            prompt: t("elev.growth.record.ask.seed", { name: firstName, domain: domainInline(row.domain, t) }),
                            source: "record-domain",
                          })}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold"
                          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                        >
                          <Icon name="forum" size={16} />
                          {t("elev.growth.record.sheet.ask", { domain: name })}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
