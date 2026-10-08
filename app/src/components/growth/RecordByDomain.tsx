import React, { useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { summariseByDomain, type Observation } from "../../lib/observations";
import { domainName, domainInline, type DomainId } from "../../lib/domains/registry";
import { recordObservationText } from "../../lib/recordObservationText";
import { fmtDay } from "../../lib/formatDate";
import { parentWords } from "../../lib/recordCounts";

// Equal weight and one neutral palette: selection is navigation, never a verdict.
const DOMAIN_GLYPHS: Record<DomainId, string> = {
  talking: "forum", moving: "directions_run", hands: "front_hand", thinking: "school",
  playing: "group", feelings: "favorite", body: "bedtime", family: "home",
};
const SHEET_MAX = 20;

export default function RecordByDomain() {
  const { childProfile, milestones = [], behaviorLogs = [], setActiveTab, seedCoach } = useArbor();
  const { t, uiLang } = useLanguage();
  const observations = useObservations();
  const [selection, setSelection] = useState<{ childId: string; domain: DomainId } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const firstName = (childProfile.name || "").split(" ")[0];
  const rows = useMemo(() => summariseByDomain(observations), [observations]);
  const byDomain = useMemo(() => {
    const map = new Map<DomainId, Observation[]>();
    for (const observation of observations) for (const domain of observation.domains) {
      const items = map.get(domain) ?? [];
      items.push(observation);
      map.set(domain, items);
    }
    return map;
  }, [observations]);
  const milestoneById = useMemo(() => new Map(milestones.map((m) => [m.id, m])), [milestones]);
  const momentById = useMemo(() => new Map(behaviorLogs.map((m) => [`behaviorLogs:${m.id}`, m])), [behaviorLogs]);
  // Registry order, never the busiest area. Child switches cannot retain stale evidence.
  const open = selection?.childId === childProfile.id && rows.some((r) => r.domain === selection.domain)
    ? selection.domain : rows[0]?.domain;
  const entries = open ? byDomain.get(open) ?? [] : [];
  const latest = entries[0];
  const label = (observation: Observation) => recordObservationText(observation, {
    t, locale: uiLang === "he" ? "he" : "en", childName: firstName, gender: childProfile.gender,
    milestone: observation.value.type === "milestone" ? milestoneById.get(observation.value.milestoneId) : undefined,
    parentNote: momentById.has(observation.id) ? parentWords(momentById.get(observation.id)!) ?? undefined : undefined,
  });
  const latestLabel = latest ? label(latest) : null;
  const photo = latest ? momentById.get(latest.id)?.photoAttachment : undefined;
  const selectDomain = (domain: DomainId) => {
    setSelection({ childId: childProfile.id, domain });
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => detailRef.current?.focus());
    }
  };

  return (
    <div data-testid="record-by-domain">
      {rows.length === 0 ? (
        <div className="flex items-start gap-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--arbor-paper-deep)" }}>
          <Icon name="auto_stories" size={32} style={{ color: "var(--arbor-muted)" }} />
          <p className="t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }} data-testid="record-by-domain-empty">{t("elev.growth.record.empty")}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 max-w-2xl t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.record.sub")}</p>
          <div className="record-portrait-grid">
            <ul className="record-portrait-areas" aria-label={t("elev.growth.record.areas")}>
              {rows.map((row) => {
                const selected = open === row.domain;
                return (
                  <li key={row.domain} data-testid="record-domain-row" data-domain={row.domain} className="min-w-0">
                    <button type="button" aria-pressed={selected} aria-controls="record-area-detail"
                      aria-label={`${domainName(row.domain, t)} ${row.count4w > 0 ? t(row.count4w === 1 ? "elev.growth.record.count.one" : "elev.growth.record.count.many", { n: row.count4w }) : ""}`}
                      onClick={() => selectDomain(row.domain)}
                      className="record-portrait-area h-full min-h-11 w-full rounded-[var(--r)] p-3 text-start transition"
                      style={{ background: selected ? "var(--arbor-paper-deep)" : "var(--arbor-paper-elevated)", border: `1px solid ${selected ? "var(--arbor-ink)" : "var(--arbor-rule)"}` }}>
                      <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[var(--r)]" aria-hidden="true" style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)" }}>
                        <Icon name={DOMAIN_GLYPHS[row.domain]} size={23} weight={400} fill={selected ? 1 : 0} />
                      </span>
                      <span className="min-w-0">
                        <span className="block t-base font-semibold leading-snug" style={{ color: "var(--arbor-ink)" }}>{domainName(row.domain, t)}</span>
                        {row.count4w > 0 && <span className="mt-1 block t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.record.compactCount", { n: row.count4w })}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {open && latest && latestLabel && (
              <div ref={detailRef} id="record-area-detail" role="region" aria-labelledby="record-area-title" tabIndex={-1}
                className="record-portrait-detail min-w-0 scroll-mt-36 rounded-[var(--r-xl)] p-5"
                style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
                <p className="arbor-type-kicker" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.record.detail.eyebrow")}</p>
                <h3 id="record-area-title" className="arbor-type-title mt-2" style={{ color: "var(--arbor-ink)" }}>{domainName(open, t)}</h3>
                <p className="mt-2 t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(`elev.growth.record.description.${open}`)}</p>
                <div key={`${childProfile.id}:${open}`} className="mt-5" data-testid="record-domain-sheet">
                  <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.growth.record.latestDate", { date: fmtDay(latest.at, uiLang) })}</p>
                  {photo && <img src={photo} alt={t("elev.growth.record.photo")} className="mt-3 max-h-52 w-full rounded-[var(--r-lg)] object-cover" loading="lazy" />}
                  <p className="arbor-type-say mt-3 break-words" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{latestLabel.ownWords ? t("elev.loop.ms.quoted", { text: latestLabel.text }) : latestLabel.text}</bdi></p>
                  <p className="mt-3 t-sm" style={{ color: "var(--arbor-muted)" }}>{t(latest.kind === "practice" ? "elev.growth.record.source.practice" : "elev.growth.record.source.saved")}</p>
                  {entries.length > 1 && (
                    <details className="mt-5 border-t pt-3" style={{ borderColor: "var(--arbor-rule)" }}>
                      <summary className="flex min-h-11 cursor-pointer items-center gap-2 t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growth.record.earlier")}<Icon name="expand_more" size={18} /></summary>
                      <ul className="mt-2 space-y-4">
                        {entries.slice(1, SHEET_MAX).map((observation) => <li key={observation.id} className="border-s ps-3" style={{ borderColor: "var(--arbor-rule-strong)" }}>
                          <time dateTime={observation.at} className="block t-sm" style={{ color: "var(--arbor-muted)" }}>{fmtDay(observation.at, uiLang)}</time>
                          <p className="mt-1 t-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{label(observation).text}</bdi></p>
                        </li>)}
                      </ul>
                    </details>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3" style={{ borderColor: "var(--arbor-rule)" }}>
                  <button type="button" onClick={() => setActiveTab("milestones")} className="inline-flex min-h-11 items-center gap-1.5 t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}><Icon name="edit_note" size={18} />{t("elev.growth.record.sheet.milestones")}</button>
                  <button type="button" data-testid="record-domain-ask" onClick={() => seedCoach({ prompt: t("elev.growth.record.ask.seed", { name: firstName, domain: domainInline(open, t) }), source: "record-domain" })}
                    className="inline-flex min-h-11 items-center gap-1.5 text-start t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}><Icon name="forum" size={18} />{t("elev.growth.record.sheet.ask", { domain: domainName(open, t) })}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
