import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { SectionCard, Chip, IconBadge, InitialsTile, cardCls, PASTEL, type PastelKey } from "../ui/kit";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { Avatar } from "../ui/Avatar";
import { asksForHero, childPicture } from "../../lib/childPicture";
import { api } from "../../lib/api";
import { scopeDisplayLabels } from "../../lib/shareScopes";
import type { ShareGrant } from "../../types";
import ProfileEditDrawer from "../profile/ProfileEditDrawer";
// B-GROWTH-05 — physical measurements (spine domain 7) moved here from Growth.
import PhysicalGrowthCard from "./PhysicalGrowthCard";
import { useProfile } from "../../context/ProfileContext";
// B-CAREPRO-06: memory text renders through the same plain-words scrub the
// Story queue uses — the parent never reads a fact in an assessment register.
import { scrubMemoryProposals, toParentWords } from "../../server/parentWordsScrub";
// GP-01 / GP-08 / RUN-02: months-precise age label + the shared age window and
// the ONE "worth watching next" derivation.
import { ageLabel, ageMonthsFromProfile } from "../../lib/childAge";
import { comparisonAgeMonths, selectNextMilestones } from "../../lib/milestoneData";
// W2-GROWTH r1 (law 1): the milestones chapter is a plain count from the ONE
// helper the Growth pill reads — never "{checked} of {total} in the window".
import { noticedMilestoneCounts } from "../../lib/record/counts";
// W2-GROWTH r1 (law 8): stored language names print in the reader's language.
import { languageName } from "../../lib/languageName";
import { fmtDay } from "../../lib/formatDate";
// B-CAREPRO-29: "What we're working on" = the parent's chosen goals (CI-28 tiles).
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { goalLabel, type ActiveGoal } from "../../practice/goalBuilder";
// B-CAREPRO-33: the quoted facts carry an as-of date and ask "Still true?" after 90 days.
import { confirmFact, factMonthLabel, isFactStale, type FactField } from "../../lib/factsAsOf";
import { FreeText } from "../ui/FreeText";
// B-GROWTH-35: a kept fact with a relative time in it carries the day it was written.
import { writtenDateFor } from "../../lib/record/datedFact";

/**
 * Child Intelligence › Development Profile — ONE scrolling narrative ("My Child"
 * unification). Instead of sending the parent into seven sibling tabs, this page
 * tells the child's whole story top-to-bottom — who they are, what's happening
 * now, milestones, strengths, language, what Arbor remembers, and the next step
 * — with each chapter linking into its full tool.
 */
/** The route's ONE primary move. Three mutually exclusive states render it (a pending fact to keep,
 *  the zero-pending hero CTA, the add-a-fact CTA), so the stamp is declared once and spread. */
const APPROVE_MOVE = { "data-primary-move": "approve-memory" } as const;

