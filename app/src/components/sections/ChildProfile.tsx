import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Album } from "lucide-react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { PageHeader, SectionCard, Chip, IconBadge, InitialsTile, cardCls, PASTEL, type PastelKey } from "../ui/kit";
import { HubHero } from "../ui/HubHero";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { api } from "../../lib/api";
import type { ShareGrant } from "../../types";
import ProfileEditDrawer from "../profile/ProfileEditDrawer";

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
    behaviorLogs, playLogs, actionPlans, approvedMemoryItems, pendingMemoryItems, setActiveTab,
  } = useArbor();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { hasHero, name: heroName } = useHeroAvatar();
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

  // Chapter 2 — what this week actually looked like, from the real log.
  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    const recent = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
    return { count: recent.length, latest: recent[0] ?? null, resolved: recent.filter((l) => l.resolved).length };
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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* ── E2 hub hero — the family-album job sentence + one CTA (add a member,
          via the SAME Trusted Sharing route the Family Circle card uses) + a
          living count trio. FIREWALL: counts only — the child in this profile,
          people in the circle (account holder + live ShareGrants), and total
          captured moments (behavior + play logs, the album motif). ─────────── */}
      <HubHero
        tone="yellow"
        icon={Album}
        eyebrow={t("elev.hero.profile.eyebrow")}
        title={t("elev.hero.profile.title")}
        subtitle={t("elev.hero.profile.sub", { name: first })}
        cta={{
          label: t("elev.hero.profile.cta"),
          icon: <Icon name="person_add" size={16} />,
          onClick: () => setActiveTab("sharing"),
          testId: "profile-hero-cta",
        }}
        stats={[
          { value: 1, label: t("elev.stat.children") },
          { value: shares.length + 1, label: t("elev.stat.family") },
          { value: behaviorLogs.length + playLogs.length, label: t("elev.stat.moments") },
        ]}
        testId="profile-hub-hero"
      />

      {/* ── Identity masthead (UC-1) — the child identity card and the live Family
          Circle sit side by side ABOVE the full developmental narrative below.
          Additive: every chapter is preserved beneath it. ──────────────────── */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Child card — the framed identity hero. Avatar renders THROUGH the shared
            HeroAvatar engine (Loop 4); we never re-composite the portrait. */}
        <div className={`${cardCls} overflow-hidden min-w-0`}>
            <div className="h-[90px]" style={{ background: "var(--arbor-gradient-primary)" }} aria-hidden />
            <div className="px-5 pb-5">
              <div className="-mt-[38px] mb-3">
                {/* `decorative`: the child's name is the h2 right below, so the
                    portrait must not double-announce (engine-documented pattern). */}
                <HeroAvatar size={72} mood="wave" ring decorative />
              </div>
              <h2 className="text-xl font-extrabold leading-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {childProfile.name}
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{cardSubtitle}</p>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="mt-4 inline-flex items-center gap-2 min-h-[44px] rounded-xl px-4 py-2.5 text-xs font-extrabold"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
              >
                <Icon name="edit" size={16} /> Edit what Arbor knows
              </button>
              {!hasHero && (
                <button onClick={() => setActiveTab("profile")} className="mt-3 text-start block">
                  <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>
                    <Icon name="auto_awesome" size={16} className="inline-block me-1 -mt-0.5" style={{ verticalAlign: "middle" }} /> {t("cp.hero.create", { name: heroName })}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("cp.hero.subline")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Family Circle — reads live ShareGrants (the SAME source Trusted Sharing
              uses); "Add a member" routes there rather than duplicating its form. */}
          <SectionCard title={t("cp.family.title")} icon={<Icon name="group" size={20} />} tone="mint">
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
                  <Icon name="person_add" size={20} />
                </span>
                <span className="text-sm font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{t("cp.family.add")}</span>
              </button>
            </div>
          </SectionCard>
      </div>

      <section
        className="rounded-[22px] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "var(--arbor-lav-soft)", border: "1px solid var(--arbor-rule)" }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0 rounded-2xl"
          style={{ width: 46, height: 46, background: "var(--arbor-paper-elevated)", color: "var(--arbor-lav-ink)" }}
        >
          <Icon name="bookmark" size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("cp.ch.memory")}
          </h2>
          <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>
            <strong style={{ color: "var(--arbor-ink)" }}>{approvedMemoryItems.length}</strong> {t("coach.approved")} ·{" "}
            <strong style={{ color: "var(--arbor-ink)" }}>{pendingMemoryItems.length}</strong> {t("coach.pending")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 min-h-[44px] text-[12px] font-extrabold"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          {t("cp.reviewMemory", { name: first })} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
        </button>
      </section>

      <PageHeader
        eyebrow={t("cp.eyebrow")}
        title={t("cp.title", { name: first })}
        subtitle={t("cp.subtitle", { name: first })}
        action={
          <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--shadow-green)" }}>
            <Icon name="auto_awesome" size={16} /> {t("cp.askAbout", { name: first })}
          </button>
        }
      />

      {/* Chapter 1 — who {first} is */}
      <SectionCard title={t("cp.ch.who", { name: first, age: childProfile.age })} icon={<Icon name="person" size={20} />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label={t("cp.f.languages")} value={childProfile.languages.join(" · ") || "—"} />
          <Field label={t("cp.f.school")} value={childProfile.schoolContext || "—"} />
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
      <SectionCard title={t("cp.ch.now")} icon={<Icon name="monitoring" size={20} />} tone="coral">
        {week.count > 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              {week.count === 1
                ? t("cp.now.countOne", { count: week.count })
                : t("cp.now.countMany", { count: week.count })}
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
      <SectionCard title={t("cp.ch.milestones")} icon={<Icon name="check_circle" size={20} fill={1} />} tone="mint">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${milestonesPercent}%`, background: "var(--arbor-gradient-progress)" }} />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
              <strong style={{ color: "var(--arbor-ink)" }}>{t("cp.ms.progress", { checked: checkedMilestones, total: totalMilestones, age: childProfile.age })}</strong>
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
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
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
        </SectionCard>
        <SectionCard title={t("cp.ch.support")} icon={<Icon name="eco" size={20} />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                  {t("cp.buildPlan")} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                </button>
              </li>
            ))}
            {childProfile.challenges.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("cp.support.empty")}</li>}
          </ul>
        </SectionCard>
      </div>

      {/* Chapter 5 — language & communication */}
      <SectionCard title={t("cp.ch.language")} icon={<Icon name="translate" size={20} />} tone="sky">
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
          {childProfile.languages.length > 1
            ? t("cp.lang.multi", { name: first, langs: childProfile.languages.join(t("cp.lang.and")) })
            : t("cp.lang.single", { name: first, lang: childProfile.languages[0] || t("cp.lang.notSet") })}
        </p>
        <div className="mt-3"><JumpLink onClick={() => setActiveTab("language")} color="var(--arbor-sky-ink)">{t("cp.openLang")}</JumpLink></div>
      </SectionCard>

      {/* Chapter 6 — what Arbor remembers (the parent-approved memory) */}
      <SectionCard title={t("cp.ch.memory")} icon={<Icon name="bookmark" size={20} />} tone="lav">
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
      <SectionCard title={t("cp.ch.next")} icon={activePlan ? <Icon name="tune" size={20} /> : <Icon name="fact_check" size={20} />} tone="yellow">
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
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        {([
          { tab: "timeline" as const, tone: "sky" as const, icon: <Icon name="route" size={18} />, label: t("cp.footer.story", { name: first }) },
          { tab: "behaviors" as const, tone: "coral" as const, icon: <Icon name="monitoring" size={18} />, label: t("cp.footer.moments") },
          { tab: "memory" as const, tone: "lav" as const, icon: <Icon name="bookmark" size={18} />, label: t("cp.footer.memory") },
        ]).map((l) => (
          <button key={l.tab} onClick={() => setActiveTab(l.tab)} className={`${cardCls} p-4 text-start flex items-center gap-3 transition hover:-translate-y-0.5`}>
            <IconBadge tone={l.tone}>{l.icon}</IconBadge>
            <span className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              {l.label} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" style={{ color: PASTEL[l.tone].ink }} />
            </span>
          </button>
        ))}
      </div>
      <ProfileEditDrawer open={editingProfile} onClose={() => setEditingProfile(false)} />
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
      {children} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
    </button>
  );
}
