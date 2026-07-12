import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { cardCls, ProgressBar, RadialProgress, Split, domainVisual, PASTEL } from "../ui/kit";
import { authHeaders, getAiLanguage } from "../../lib/api";
import { DOMAIN_REFERENCES } from "../../lib/milestoneReferences";
import { bandForAgeMonths, comparisonAgeMonths, correctedAge } from "../../lib/milestoneData";
// B0 — months-precise age spine
import { ageMonthsFromProfile } from "../../lib/childAge";
import { HeroAvatar } from "../ui/HeroAvatar";
import framework from "../../framework.json";
import { DevelopmentalDomainId, Milestone } from "../../types";

function celebrate() {
  confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#34b277", "#5fce97", "#d9763f", "#3f8cc9"],
  });
}

export default function MilestonesTab() {
  const {
    milestones,
    handleToggleMilestone,
    addCustomMilestone,
    checkedMilestones,
    totalMilestones,
    handleGenerateMilestoneScaffold,
    isAnalyzingMilestones,
    milestoneAnalysisOfGaps,
    setChatInput,
    setSelectedLens,
    setActiveTab,
    childProfile,
    updateChild,
    deleteMilestone,
    updateMilestoneTitle,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const isRtl = uiLang === "he";
  const domainOptions = framework.domains;
  // openDomain === null → the "all domains" master list (the closed Map);
  // set → the single-domain drill-in detail pane.
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<Record<string, boolean>>({});

  // ── Corrected age (preterm) ──────────────────────────────────────────────
  // B0: prefer months-precise value from birthDate/ageMonths over the legacy
  // whole-year field so a 9-month-old isn't compared against the 0-month band.
  const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
  const gestationalWeeks = childProfile.preterm?.gestationalWeeks;
  const corrected = correctedAge(chronoMonths, gestationalWeeks);
  const comparisonMonths = comparisonAgeMonths(chronoMonths, gestationalWeeks);
  const currentBand = bandForAgeMonths(comparisonMonths);

  const [showGestation, setShowGestation] = useState(false);
  const [gestationDraft, setGestationDraft] = useState<string>(gestationalWeeks ? String(gestationalWeeks) : "");
  const [savingGestation, setSavingGestation] = useState(false);

  const saveGestation = async (weeks: number | null) => {
    setSavingGestation(true);
    try {
      await updateChild(childProfile.id, {
        preterm: weeks && weeks < 40 && weeks > 0 ? { gestationalWeeks: weeks } : undefined,
      });
      setShowGestation(false);
    } finally {
      setSavingGestation(false);
    }
  };

  const explain = async (item: Milestone) => {
    if (explanations[item.id]) {
      setExplanations((p) => {
        const n = { ...p };
        delete n[item.id];
        return n;
      });
      return;
    }
    setExplaining((p) => ({ ...p, [item.id]: true }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `Briefly explain the developmental milestone "${item.title}" for a ${childProfile.age}-year-old. Cover: typical age range, what it looks like in everyday life, and 2 concrete ways a parent can support it. Non-diagnostic, warm, short. Use the headings ### Typical age, ### What it looks like, ### How to support.`,
          childProfile,
          scholarLens: "Integrated Balanced",
          language: getAiLanguage(),
        }),
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setExplanations((p) => ({ ...p, [item.id]: String(data.text || "") }));
    } catch {
      setExplanations((p) => ({ ...p, [item.id]: "### Unavailable\nCould not load guidance right now." }));
    } finally {
      setExplaining((p) => ({ ...p, [item.id]: false }));
    }
  };
  // Bands strictly below the child's current band start collapsed (progressive
  // disclosure — a parent of a 5yo shouldn't wade through newborn items). The
  // current band and anything ahead start open. Tracks which collapsed bands the
  // parent has manually expanded.
  const [openEarlierBands, setOpenEarlierBands] = useState<Record<number, boolean>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState<DevelopmentalDomainId>(domainOptions[0].id as DevelopmentalDomainId);

  const domainStats = useMemo(() => {
    const map: Record<string, { total: number; checked: number }> = {};
    for (const dom of domainOptions) map[dom.id] = { total: 0, checked: 0 };
    for (const m of milestones) {
      if (!map[m.domain]) map[m.domain] = { total: 0, checked: 0 };
      map[m.domain].total += 1;
      if (m.checked) map[m.domain].checked += 1;
    }
    return map;
  }, [milestones, domainOptions]);

  const onToggle = (id: string, wasChecked: boolean) => {
    handleToggleMilestone(id);
    if (!wasChecked) celebrate();
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addCustomMilestone(newTitle.trim(), newDomain);
    setNewTitle("");
    setShowAdd(false);
  };

  const renderItem = (item: Milestone) => (
    <div
      key={item.id}
      className="p-3 rounded-xl transition"
      style={item.checked ? { background: "var(--arbor-paper-deep)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", border: "1px solid var(--arbor-rule)" }}
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id, item.checked)} className="mt-1" style={{ accentColor: "var(--arbor-clay)" }} />
        <div className="space-y-0.5 flex-1">
          <span className="font-bold block" style={{ color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{item.title}</span>
          <span className="text-[10px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.description}</span>
          {item.skillLooksLike && (
            <span className="text-[10px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              <span className="font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.looksLike")} </span>
              {item.skillLooksLike}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {item.checked && <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>{t("ms.observed")}</span>}
            {item.ageGroup && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("ms.age")} {item.ageGroup}</span>}
            {item.custom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-peach-ink)", background: "var(--arbor-peach-soft)" }}>{t("ms.custom")}</span>}
            {item.custom && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); const nt = window.prompt("Rename milestone", item.title); if (nt) updateMilestoneTitle(item.id, nt); }}
                aria-label={t("aria.renameCustomMilestone")}
                className="text-[9px] transition"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="edit" size={11} />
              </button>
            )}
            {item.custom && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); if (window.confirm("Delete this custom milestone?")) deleteMilestone(item.id); }}
                aria-label={t("aria.deleteCustomMilestone")}
                className="text-[9px] transition"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="delete" size={11} />
              </button>
            )}
            {item.references?.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[9px] font-bold flex items-center gap-0.5" style={{ color: "var(--arbor-sky-ink)" }}>
                {r.label} <Icon name="open_in_new" size={11} />
              </a>
            ))}
            {!item.custom && DOMAIN_REFERENCES[item.domain] && (
              <a
                href={DOMAIN_REFERENCES[item.domain].url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] font-bold flex items-center gap-0.5"
                style={{ color: "var(--arbor-sky-ink)" }}
              >
                {DOMAIN_REFERENCES[item.domain].label} <Icon name="open_in_new" size={11} />
              </a>
            )}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); void explain(item); }}
              disabled={explaining[item.id]}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
              style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
            >
              {explaining[item.id] ? <Icon name="progress_activity" size={11} className="animate-spin" /> : <Icon name="menu_book" size={11} />}
              {explanations[item.id] ? t("ms.hide") : t("ms.explain")}
            </button>
          </div>
        </div>
        {item.checked && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Memory portrait — a quiet reminder this is a moment in the child's record. */}
            <HeroAvatar size={28} animate={false} ring={false} className="flex-shrink-0" />
            <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title="Celebrate" className="transition" style={{ color: "var(--arbor-peach-ink)" }}>
              <Icon name="celebration" size={16} />
            </button>
          </div>
        )}
      </label>
      <AnimatePresence initial={false}>
        {explanations[item.id] && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-2 p-3 rounded-xl text-[11px] leading-relaxed select-text" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <MarkdownBlock text={explanations[item.id]} className="space-y-1.5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /**
   * Group a domain's milestones into the canonical age bands, in ascending age
   * order. Items without an `ageMonths` (legacy/custom) fall into a trailing
   * "other" bucket keyed -1 so they always render after the dated bands.
   */
  const groupByBand = (items: Milestone[]) => {
    const byBand = new Map<number, { label: string; items: Milestone[] }>();
    for (const m of items) {
      const key = typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : -1;
      const label = key === -1 ? t("ms.custom") : bandForAgeMonths(m.ageMonths as number).label;
      if (!byBand.has(key)) byBand.set(key, { label, items: [] });
      byBand.get(key)!.items.push(m);
    }
    return [...byBand.entries()]
      .sort((a, b) => (a[0] === -1 ? 1 : b[0] === -1 ? -1 : a[0] - b[0]))
      .map(([months, v]) => ({ months, label: v.label, items: v.items }));
  };

  /** The age-banded checklist for one domain — reused inside the drill-in pane.
   *  Identical band/disclosure/renderItem behavior as before; only relocated. */
  const renderDomainChecklist = (domId: string) => {
    const itemsInDom = milestones.filter((m) => m.domain === domId);
    const bands = groupByBand(itemsInDom);
    if (itemsInDom.length === 0) {
      return <p className="text-[10px] italic" style={{ color: "var(--arbor-muted)" }}>{t("ms.noMilestones")}</p>;
    }
    return (
      <div className="space-y-2.5">
        {bands.map((band) => {
          const isCurrent = band.months === currentBand.months;
          const isEarlier = band.months !== -1 && band.months < currentBand.months;
          const isAhead = band.months !== -1 && band.months > currentBand.months;
          const collapsed = isEarlier && !openEarlierBands[band.months];
          const checkedInBand = band.items.filter((m) => m.checked).length;
          return (
            <div key={band.months} className="space-y-2">
              <button
                type="button"
                onClick={() => { if (isEarlier) setOpenEarlierBands((p) => ({ ...p, [band.months]: !p[band.months] })); }}
                aria-expanded={!collapsed}
                className="w-full flex items-center justify-between gap-2 text-start"
                style={{ cursor: isEarlier ? "pointer" : "default" }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: isCurrent ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>{band.label}</span>
                  {isCurrent && <span className="text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>{t("ms.currentBand")}</span>}
                  {isAhead && <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("ms.aheadBand")}</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold" style={{ color: "var(--arbor-muted)" }}>{checkedInBand}/{band.items.length}</span>
                  {isEarlier && (
                    <Icon name="expand_more" size={16} className="transition-transform" style={{ color: "var(--arbor-muted)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
                  )}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                    {band.items.map(renderItem)}
                  </motion.div>
                )}
              </AnimatePresence>
              {collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenEarlierBands((p) => ({ ...p, [band.months]: true }))}
                  className="text-[10px] font-bold"
                  style={{ color: "var(--arbor-green-ink)" }}
                >
                  {t("ms.showEarlier")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Loop-2 affordance: turn a Map domain into a playful kid quest. Routes to the
  // existing Daily Play activity library (which surfaces in the child's world),
  // seeded with the domain context — no new write path or capability invented.
  const assignActivity = (domId: string, domLabel: string) => {
    setChatInput(`Suggest one playful, age-appropriate activity I can assign ${childProfile.name || "my child"} to gently support "${domLabel}". Keep it to a single quest they'd enjoy.`);
    setSelectedLens("Vygotsky's Scaffolding");
    setActiveTab("daily-play");
  };

  // RTL-aware directional chevrons via the shared Material Symbols <Icon>.
  // (Declared as components so they slot into the existing <ChevStart/> /
  // <ChevEnd/> render sites, including the domain-map scopes where a local
  // `Icon` shadows the import.)
  const chevStartName = isRtl ? "chevron_right" : "chevron_left";
  const chevEndName = isRtl ? "chevron_left" : "chevron_right";
  const ChevStart = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <Icon name={chevStartName} size={16} className={className} style={style} />
  );
  const ChevEnd = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <Icon name={chevEndName} size={16} className={className} style={style} />
  );
  const firstName = (childProfile.name || "").split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center gap-3.5">
        {/* The child's memory portrait — modest, no comic frame in the parent register. */}
        <HeroAvatar size={52} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
        <div>
          <h2 className="text-2xl md:text-[2rem] leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.title")}</h2>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{t("ms.subtitle")}</p>
        </div>
      </div>

      {/* Master/detail spine: left rail = the persistent Development Map summary
          (firewall-safe COUNT headline — never a 0–100 gauge or trend delta);
          right pane = the seven-domain master list, or a single-domain drill-in. */}
      <Split
        ratio="1fr 1.4fr"
        left={
          <div className="space-y-5 md:sticky md:top-4">
            {/* Development Map summary — count headline only, no verdict score. */}
            <div className={`${cardCls} p-6`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.developmentMap")}</span>
              {/* Ring/dial visual — CLINICAL FIREWALL: the number inside is a COUNT of
                  noticed milestones (never a %/score/verdict); the ring fill is only the
                  checked/total count-proportion, and it is not labelled as competence. */}
              <div className="flex items-center gap-4 mt-4">
                <RadialProgress value={checkedMilestones} total={totalMilestones} tone="mint" size={92} thickness={10}>
                  <span className="text-center leading-none">
                    <span className="block text-[26px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-green-ink)" }}>{checkedMilestones}</span>
                    <span className="block text-[10px] font-bold mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.of")} {totalMilestones}</span>
                  </span>
                </RadialProgress>
                <div className="min-w-0">
                  <div className="text-[12px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("ms.observedSoFar")}</div>
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ms.snapshotNotScore")}</p>
                </div>
              </div>

              {/* B1 — under-2 reassurance lead: name the current stage, no checklist framing. */}
              {comparisonMonths < 24 && (
                <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.rightNow")}</span>
                    <span className="text-lg" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)" }}>{currentBand.label}</span>
                    {corrected.applied && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "#fff" }}>
                        {t("ms.correctedBadge")} · {corrected.correctedMonths}m
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: "var(--arbor-ink)" }}>{t("ms.rightNowBody")}</p>
                </div>
              )}
            </div>

            {/* Corrected-age (preterm) control + badge — relocated into the rail. */}
            <div className={`${cardCls} p-4`}>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="p-1.5 rounded-lg flex items-center justify-center mt-0.5" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="child_care" size={16} /></span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ms.bornEarly")}</span>
                      {corrected.applied && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
                          {t("ms.correctedBadge")} · {corrected.correctedMonths}m
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ms.gestationHint")}</p>
                  </div>
                </div>
                {!showGestation && (
                  <button
                    type="button"
                    onClick={() => { setGestationDraft(gestationalWeeks ? String(gestationalWeeks) : ""); setShowGestation(true); }}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition self-start whitespace-nowrap"
                    style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}
                  >
                    {gestationalWeeks ? `${gestationalWeeks}w · ${t("ms.gestationSave")}` : t("ms.gestationLabel")}
                  </button>
                )}
              </div>
              {showGestation && (
                <form
                  onSubmit={(e) => { e.preventDefault(); const n = Number(gestationDraft); saveGestation(Number.isFinite(n) && n > 0 ? n : null); }}
                  className="flex flex-col gap-2 items-stretch mt-3"
                >
                  <label className="flex-1 flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                    {t("ms.gestationLabel")}
                    <input
                      autoFocus
                      type="number"
                      min={22}
                      max={42}
                      inputMode="numeric"
                      value={gestationDraft}
                      onChange={(e) => setGestationDraft(e.target.value)}
                      placeholder="40"
                      className="w-24 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                    />
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <button type="submit" disabled={savingGestation} className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition disabled:opacity-60" style={{ background: "var(--arbor-clay)" }}>
                      {savingGestation ? <Icon name="progress_activity" size={14} className="animate-spin" /> : t("ms.gestationSave")}
                    </button>
                    <button type="button" disabled={savingGestation} onClick={() => saveGestation(null)} className="text-xs px-3 py-2 rounded-xl" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>{t("ms.gestationClear")}</button>
                    <button type="button" onClick={() => setShowGestation(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        }
        right={
          openDomain === null ? (
            /* ── Closed Map: the seven domains as tappable rows with COUNT bars ── */
            <div className={`${cardCls} p-6`}>
              <h3 className="text-[15px] font-extrabold mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.developmentMap")}</h3>
              <div className="flex flex-col gap-3.5">
                {domainOptions.map((dom) => {
                  const s = domainStats[dom.id] || { total: 0, checked: 0 };
                  const dv = domainVisual(dom.id);
                  const Icon = dv.icon;
                  return (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => setOpenDomain(dom.id)}
                      className="text-start rounded-[14px] p-3 transition hover:bg-[var(--arbor-paper-deep)]"
                      style={{ border: "1px solid var(--arbor-rule)", minHeight: 44 }}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: PASTEL[dv.tone].ink }} />
                        <span className="flex-1 text-[13.5px] font-bold" style={{ color: "var(--arbor-ink)" }}>{dom.label}</span>
                        <span className="text-[11px] font-extrabold" style={{ color: "var(--arbor-muted)" }}>{s.checked}/{s.total} {t("ms.domainOf")}</span>
                        <ChevEnd className="w-4 h-4 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
                      </div>
                      <ProgressBar value={s.checked} total={s.total} tone={dv.tone} height={9} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Domain drill-in: back-link + header + banded checklist + hints ── */
            (() => {
              const dom = domainOptions.find((d) => d.id === openDomain) || domainOptions[0];
              const s = domainStats[dom.id] || { total: 0, checked: 0 };
              const dv = domainVisual(dom.id);
              const Icon = dv.icon;
              return (
                <div className={`${cardCls} p-6 space-y-4 text-xs`}>
                  <button
                    type="button"
                    onClick={() => setOpenDomain(null)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold rounded-lg px-2.5 py-1.5 transition"
                    style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
                  >
                    <ChevStart className="w-4 h-4" /> {t("ms.allDomains")}
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="rounded-[13px] flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, background: PASTEL[dv.tone].soft }}>
                      <Icon className="w-6 h-6" style={{ color: PASTEL[dv.tone].ink }} />
                    </span>
                    <div className="flex-1">
                      <div className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{dom.label}</div>
                      <div className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{s.checked}/{s.total} {t("ms.domainOf")}</div>
                    </div>
                  </div>
                  <ProgressBar value={s.checked} total={s.total} tone={dv.tone} height={9} />

                  {renderDomainChecklist(dom.id)}

                  {/* Loop-2: assign a playful activity for this domain → kid quest. */}
                  <button
                    type="button"
                    onClick={() => assignActivity(dom.id, dom.label)}
                    className="w-full flex items-center gap-2.5 rounded-[13px] p-3 text-start transition"
                    style={{ background: "var(--arbor-peach-soft)", border: "1px solid rgba(217,118,63,0.25)", minHeight: 44 }}
                  >
                    <Icon name="sports_esports" size={18} style={{ color: "var(--arbor-peach-ink)" }} />
                    <div className="flex-1">
                      <div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-peach-ink)" }}>{t("ms.assignActivity")}</div>
                      <div className="text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("ms.assignHint", { name: firstName || childProfile.name })}</div>
                    </div>
                    <ChevEnd className="w-4 h-4 flex-shrink-0" style={{ color: "var(--arbor-peach-ink)" }} />
                  </button>

                  {/* Connective-tissue hint: marking skills feeds Map/Academy/Care. */}
                  <div className="flex items-start gap-2.5 rounded-[13px] p-3.5" style={{ background: "var(--arbor-sky-soft)" }}>
                    <Icon name="sync" size={18} className="mt-0.5" style={{ color: "var(--arbor-sky-ink)" }} />
                    <span className="text-[12px] leading-relaxed font-semibold" style={{ color: "var(--arbor-sky-ink)" }}>{t("ms.mapHint")}</span>
                  </div>
                </div>
              );
            })()
          )
        }
      />

      {/* Add custom milestone */}
      <div className={`${cardCls} p-5`}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="add" size={16} /> {t("ms.addMilestone")}
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("ms.newPlaceholder")} className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.add")}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
          </form>
        )}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <Icon name="auto_awesome" size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t("ms.nurtureNext")}
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.nurtureDesc")}</p>
          </div>
          <button type="button" onClick={handleGenerateMilestoneScaffold} disabled={isAnalyzingMilestones} className="text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ms-auto sm:ms-0 disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
            {isAnalyzingMilestones ? (<><Icon name="progress_activity" size={14} className="animate-spin" /> {t("ms.findingSteps")}</>) : (<><Icon name="psychology" size={15} /> {t("ms.findSteps")}</>)}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 rounded-xl text-xs leading-relaxed space-y-3 select-text bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 flex justify-end" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <button type="button" onClick={() => { setChatInput(`Regarding the scaffolding gap analysis on milestones:\n\n${milestoneAnalysisOfGaps}\n\nHow do we evaluate sensory resilience relative to these milestone hurdles?`); setSelectedLens("Vygotsky's Scaffolding"); setActiveTab("coach"); }} className="text-[10px] font-bold transition flex items-center gap-1" style={{ color: "var(--arbor-green-ink)" }}>
                {t("ms.discussCoach")}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl text-center text-xs bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
            {t("ms.runHint")}
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl flex items-start gap-4 text-xs" style={{ background: "var(--arbor-yellow-soft)" }}>
        <Icon name="visibility" size={20} className="mt-0.5" style={{ color: "var(--arbor-yellow-ink)" }} />
        <div className="space-y-1 leading-relaxed">
          <strong className="text-sm block" style={{ color: "var(--arbor-ink)" }}>{t("ms.watchPoints")}</strong>
          <p style={{ color: "var(--arbor-muted)" }}>
            {corrected.applied && (
              <>Because {childProfile.name || "your child"} arrived early, Arbor is comparing milestones against a corrected age of about {corrected.correctedMonths} months rather than {corrected.chronologicalMonths} — preemies catch up on their own timeline. </>
            )}
            A few areas are still in the &ldquo;not seen yet&rdquo; column for this age — including comfort code-switching between {childProfile.languages.join(" and ") || "home and school languages"}. That&apos;s common and rarely a concern on its own. Keep noticing, keep playing, and revisit in a few weeks. If something feels persistent, or you&apos;d simply like reassurance, you can ask Arbor or share a development snapshot with your pediatrician or teacher.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
