import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  UserCircle, CheckCircle2, Activity, Languages, Gem, Sprout, ArrowRight, Sparkles,
  BookMarked, Waypoints, ClipboardCheck, Sliders, Users, UserPlus, RefreshCw, ListChecks,
  type LucideIcon,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { PageHeader, SectionCard, Chip, IconBadge, InitialsTile, Badge, cardCls, PASTEL, type PastelKey } from "../ui/kit";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { api } from "../../lib/api";
import type { ShareGrant } from "../../types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Child Intelligence › Development Profile — ONE scrolling narrative ("My Child"
 * unification). Instead of sending the parent into seven sibling tabs, this page
 * tells the child's whole story top-to-bottom — who they are, what's happening
 * now, milestones, strengths, language, what Arbor remembers, and the next step
 * — with each chapter linking into its full tool.
 */
export default function ChildProfile() {
  const {
    childProfile, milestones, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, actionPlans, approvedMemoryItems, pendingMemoryItems, setActiveTab,
  } = useArbor();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { hasHero, name: heroName } = useHeroAvatar();
  const first = childProfile.name.split(" ")[0];

  // Family Circle reads the SAME live, server-enforced ShareGrants that Trusted
  // Sharing manages — never a parallel store. The account holder is row 0.
  const [shares, setShares] = useState<ShareGrant[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.listShares(childProfile.id)
      .then((r) => { if (!cancelled) setShares(r.shares || []); })
      .catch(() => { if (!cancelled) setShares([]); });
    return () => { cancelled = true; };
  }, [childProfile.id]);

  // Chapter 2 — what this week actually looked like, from the real log.
  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    const recent = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    const avg = recent.length ? recent.reduce((s, l) => s + l.intensity, 0) / recent.length : null;
    return { count: recent.length, avg, latest: recent[0] ?? null, resolved: recent.filter((l) => l.resolved).length };
  }, [behaviorLogs]);

  // Chapter 3 — the next milestones worth watching for this age.
  const nextMilestones = useMemo(() => milestones.filter((m) => !m.checked).slice(0, 3), [milestones]);

  // Chapter 7 — the live plan, if one exists.
  const activePlan = actionPlans[0] ?? null;
  const planProgress = useMemo(() => {
    if (!activePlan) return null;
    let done = 0, total = 0;
    activePlan.phases.forEach((ph) => ph.steps.forEach((s) => { total += 1; if (s.completed) done += 1; }));
    return { done, total };
  }, [activePlan]);

  // Derive the current developmental focus from the child's real profile.
  const challengeText = childProfile.challenges.join(" ");
  const focus = [
    childProfile.languages.length > 1 && { labelKey: "languageTransition", tone: "sky" as const },
    /anx|regulat|meltdown|emotion|sensory/i.test(challengeText) && { labelKey: "emotionalRegulation", tone: "coral" as const },
    /school|kindergarten|class/i.test(childProfile.schoolContext) && { labelKey: "schoolReadiness", tone: "mint" as const },
  ].filter(Boolean) as { labelKey: "languageTransition" | "emotionalRegulation" | "schoolReadiness"; tone: "sky" | "coral" | "mint" }[];

  // Child-card subtitle from REAL data (languages · school) — never the mock's
  // hardcoded "Bilingual · Pre-K". Falls back to languages-only when no school.
  const langs = childProfile.languages.join(" · ");
  const cardSubtitle = childProfile.schoolContext
    ? t("cp.card.subtitle", { langs: langs || "—", school: childProfile.schoolContext })
    : t("cp.card.subtitleNoSchool", { langs: langs || "—" });

  // Activity feed — a scannable "what {first} did recently" surface built ONLY
  // from data already in context (parent-logged moments, approved memory, plan
  // progress). Each row deep-links into its full tool. Counts only, no verdict.
  const activity = useMemo(() => {
    type Row = { key: string; icon: LucideIcon; tone: PastelKey; title: string; sub?: string; tab: Parameters<typeof setActiveTab>[0]; ts: number };
    const rows: Row[] = [];
    behaviorLogs.slice(0, 3).forEach((l) => {
      rows.push({
        key: `b-${l.id}`, icon: Activity, tone: "coral", tab: "behaviors",
        title: t("cp.activity.moment"),
        sub: t("cp.activity.momentSub", { type: l.behaviorType, context: l.context }),
        ts: new Date(l.timestamp).getTime(),
      });
    });
    approvedMemoryItems.slice(0, 2).forEach((m) => {
      rows.push({
        key: `m-${m.memoryId}`, icon: BookMarked, tone: "lav", tab: "memory",
        title: t("cp.activity.memory"), sub: m.fact,
        ts: new Date(m.createdAt).getTime(),
      });
    });
    const plan = actionPlans[0];
    if (plan) {
      let done = 0, total = 0;
      plan.phases.forEach((ph) => ph.steps.forEach((s) => { total += 1; if (s.completed) done += 1; }));
      if (done > 0) rows.push({
        key: `p-${plan.id ?? "active"}`, icon: ListChecks, tone: "mint", tab: "plans",
        title: t("cp.activity.plan"), sub: t("cp.activity.planSub", { done, total }), ts: Date.now(),
      });
    }
    return rows.sort((a, b) => b.ts - a.ts).slice(0, 4);
  }, [behaviorLogs, approvedMemoryItems, actionPlans, t]);

  // "Live" only when there is genuinely recent (<7d) activity — not a faked badge.
  const hasRecent = useMemo(
    () => behaviorLogs.some((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY_MS),
    [behaviorLogs],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      {/* ── Identity masthead (UC-1) — who/identity on the left, recent activity on
          the right — sits ABOVE the full developmental narrative below. Additive:
          every chapter is preserved beneath it. ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {/* Child card — the framed identity hero. Avatar renders THROUGH the shared
              HeroAvatar engine (Loop 4); we never re-composite the portrait. */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="h-[90px]" style={{ background: "var(--arbor-gradient-primary)" }} aria-hidden />
            <div className="px-5 pb-5">
              <div className="-mt-[38px] mb-3">
                <HeroAvatar size={72} mood="wave" ring />
              </div>
              <h2 className="text-xl font-extrabold leading-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {childProfile.name}
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{cardSubtitle}</p>
              {!hasHero && (
                <button onClick={() => setActiveTab("profile")} className="mt-3 text-start block">
                  <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>
                    <Sparkles className="w-4 h-4 inline-block me-1 -mt-0.5" /> {t("cp.hero.create", { name: heroName })}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("cp.hero.subline")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Family Circle — reads live ShareGrants (the SAME source Trusted Sharing
              uses); "Add a member" routes there rather than duplicating its form. */}
          <SectionCard title={t("cp.family.title")} icon={<Users className="w-5 h-5" />} tone="mint">
            <p className="text-xs -mt-2 mb-3" style={{ color: "var(--arbor-muted)" }}>{t("cp.family.sub", { name: first })}</p>
            <div className="space-y-2">
              {/* The account holder is always the first member. */}
              <MemberRow name={user?.displayName || user?.email || t("cp.family.you")} tone="mint" roleLine={t("cp.family.roleParent")} />
              {shares.map((s) => (
                <MemberRow
                  key={s.id}
                  name={s.recipientEmail}
                  tone="sky"
                  roleLine={t(`cp.family.role.${s.role}`, { scopes: s.scopes.join(", ") || "—" })}
                />
              ))}
              {shares.length === 0 && (
                <p className="text-xs px-1" style={{ color: "var(--arbor-muted)" }}>{t("cp.family.empty", { name: first })}</p>
              )}
              <button
                onClick={() => setActiveTab("sharing")}
                className="w-full flex items-center gap-3 rounded-2xl p-2 text-start transition hover:-translate-y-0.5"
              >
                <span className="inline-flex items-center justify-center flex-shrink-0 rounded-[15px]" style={{ width: 42, height: 42, background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                  <UserPlus className="w-5 h-5" />
                </span>
                <span className="text-sm font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{t("cp.family.add")}</span>
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Activity feed — real kid+parent moments from the shared profile. */}
        <SectionCard
          title={t("cp.activity.title", { name: first })}
          icon={<Activity className="w-5 h-5" />}
          tone="sky"
          action={hasRecent ? <Badge tone="sky">{t("cp.activity.live")}</Badge> : <RefreshCw className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} aria-hidden />}
        >
          {activity.length > 0 ? (
            <div className="space-y-2">
              {activity.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveTab(r.tab)}
                  className="w-full flex items-center gap-3 rounded-2xl p-2 text-start transition hover:-translate-y-0.5"
                >
                  <span className="inline-flex items-center justify-center flex-shrink-0 rounded-[12px]" style={{ width: 42, height: 42, background: PASTEL[r.tone].soft, color: PASTEL[r.tone].ink }}>
                    <r.icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold truncate" style={{ color: "var(--arbor-ink)" }}>{r.title}</span>
                    {r.sub && <span className="block text-xs truncate" style={{ color: "var(--arbor-muted)" }} dir="auto">{r.sub}</span>}
                  </span>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: PASTEL[r.tone].ink }} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.activity.empty", { name: first })}</p>
          )}
        </SectionCard>
      </div>

      <PageHeader
        eyebrow={t("cp.eyebrow")}
        title={t("cp.title", { name: first })}
        subtitle={t("cp.subtitle", { name: first })}
        action={
          <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--shadow-green)" }}>
            <Sparkles className="w-4 h-4" /> {t("cp.askAbout", { name: first })}
          </button>
        }
      />

      {/* Chapter 1 — who {first} is */}
      <SectionCard title={t("cp.ch.who", { name: first, age: childProfile.age })} icon={<UserCircle className="w-5 h-5" />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label={t("cp.f.languages")} value={childProfile.languages.join(" · ") || "—"} />
          <Field label={t("cp.f.school")} value={childProfile.schoolContext || "—"} />
          <Field label={t("cp.f.risk")} value={childProfile.riskLevel} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--arbor-muted)" }}>{t("cp.f.focus")}</p>
            <div className="flex flex-wrap gap-1.5">
              {focus.length > 0 ? focus.map((f) => <Chip key={f.labelKey} tone={f.tone}>{t(`cp.focus.${f.labelKey}`)}</Chip>) : <span className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.focus.empty")}</span>}
            </div>
          </div>
          {/* CI-29: Interests field — parent-logged preferences, never interpreted.
              Displayed as read-only lav chips; edit opens ProfileEditDrawer. */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--arbor-muted)" }}>
              {t("cp.f.interests", { name: first })}
            </p>
            {childProfile.interests && childProfile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {childProfile.interests.slice(0, 3).map((interest) => (
                  <Chip key={interest} tone="lav">{interest}</Chip>
                ))}
                {childProfile.interests.length > 3 && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
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
      </SectionCard>

      {/* Chapter 2 — right now: this week's real moments */}
      <SectionCard title={t("cp.ch.now")} icon={<Activity className="w-5 h-5" />} tone="coral">
        {week.count > 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {week.count === 1
                ? t("cp.now.countOne", { count: week.count })
                : t("cp.now.countMany", { count: week.count })}
              {week.avg !== null && <> {t("cp.now.avg", { avg: week.avg.toFixed(1) })}</>}
              {week.resolved > 0 && <> {t("cp.now.resolved", { count: week.resolved })}</>}.
            </p>
            {week.latest && (
              <div className={`${cardCls} p-3.5 text-sm`}>
                <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("cp.now.mostRecent")}</span>
                <p className="mt-1 font-semibold" style={{ color: "var(--arbor-ink)" }}>{week.latest.behaviorType}</p>
                {week.latest.trigger && <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("cp.now.trigger", { trigger: week.latest.trigger })}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.now.empty", { name: first })}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <JumpLink onClick={() => setActiveTab("behaviors")} color="var(--arbor-peach-ink)">{t("cp.openMoments")}</JumpLink>
          <JumpLink onClick={() => setActiveTab("timeline")} color="var(--arbor-peach-ink)">{t("cp.seeStory", { name: first })}</JumpLink>
        </div>
      </SectionCard>

      {/* Chapter 3 — milestones */}
      <SectionCard title={t("cp.ch.milestones")} icon={<CheckCircle2 className="w-5 h-5" />} tone="mint">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${milestonesPercent}%`, background: "var(--arbor-gradient-progress)" }} />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
              <strong style={{ color: "var(--arbor-ink)" }}>{t("cp.ms.progress", { checked: checkedMilestones, total: totalMilestones, pct: milestonesPercent, age: childProfile.age })}</strong>
            </p>
          </div>
        </div>
        {nextMilestones.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("cp.ms.worthWatching")}</span>
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

      {/* Chapter 4 — strengths & where to support */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title={t("cp.ch.strengths")} icon={<Gem className="w-5 h-5" />} tone="mint">
          <ul className="space-y-3">
            {childProfile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{s}</span>
              </li>
            ))}
            {childProfile.strengths.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.strengths.empty")}</li>}
          </ul>
        </SectionCard>
        <SectionCard title={t("cp.ch.support")} icon={<Sprout className="w-5 h-5" />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                  {t("cp.buildPlan")} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {childProfile.challenges.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.support.empty")}</li>}
          </ul>
        </SectionCard>
      </div>

      {/* Chapter 5 — language & communication */}
      <SectionCard title={t("cp.ch.language")} icon={<Languages className="w-5 h-5" />} tone="sky">
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {childProfile.languages.length > 1
            ? t("cp.lang.multi", { name: first, langs: childProfile.languages.join(t("cp.lang.and")) })
            : t("cp.lang.single", { name: first, lang: childProfile.languages[0] || t("cp.lang.notSet") })}
        </p>
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("language")} color="var(--arbor-sky-ink)">{t("cp.openLang")}</JumpLink></div>
      </SectionCard>

      {/* Chapter 6 — what Arbor remembers (the parent-approved memory) */}
      <SectionCard title={t("cp.ch.memory")} icon={<BookMarked className="w-5 h-5" />} tone="lav">
        {approvedMemoryItems.length > 0 ? (
          <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
            {approvedMemoryItems.slice(0, 5).map((m) => (
              <li key={m.memoryId} className="flex items-start gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-lav-ink)" }} /> {m.fact}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
            {t("cp.memory.empty", { name: first })}
          </p>
        )}
        {pendingMemoryItems.length > 0 && (
          <p className="text-xs mt-2 font-bold" style={{ color: "var(--arbor-lav-ink)" }}>{pendingMemoryItems.length === 1 ? t("cp.memory.pendingOne", { count: pendingMemoryItems.length }) : t("cp.memory.pendingMany", { count: pendingMemoryItems.length })}</p>
        )}
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("memory")} color="var(--arbor-lav-ink)">{t("cp.reviewMemory", { name: first })}</JumpLink></div>
      </SectionCard>

      {/* Chapter 7 — the next step */}
      <SectionCard title={t("cp.ch.next")} icon={activePlan ? <Sliders className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />} tone="yellow">
        {activePlan && planProgress ? (
          <>
            <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
              {t("cp.next.active", { title: activePlan.title, done: planProgress.done, total: planProgress.total })}
            </p>
            <div className="mt-3"><JumpLink onClick={() => setActiveTab("plans")} color="var(--arbor-yellow-ink)">{t("cp.continuePlan")}</JumpLink></div>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
              {t("cp.next.none", { name: first })}
            </p>
            <div className="mt-3"><JumpLink onClick={() => setActiveTab("plans")} color="var(--arbor-yellow-ink)">{t("cp.createPlan")}</JumpLink></div>
          </>
        )}
      </SectionCard>

      {/* Footer jump strip — the deep tools, one tap away */}
      <div className="grid sm:grid-cols-3 gap-3">
        {([
          { tab: "timeline" as const, tone: "sky" as const, icon: <Waypoints className="w-4 h-4" />, label: t("cp.footer.story", { name: first }) },
          { tab: "behaviors" as const, tone: "coral" as const, icon: <Activity className="w-4 h-4" />, label: t("cp.footer.moments") },
          { tab: "memory" as const, tone: "lav" as const, icon: <BookMarked className="w-4 h-4" />, label: t("cp.footer.memory") },
        ]).map((l) => (
          <button key={l.tab} onClick={() => setActiveTab(l.tab)} className={`${cardCls} p-4 text-start flex items-center gap-3 transition hover:-translate-y-0.5`}>
            <IconBadge tone={l.tone}>{l.icon}</IconBadge>
            <span className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              {l.label} <ArrowRight className="w-3.5 h-3.5" style={{ color: PASTEL[l.tone].ink }} />
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{value}</p>
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
        <p className="text-sm font-extrabold truncate" dir="auto" style={{ color: "var(--arbor-ink)" }}>{name}</p>
        <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{roleLine}</p>
      </div>
    </div>
  );
}

function JumpLink({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
      {children} <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