export default function ChildProfile() {
  const {
    childProfile, milestones,
    behaviorLogs, approvedMemoryItems, pendingMemoryItems, setActiveTab, updateChild,
    handleMemoryDecision, isMemoryUpdating,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const { user } = useAuth();
  // GP-15: the child count is the family's real count, never a literal.
  const { profiles } = useProfile();
  // B-SHELL-27: ONE resolver (hero render → photo → initial) — the same face
  // the sidebar and the switcher show; "Create hero" only when there is none.
  const { name: heroName } = useHeroAvatar();
  const picture = childPicture(childProfile);
  const hasHero = !asksForHero(childProfile);
  const first = childProfile.name.split(" ")[0];

  // Family Circle reads the SAME live, server-enforced ShareGrants that Trusted
  // Sharing manages — never a parallel store. The account holder is row 0.
  const [shares, setShares] = useState<ShareGrant[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.listShares(childProfile.id)
      .then((r) => { if (!cancelled) setShares(r.shares || []); })
      .catch(() => { if (!cancelled) setShares([]); });
    return () => { cancelled = true; };
  }, [childProfile.id]);

  // W2-GROWTH r1: the "Now" chapter is CUT (lane-CAREPRO: Journal owns this
  // week's moments) — it filed a joyful Moment in coral under a monitoring
  // icon with a "marked resolved" count.

  // The record inside the child's age window feeds "worth watching next" only
  // (RUN-02's ONE next-picks derivation). The count is a plain count (law 1).
  const comparisonMonths = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    return comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks);
  }, [childProfile]);
  const { noticed: noticedCount } = useMemo(() => noticedMilestoneCounts(milestones), [milestones]);
  const nextMilestones = useMemo(() => selectNextMilestones(milestones, comparisonMonths, 3), [milestones, comparisonMonths]);

  // B-CAREPRO-06: approved facts and the proposal count read the scrubbed
  // lists; a fact the scrub drops is not shown here and stays in the ledger.
  const shownApproved = useMemo(() => scrubMemoryProposals(approvedMemoryItems), [approvedMemoryItems]);
  const pendingQueue = useMemo(() => scrubMemoryProposals(pendingMemoryItems), [pendingMemoryItems]);
  // B-GROWTH-NEW-1F: the newest kept fact, quoted in the identity band.
  const latestApproved = useMemo(
    () => [...shownApproved].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0] ?? null,
    [shownApproved],
  );
  // B-GROWTH-NEW-1E: Keep / Forget decide on THIS page; the settled line shows
  // only once the server confirmed (same seam and rule as #/memory).
  const [kept, setKept] = useState(false);
  const decide = async (memoryId: string, status: "approved" | "rejected") => {
    const ok = await handleMemoryDecision(memoryId, status);
    if (ok && status === "approved") setKept(true);
  };

  // B-CAREPRO-29: "What we're working on" is what the PARENT chose (the 1–3
  // curated activeGoals the coach already reads) — never a focus derived from
  // an English regex over free-text challenges, which no Hebrew family matched.
  // The plan "next step" chapter is gone with it (Plans keeps its own door).
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const [goalsOpen, setGoalsOpen] = useState(false);

  // B-CAREPRO-33: "as of {month}" under a dated fact; after 90 days a quiet
  // "Still true? Keep · Edit" — Keep stamps today, Edit opens the drawer.
  const factLine = (field: FactField, hasValue: boolean): React.ReactNode => {
    const asOf = childProfile.factsAsOf?.[field];
    if (!hasValue || !asOf) return null;
    const stale = isFactStale(asOf, Date.now());
    return (
      <span data-testid={`profile-fact-asof-${field}`} className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs" style={{ color: "var(--arbor-muted)" }}>
        <span>{t("elev.profile.fact.asOf", { month: factMonthLabel(asOf, uiLang === "he" ? "he" : "en") })}</span>
        {stale && (
          <span data-testid={`profile-fact-stale-${field}`} className="inline-flex flex-wrap items-center gap-x-1">
            <span>{t("elev.profile.fact.stillTrue")}</span>
            <button
              type="button"
              data-testid={`profile-fact-keep-${field}`}
              onClick={() => { void updateChild(childProfile.id, { factsAsOf: confirmFact(childProfile.factsAsOf, field, new Date().toISOString()) }); }}
              className="touch-target px-1 font-bold"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              {t("elev.profile.fact.keep")}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              data-testid={`profile-fact-edit-${field}`}
              onClick={() => setEditingProfile(true)}
              className="touch-target px-1 font-bold"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              {t("elev.profile.fact.edit")}
            </button>
          </span>
        )}
      </span>
    );
  };

  // Identity line from REAL data (age · languages · school) — never the mock's
  // hardcoded "Bilingual · Pre-K". Each segment renders as its own bidi island.
  // W2-GROWTH r2 (B-33): the languages segment carries its as-of month.
  const langNames = childProfile.languages.map((l) => languageName(l, t)).filter(Boolean);
  const langsAsOf = childProfile.factsAsOf?.languages;
  const langSegment = langNames.length === 0
    ? ""
    : langsAsOf
    ? t("elev.profile.identity.langsAsOf", { langs: langNames.join(" · "), month: factMonthLabel(langsAsOf, uiLang === "he" ? "he" : "en") })
    : langNames.join(" · ");
  // Critic r1 (B-GROWTH-35 seam): the school setting is time-bearing too, so
  // it carries its as-of month the same way languages do.
  const schoolAsOf = childProfile.factsAsOf?.schoolContext;
  const schoolSegment = !childProfile.schoolContext
    ? ""
    : schoolAsOf
    ? t("elev.profile.identity.schoolAsOf", { school: childProfile.schoolContext, month: factMonthLabel(schoolAsOf, uiLang === "he" ? "he" : "en") })
    : childProfile.schoolContext;
  const identitySegments = [ageLabel(childProfile, t), langSegment, schoolSegment].filter(Boolean) as string[];

  // B-GROWTH-35: "Entering kindergarten in 3 months", kept in June, is read in
  // October as if said today. A fact whose words carry a relative time is
  // printed after the day it was written ("written 10 Jun 2026: …"); the
  // words themselves are never rewritten.
  const writtenPrefix = (fact: string, at: string | null | undefined): React.ReactNode => {
    const written = writtenDateFor(fact, at);
    return written ? (
      <span data-testid="profile-fact-written" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.growthTruth.profile.written", { date: fmtDay(written, uiLang) })}{" "}
      </span>
    ) : null;
  };
  const latestWritten = latestApproved ? writtenDateFor(toParentWords(latestApproved.fact), latestApproved.createdAt) : null;
  const hasPending = pendingQueue.length > 0;

  // B-GROWTH-NEW-1F → B-GROWTH-NEW-2F — the ProfileKnowsLine names the child
  // ("What Arbor knows about {name}:"), then one fact the parent kept, in their
  // own words, "— kept since {month}". No count, no bar. W2-GROWTH r2 (P0):
  // with a fact pending it sits UNDER the pending band — above it, it pushed
  // Keep behind the tab bar at 375; with nothing pending it closes the header.
  const knowsLine = latestApproved ? (
    <div data-testid="profile-knows-line" className="flex items-start gap-3 rounded-[var(--r)] p-4" style={{ background: "var(--arbor-paper-deep)" }}>
      <span aria-hidden="true" className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--arbor-clay)" }} />
      <p className="t-md min-w-0" style={{ fontFamily: "var(--font-editorial)", fontWeight: 400, color: "var(--arbor-ink)" }}>
        {first ? t("elev.profile.knows.leadNamed", { name: first }) : t("elev.profile.knows.lead")}{" "}
        {writtenPrefix(toParentWords(latestApproved.fact), latestApproved.createdAt)}
        {/* B-SHELL-28: the parent's words never flip on a leading name. */}
        <FreeText text={toParentWords(latestApproved.fact)} />
        {latestApproved.createdAt && !latestWritten && (
          <span className="t-sm" style={{ color: "var(--arbor-muted)" }}>
            {" — "}{t("elev.profile.knows.since", { month: factMonthLabel(latestApproved.createdAt, uiLang === "he" ? "he" : "en") })}
          </span>
        )}
      </p>
    </div>
  ) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* W2-GROWTH r2 — the first fold in the lane's order: identity line (age
          · languages as of {month} · school), What we're working on, then (when
          anything waits) What Arbor would like to remember with Keep. Ask Arbor
          moved to the jump strip (a door), Create hero into the Who chapter,
          the album-count kicker is gone (lib/pulse). Cut in r1: the telemetry
          row — moment counts belong to Journal (CN-007). At lg the band is a
          sticky column beside the identity; grid lines follow the writing
          direction, so RTL mirrors with no extra rule. */}
      <div data-testid="profile-fold" className={hasPending ? "space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0" : "space-y-6"}>
      <header data-module="profile-identity" data-testid="profile-hub-hero" className="border-b pb-5 lg:col-start-1 lg:row-start-1" style={{ borderColor: "var(--arbor-rule)" }}>
        <div className="flex items-center gap-4">
          <Avatar name={childProfile.name} photoURL={picture.url} size={40} />
          <div className="min-w-0">
            {/* Critic r1: no dir on the h1 — it keeps text-align:start in the PAGE
                direction; only the name is isolated, so "Dylan" on a Hebrew page
                sits beside its avatar, not 240 px away. */}
            <h1 className="text-2xl sm:text-3xl leading-tight text-start" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{childProfile.name ? <bdi>{childProfile.name}</bdi> : t("cp.title", { name: first })}</h1>
            {/* Each segment is its own bidi island, so a Hebrew age cannot tear
                "City" away from "kindergarten, first year" (one dir=auto on the
                joined line did). Language names in the reader's language. */}
            <p className="mt-1 text-sm leading-relaxed" data-testid="profile-identity-line" style={{ color: "var(--arbor-muted)" }}>
              {identitySegments.map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 && " · "}
                  <bdi dir="auto">{seg}</bdi>
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
        {/* What we're working on — the parent's chosen goals (B-CAREPRO-29),
            above the fold with the identity, one tap to choose. */}
        <div className="mt-4">
          <p className="text-xs font-bold mb-2" style={{ color: "var(--arbor-muted)" }}>{t("elev.goal.profile.title")}</p>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="profile-goals">
            {activeGoals.map((g) => <Chip key={g.goalId} tone="lav">{goalLabel(g, t)}</Chip>)}
            <button
              type="button"
              data-testid="profile-goals-edit"
              onClick={() => setGoalsOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold"
              style={{ color: "var(--arbor-clay)" }}
            >
              <Icon name={activeGoals.length > 0 ? "edit" : "add"} size={16} />
              {activeGoals.length > 0 ? t("elev.goal.profile.edit") : t("elev.goal.profile.empty")}
            </button>
          </div>
          {goalsOpen && (
            <GoalBuilderModal
              open={goalsOpen}
              onClose={() => setGoalsOpen(false)}
              childName={childProfile.name}
              activeGoals={activeGoals}
              behaviorLogs={behaviorLogs}
              onSave={(goals) => { void updateChild(childProfile.id, { activeGoals: goals }); }}
            />
          )}
        </div>
        {/* Nothing pending: the knows-line closes the header, then the
            approve-memory move in its zero-pending shape. */}
        {!hasPending && knowsLine && <div className="mt-4">{knowsLine}</div>}
        {!hasPending && (latestApproved ? (
          <button type="button" data-testid="profile-hero-cta" {...APPROVE_MOVE} onClick={() => setEditingProfile(true)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold" style={{ color: "var(--arbor-clay)" }}>
            <Icon name="edit" size={16} /> {t("elev.growthTruth.profile.cta.addFact", { name: first })}
          </button>
        ) : (
          <button
            type="button"
            data-testid="profile-hero-cta"
            // Zero pending (the contract's empty state): the approve-memory move
            // is "tell Arbor one thing" — it opens the drawer where facts live.
            {...APPROVE_MOVE}
            onClick={() => setEditingProfile(true)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-start text-sm font-bold"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          >
            <Icon name="edit" size={16} />
            {t("elev.profile.knows.empty", { name: first })}
          </button>
        ))}
      </header>

      {/* B-GROWTH-NEW-1E — What Arbor would like to remember: the first
          pending facts, up to three, each in the parent's own words with its
          source, decided ON this page. Keep writes the approval (the same
          handleMemoryDecision seam #/memory uses); Not quite opens the full
          review where a fact is edited; Forget dismisses it. The first Keep is
          the route's stamped approve-memory and its one gradient. */}
      {hasPending && (
        <section data-module="profile-remember" aria-labelledby="profile-remember-title" className="space-y-3 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
          <h2 id="profile-remember-title" className="text-lg font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("elev.profile.remember.title")}
          </h2>
          {kept && (
            <p role="status" data-testid="profile-remember-kept" className="t-sm rounded-[var(--r)] px-4 py-3" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
              {t("elev.childmem.kept.any")}
            </p>
          )}
          <ul className="space-y-3">
            {pendingQueue.slice(0, 3).map((m, i) => (
              <li key={m.memoryId} data-testid="profile-remember-fact" className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", opacity: isMemoryUpdating === m.memoryId ? 0.6 : 1 }}>
                {m.createdAt && (
                  <p className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.childmem.provenance.inference", { date: fmtDay(m.createdAt, uiLang) })}</p>
                )}
                <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-md)", color: "var(--arbor-ink)" }}><FreeText text={toParentWords(m.fact)} /></p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="profile-remember-keep"
                    {...(i === 0 ? APPROVE_MOVE : {})}
                    disabled={isMemoryUpdating === m.memoryId}
                    onClick={() => { void decide(m.memoryId, "approved"); }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-extrabold"
                    style={i === 0
                      ? { background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
                  >
                    <Icon name="check" size={16} /> {t("elev.profile.remember.keep")}
                  </button>
                  <button type="button" data-testid="profile-remember-notquite" onClick={() => setActiveTab("memory")} className="inline-flex min-h-11 items-center px-3 text-sm font-bold" style={{ color: "var(--arbor-clay)" }}>
                    {t("elev.profile.remember.notQuite")}
                  </button>
                  <button type="button" data-testid="profile-remember-forget" disabled={isMemoryUpdating === m.memoryId} onClick={() => { void decide(m.memoryId, "rejected"); }} className="inline-flex min-h-11 items-center px-3 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.profile.remember.forget")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {pendingQueue.length > 3 && (
            <button type="button" onClick={() => setActiveTab("memory")} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold" style={{ color: "var(--arbor-clay)" }}>
              {t("elev.profile.remember.more", { n: pendingQueue.length })}
              <Icon name="chevron_right" size={16} className="rtl:rotate-180" />
            </button>
          )}
          {/* The knows-line sits under the decision, never above it. */}
          {knowsLine}
        </section>
      )}
      </div>

      {/* Chapter 1 — who {first} is */}
      <section data-module="profile-who" aria-label={t("elev.wave2Knowledge.profile.facts")}>
      <SectionCard title={t("cp.ch.who", { name: first, age: ageLabel(childProfile, t) })} icon={<Icon name="person" size={20} />} tone="mint">
        <p className="mb-4 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.wave2Knowledge.profile.facts")}</p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label={t("cp.f.languages")} value={langNames.join(" · ") || "—"} asOf={factLine("languages", childProfile.languages.length > 0)} />
          <Field label={t("cp.f.school")} value={childProfile.schoolContext || "—"} asOf={factLine("schoolContext", Boolean(childProfile.schoolContext))} />
          {/* "What we're working on" moved up into the identity band (W2-GROWTH r1). */}
          {/* CI-29: Interests field — parent-logged preferences, never interpreted.
              Displayed as read-only lav chips; edit opens ProfileEditDrawer. */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--arbor-muted)" }}>
              {t("cp.f.interests", { name: first })}
            </p>
            {childProfile.interests && childProfile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {childProfile.interests.slice(0, 3).map((interest) => (
                  <Chip key={interest} tone="lav">{interest}</Chip>
                ))}
                {childProfile.interests.length > 3 && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
                    +{childProfile.interests.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm" style={{ color: "var(--arbor-muted)" }}>
                {t("cp.interests.empty")}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setEditingProfile(true)} className="mt-3 min-h-11 text-sm font-bold" style={{ color: "var(--arbor-green-ink)" }}><Icon name="edit" size={16} className="inline-block me-1" />{t("elev.wave2Knowledge.profile.edit")}</button>
        {/* W2-GROWTH r2: Create hero left the identity header (it pushed the
            pending Keep under the tab bar at 375); it lives in the Who chapter. */}
        {!hasHero && <button onClick={() => setEditingProfile(true)} className="mt-2 block min-h-11 text-start text-sm font-bold" style={{ color: "var(--arbor-clay)" }}><Icon name="auto_awesome" size={16} className="inline-block me-1" />{t("cp.hero.create", { name: heroName })}<span className="block text-xs font-normal" style={{ color: "var(--arbor-muted)" }}>{t("cp.hero.subline")}</span></button>}
        {/* B-GROWTH-05 — Measurements (spine domain 7): the parent-logged
            growthEntries log, moved off the Growth hub. The UNCHANGED card,
            closed by default; the pediatrician packet still reads the same
            collection. Part of the profile-who module (no stamp of its own):
            the route keeps ONE demotion disclosure and its budget. */}
        <details data-testid="profile-measurements" className="mt-5 border-t pt-4" style={{ borderColor: "var(--arbor-rule)" }}>
          <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2.5">
            <IconBadge tone="mint" size={36}><Icon name="straighten" size={20} /></IconBadge>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growthTruth.profile.measurements.title")}</span>
              <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.profile.measurements.sub")}</span>
            </span>
            <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
          </summary>
          <div className="mt-3">
            <PhysicalGrowthCard embedded />
          </div>
        </details>
        {/* Family Circle — reads live ShareGrants (the SAME source Trusted Sharing
              uses); "Add a member" routes there rather than duplicating its form. */}
          <section aria-labelledby="profile-family-title" className="mt-5 border-t pt-5" style={{ borderColor: "var(--arbor-rule)" }}>
            <div className="mb-4 flex items-center gap-2.5">
              <IconBadge tone="mint" size={36}><Icon name="group" size={20} /></IconBadge>
              <h3 id="profile-family-title" className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("cp.family.title")}</h3>
            </div>
            <p className="text-xs -mt-2 mb-3" style={{ color: "var(--arbor-muted)" }}>{t("cp.family.sub", { name: first })}</p>
            <div className="space-y-2">
              {/* The account holder is always the first member. */}
              <MemberRow name={user?.displayName || user?.email || t("cp.family.you")} tone="mint" roleLine={t("cp.family.roleParent")} />
              {shares.map((s) => (
                <MemberRow
                  key={s.id}
                  name={s.recipientEmail}
                  tone="sky"
                  roleLine={t(`cp.family.role.${s.role}`, { scopes: scopeDisplayLabels(s.scopes, t).join(", ") || "—" })}
                />
              ))}
              {shares.length === 0 && (
                <p className="text-xs px-1" style={{ color: "var(--arbor-muted)" }}>{t("cp.family.empty", { name: first })}</p>
              )}
              <button
                onClick={() => setActiveTab("sharing")}
                className="w-full min-h-11 flex items-center gap-3 rounded-2xl p-2 text-start transition motion-safe:hover:-translate-y-0.5"
              >
                <span className="inline-flex items-center justify-center flex-shrink-0 rounded-[15px]" style={{ width: 42, height: 42, background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                  <Icon name="person_add" size={20} />
                </span>
                <span className="text-sm font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{t("cp.family.add")}</span>
              </button>
            </div>
          </section>
      </SectionCard>
      </section>

      {/* R25 (item 11) — #/profile rendered 9 top-level modules against a declared
          moduleBudget of 3. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
      <details data-module-disclosure="profile-more" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>
            <Icon name="route" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.growthTruth.profile.more.title")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.profile.more.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">
      {/* Chapter 3 — milestones */}
      <div data-module="profile-milestones" data-module-demoted style={{ display: "contents" }}>
      <SectionCard title={t("cp.ch.milestones")} icon={<Icon name="check_circle" size={20} fill={1} />} tone="mint">
        {/* B-CAREPRO-05 (CN-004): the count sentence only — no proportional
            fill of a child record. A bar over checked/total reads as "how far
            along" the child is, which is a verdict (law 1). */}
        <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
          <strong style={{ color: "var(--arbor-ink)" }}>{noticedCount === 1 ? t("elev.profile.ms.noticedOne") : t("elev.profile.ms.noticed", { n: noticedCount })}</strong>
        </p>
        {nextMilestones.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("cp.ms.worthWatching")}</span>
            <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
              {nextMilestones.map((m) => (
                <li key={m.id} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} /> {m.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <JumpLink onClick={() => setActiveTab("milestones")} color="var(--arbor-green-ink)">{t("cp.reviewMilestones")}</JumpLink>
          <JumpLink onClick={() => setActiveTab("screening")} color="var(--arbor-green-ink)">{t("cp.runCheck")}</JumpLink>
        </div>
      </SectionCard>
      </div>

      {/* Chapter 4 — strengths & where to support */}
      <div data-module="profile-strengths" data-module-demoted className="grid min-w-0 gap-4 lg:grid-cols-2">
        <SectionCard title={t("cp.ch.strengths")} icon={<Icon name="diamond" size={20} fill={1} />} tone="mint">
          <ul className="space-y-3">
            {childProfile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{s}</span>
              </li>
            ))}
            {childProfile.strengths.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.strengths.empty")}</li>}
          </ul>
          {/* GP-26 / IA-09: the door is gone with the leaf. #/strengths was a
              duplicate of THIS chapter reachable only from inside it, so the
              link led out of the content and back to the same content. The
              hash now resolves to this hub (lib/routes.ts RETIRED_ROUTES). */}
        </SectionCard>
        <SectionCard title={t("cp.ch.support")} icon={<Icon name="eco" size={20} />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="touch-target flex-shrink-0 gap-1 px-2 text-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                  {t("cp.buildPlan")} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                </button>
              </li>
            ))}
            {childProfile.challenges.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.support.empty")}</li>}
          </ul>
        </SectionCard>
      </div>

      {/* Chapter 5 — language & communication */}
      <div data-module="profile-language" data-module-demoted style={{ display: "contents" }}>
      <SectionCard title={t("cp.ch.language")} icon={<Icon name="translate" size={20} />} tone="sky">
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {childProfile.languages.length > 1
            ? t("cp.lang.multi", { name: first, langs: langNames.join(t("cp.lang.and")) })
            : t("cp.lang.single", { name: first, lang: langNames[0] || t("cp.lang.notSet") })}
        </p>
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("language")} color="var(--arbor-sky-ink)">{t("cp.openLang")}</JumpLink></div>
      </SectionCard>
      </div>

      {/* Chapter 6 — what Arbor remembers (the parent-approved memory) */}
      <div data-module="profile-memory" data-module-demoted style={{ display: "contents" }}>
      <SectionCard title={t("cp.ch.memory")} icon={<Icon name="bookmark" size={20} />} tone="lav">
        <p className="mb-2 text-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.wave2Knowledge.profile.approved")}</p>
        {shownApproved.length > 0 ? (
          <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
            {shownApproved.slice(0, 5).map((shown) => (
              <li key={shown.memoryId} className="flex items-start gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-lav-ink)" }} /> <span>{writtenPrefix(shown.fact, shown.createdAt)}<FreeText text={shown.fact} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
            {t("cp.memory.empty", { name: first })}
          </p>
        )}
        {pendingQueue.length > 0 && (
          <p className="text-xs mt-2 font-bold" style={{ color: "var(--arbor-lav-ink)" }}><span className="block">{t("elev.wave2Knowledge.profile.proposed")}</span>{pendingQueue.length === 1 ? t("cp.memory.pendingOne", { count: pendingQueue.length }) : t("cp.memory.pendingMany", { count: pendingQueue.length })}</p>
        )}
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("memory")} color="var(--arbor-lav-ink)">{t("cp.reviewMemory", { name: first })}</JumpLink></div>
      </SectionCard>
      </div>

      {/* Footer jump strip — the deep tools, one tap away */}
      <div data-module="profile-jump-strip" data-module-demoted className="grid min-w-0 gap-3 sm:grid-cols-3">
        {([
          { tab: "timeline" as const, tone: "sky" as const, icon: <Icon name="route" size={18} />, label: t("cp.footer.story", { name: first }) },
          { tab: "behaviors" as const, tone: "coral" as const, icon: <Icon name="monitoring" size={18} />, label: t("cp.footer.moments") },
          // W2-GROWTH r2: Ask Arbor is a door — it left the identity header.
          { tab: "coach" as const, tone: "lav" as const, icon: <Icon name="auto_awesome" size={18} />, label: t("cp.askAbout", { name: first }) },
          // OBJ-PROFILE-03: the memory door was rendered twice on one screen —
          // chapter 6 IS "what Arbor remembers" and carries its own review
          // link, so this footer tile was a second door to the same room.
        ]).map((l) => (
          <button key={l.tab} onClick={() => setActiveTab(l.tab)} className={`${cardCls} min-h-11 p-4 text-start flex items-center gap-3 transition motion-safe:hover:-translate-y-0.5`}>
            <IconBadge tone={l.tone}>{l.icon}</IconBadge>
            <span className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              {l.label} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" style={{ color: PASTEL[l.tone].ink }} />
            </span>
          </button>
        ))}
      </div>
        </div>
      </details>

      <ProfileEditDrawer open={editingProfile} onClose={() => setEditingProfile(false)} />
    </motion.div>
  );
}

function Field({ label, value, asOf }: { label: string; value: string; asOf?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{value}</p>
      {asOf}
    </div>
  );
}

/** A Family Circle member row: shared 54px InitialsTile + name + role line.
 *  Uses dir="auto" on the name so email/Hebrew names align correctly under RTL. */
function MemberRow({ name, roleLine, tone }: { name: string; roleLine: string; tone: PastelKey }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2">
      <InitialsTile name={name} tone={tone} size={42} radius={14} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold break-words" dir="auto" style={{ color: "var(--arbor-ink)" }}>{name}</p>
        <p className="text-xs break-words" style={{ color: "var(--arbor-muted)" }}>{roleLine}</p>
      </div>
    </div>
  );
}

/** The chapter-to-chapter link on Profile. One primitive, every site: the glyph
 *  and the type size are unchanged — only the hit box grows to the 44 px floor
 *  (`--touch-min`, DESIGN.md), which it reached by 16 px before. `.touch-target`
 *  (index.css:436) sets both minimums; the negative inline margin keeps the
 *  visual row spacing the smaller box used to give. */
function JumpLink({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="touch-target -mx-2 gap-1 px-2 text-xs font-bold"
      style={{ color }}
    >
      {children} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
    </button>
  );
}
