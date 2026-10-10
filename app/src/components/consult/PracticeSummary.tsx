import React, { useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { usePracticeData } from "../../practice/usePracticeData";
import { domainBands } from "../../practice/signals";
import { watchSignals } from "../../practice/watch";
import { ageYearsOf } from "../../lib/age/forChild";
import { domainLabelEn } from "../../lib/domains/registry";
import type { ScreeningResult } from "../../lib/screening";
import { buildClinicianSummary } from "../../consult/clinicianSummary";
import { useConsultEgress, type ConsultEgressGuard } from "../../consult/egressGuard";
import { Icon } from "../ui/Icon";

/** B-GROWTH-22: the retired Full Picture's existing summary, behind one
 * secondary Consult disclosure. No extra packet, provider, writer or AI door.
 * The surrounding Consult owns the active account/child/target lifetime. */
export default function PracticeSummary({ egressGuard }: { egressGuard: ConsultEgressGuard }) {
  const { childProfile, milestones, behaviorLogs, consultRecordSources } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id, true);
  const screenings = useChildCollection<ScreeningResult & { id: string }>(childProfile.id, "screenings", { trackConfirmation: true });
  const sources = [data.speech, data.mimic, data.missions, data.adventures, data.events, screenings, consultRecordSources?.milestones, consultRecordSources?.behaviorLogs];
  const ready = sources.every(source => source?.loaded && !source.error && source.confirmed);
  const egress = useConsultEgress(egressGuard);
  const [openReceipt, setOpenReceipt] = useState<object | null>(null);
  const currentOpen = useRef<object | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const summary = useMemo(() => {
    if (!ready) return { clinicianSummary: null, previewSummary: null };
    const bands = domainBands(milestones, data.speech.items, data.missions.items, data.adventures.items, data.events.items);
    const lastScreening = [...screenings.items].sort((a, b) => a.answeredAt < b.answeredAt ? 1 : -1)[0];
    const advCount = data.adventures.items.length;
    const watch = watchSignals({
      age: ageYearsOf(childProfile),
      screeningWatchLabels: lastScreening?.watchAreas.map(area => ({ domain: area.domain, label: domainLabelEn("screen", area.domain) })) ?? [],
      logs: behaviorLogs, stats: data.stats, bands, missions: data.missions.items, adventureScenes: advCount,
    });
    return buildClinicianSummary({ childProfile, milestones, bands, data, advCount, watch });
  }, [ready, childProfile, milestones, behaviorLogs, data.speech.items, data.missions.items, data.adventures.items, data.events.items, data.stats, data.today, data.week, data.streak, screenings.items]);
  const latest = useRef(summary);
  latest.current = summary;
  const { clinicianSummary, previewSummary } = summary;
  const isCurrent = () => !!openReceipt && currentOpen.current === openReceipt && ready && latest.current === summary && egress.isCurrent() && sources.every(source => source?.isCurrent() === true);
  const copySummary = async () => {
    if (!clinicianSummary || !isCurrent()) return;
    try {
      await navigator.clipboard.writeText(clinicianSummary);
      if (isCurrent()) setCopied(clinicianSummary);
    } catch { /* The existing preview remains selectable if clipboard is unavailable. */ }
  };

  return <details data-testid="consult-practice-summary" data-module-disclosure="consult-practice-summary" onToggle={event => {
    const receipt = event.currentTarget.open ? {} : null;
    currentOpen.current = receipt;
    setOpenReceipt(receipt);
    if (!receipt) setCopied(null);
  }} className="mt-4 border-t" style={{ borderColor: "var(--arbor-rule)" }}>
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-3 t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>
      <Icon name="description" size={18} /><span>{t("elev.packet.intake.practice")} · {t("elev.growthTruth.copilot.share.title")}</span>
    </summary>
    <div data-module="consult-practice-summary" data-module-demoted className="space-y-3 pb-4">
      <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.copilot.share.lang")}</p>
      {!ready ? <p role="status">{t(sources.some(source => !source || source.error || (source.loaded && !source.confirmed)) ? "share.error" : "aria.loading")}</p> : <pre data-testid="consult-practice-preview" dir="ltr" className="t-sm whitespace-pre-wrap break-words rounded-xl p-4 select-text" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
        {previewSummary ?? t("elev.growthTruth.copilot.share.blocked")}
      </pre>}
      <button type="button" data-testid="consult-practice-copy" onClick={copySummary} disabled={!ready || !clinicianSummary} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 t-sm font-semibold disabled:cursor-not-allowed" style={{ borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
        <Icon name={copied === clinicianSummary && !!clinicianSummary ? "check" : "content_copy"} size={16} />{t(copied === clinicianSummary && !!clinicianSummary ? "elev.growthTruth.copilot.share.copied" : "elev.growthTruth.copilot.share.copy")}
      </button>
    </div>
  </details>;
}
