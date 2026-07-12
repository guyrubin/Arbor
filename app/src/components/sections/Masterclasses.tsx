import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { GraduationCap } from "lucide-react";
import { Icon } from "../ui/Icon";
import { HubHero } from "../ui/HubHero";
import { SpineRibbon } from "../ui/SpineRibbon";
import { EvidenceChip } from "../ui/EvidenceChip";
import { PageHeader, cardCls, IconBadge, ProgressBar, PASTEL, type PastelKey } from "../ui/kit";
import { BRAND_CONFETTI } from "../../lib/tokens";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { MASTERCLASSES, FRAME_LABELS, type FrameId, type Masterclass } from "../../lib/masterclasses";
import { loadCharter, aimVirtues } from "../../lib/becoming";
import type { DevelopmentMetricId } from "../../types";
// AP-055: Scholar Hub weekly concept feed
import ScholarHubCard from "./ScholarHubCard";
// AP-053: Academy "For You" — copilot focus + Learning Map join
import AcademyForYou from "./AcademyForYou";

const FRAME_TONE: Record<FrameId, PastelKey> = {
  aim: "sky",
  twoAxes: "mint",
  story: "lav",
  shadow: "coral",
  marriage: "pink",
  shepherd: "yellow",
};

/** Which virtues each masterclass builds — used to recommend by the Family Charter. */
const MASTERCLASS_VIRTUES: Record<string, DevelopmentMetricId[]> = {
  "holding-the-line-without-anger": ["wisdom", "responsibility"],
  "building-responsibility-by-age": ["responsibility"],
  "repair-after-conflict": ["empathy", "truth"],
  "raising-courage-without-harshness": ["courage", "resilience"],
};

const DONE_KEY = "arbor.masterclasses.done";
const loadDone = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || "{}"); } catch { return {}; }
};

// Wave-8: private parent reflection — client-only localStorage, never sent/stored server-side.
const REFLECT_KEY = "arbor.masterclasses.reflection";
const loadReflection = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(REFLECT_KEY) || "{}"); } catch { return {}; }
};

/** Arbor Academy › Parent Masterclasses — short, frame-routed lessons that build
 *  the parent's own competence (the calm, competent adult). Text-first, bilingual. */
export default function Masterclasses() {
  const { t, aiLang } = useLanguage();
  const { childProfile, setActiveTab } = useArbor();
  const he = aiLang === "he";
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [reflection, setReflection] = useState<Record<string, string>>({});

  useEffect(() => { setDone(loadDone()); setReflection(loadReflection()); }, []);
  const markDone = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: true };
      try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const saveReflection = (id: string, val: string) => {
    setReflection((r) => {
      const next = { ...r, [id]: val };
      try { localStorage.setItem(REFLECT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const open = openId ? MASTERCLASSES.find((m) => m.id === openId) ?? null : null;
  const frameLabel = (f: FrameId) => (he ? FRAME_LABELS[f].he : FRAME_LABELS[f].en);

  // D3: recommend the masterclasses that build the family's chosen virtues.
  const aims = aimVirtues(loadCharter());
  const recommended = aims.length
    ? MASTERCLASSES.filter((m) => (MASTERCLASS_VIRTUES[m.id] || []).some((v) => aims.includes(v)))
    : [];

  // ── Reader ───────────────────────────────────────────────────────────────
  if (open) return <Reader m={open} he={he} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} frameLabel={frameLabel(open.frame)} tone={FRAME_TONE[open.frame]} reflection={reflection[open.id] || ""} onReflect={(val) => saveReflection(open.id, val)} />;

  // ── Catalog ──────────────────────────────────────────────────────────────
  const doneCount = Object.values(done).filter(Boolean).length;
  const total = MASTERCLASSES.length;
  const allDone = doneCount >= total;
  const childName = (childProfile.name || "").split(" ")[0] || (he ? "ילדכם" : "your child");

  // E2 hero — the next unfinished course drives the ONE CTA and the
  // minutes-to-next count. CLINICAL FIREWALL: the stat trio is counts and a
  // plain duration fact only (total courses / completed / minutes to next).
  // There is no per-course "started" state in the app — we render the honest
  // catalog count instead of fabricating one.
  const nextCourse = MASTERCLASSES.find((m) => !done[m.id]);
  const heroStats = [
    { value: total, label: t("elev.hero.academy.stat.courses") },
    { value: doneCount, label: t("elev.hero.academy.stat.completed") },
    ...(nextCourse ? [{ value: nextCourse.durationMin, label: t("elev.hero.academy.stat.minNext") }] : []),
  ];

  return (
    <>
      {/* E2 — Academy hub hero: sits ABOVE the existing page (outside the
          page's motion wrapper — HubHero runs its own reduced-motion-gated
          entrance). E8: EvidenceChip on the hero's meta row. */}
      <div className="max-w-[1180px]">
        <HubHero
          tone="sky"
          icon={GraduationCap}
          eyebrow={t("elev.hero.academy.eyebrow")}
          title={t("elev.hero.academy.title", { name: childName })}
          subtitle={t("elev.hero.academy.sub")}
          cta={nextCourse ? {
            label: t("elev.hero.academy.cta"),
            onClick: () => setOpenId(nextCourse.id),
            icon: <Icon name="school" size={16} />,
            testId: "academy-hero-cta",
          } : undefined}
          stats={heroStats}
          testId="academy-hub-hero"
        />
        {/* Meta row — pulled up under the hero (hero carries its own mb-6). */}
        <div className="-mt-3 mb-6 flex items-center px-1">
          <EvidenceChip />
        </div>
      </div>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader title={t("sec.master.title")} subtitle={t("sec.master.sub")} />

      {/* Design's two-column shell: left = the Learning Map rail (the explicit
          development-map spine — courses matched to where the child is growing),
          right = the "All courses" gallery. Collapses to one column below xl. */}
      <div className="grid xl:grid-cols-[1fr_1.7fr] gap-5 items-start">
        {/* ── Left rail: Learning Map ─────────────────────────────────────── */}
        <div className="space-y-5">
          <p className="text-[11px] uppercase tracking-widest font-bold px-1" style={{ color: "var(--arbor-green-ink)" }}>
            {t("academy.learnMap.title")}
            <span className="block normal-case tracking-normal text-[12px] font-medium mt-1" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {t("academy.learnMap.sub", { name: childName })}
            </span>
          </p>

          {/* AP-053: Academy "For You" — copilot focus recommendation + per-domain
              Learning Map roll-up (ring + count bars). Pure frontend join; no new
              AI call; no new Firestore read. Least-explored framing (board-cleared). */}
          <AcademyForYou />

          {/* AP-055: Scholar Hub — one developmental concept per week, auto-matched
              to the child's least-explored domain. Non-diagnostic, editorial. */}
          <ScholarHubCard />

          {/* Recommended-by-Family-Charter strip — relocated into the rail. */}
          {recommended.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
              <p className="text-[11px] uppercase tracking-widest font-bold mb-2.5" style={{ color: "var(--arbor-green-ink)" }}>
                {t("master.rec")}
              </p>
              <div className="flex flex-wrap gap-2">
                {recommended.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition hover:-translate-y-0.5"
                    dir="auto"
                    style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    {he ? c.titleHe : c.title}
                    {done[c.id] && <Icon name="check" size={15} fill={1} style={{ color: "var(--arbor-green-ink)" }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Catalog-wide progress — relocated beneath the Learning Map. Gentle
              continuity, never gamified pressure. */}
          {doneCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / total) * 100}%`, background: "var(--arbor-green-ink)" }} />
              </div>
              <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: allDone ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>
                {allDone ? t("master.progress.all") : t("master.progress.count", { done: doneCount, total })}
              </span>
            </div>
          )}
        </div>

        {/* ── Right column: All courses gallery ───────────────────────────── */}
        <div className="space-y-4 min-w-0">
          <h2 className="text-[15px] font-extrabold uppercase tracking-widest px-1" style={{ color: "var(--arbor-muted)" }}>
            {t("academy.courses.title")}
          </h2>
          {/* E3 — spine ribbon: what feeds the course grid (one direction:
              → Development Map). */}
          <SpineRibbon
            tone="sky"
            icon="account_tree"
            text={t("elev.spine.academy")}
            onFollow={() => setActiveTab("development")}
            testId="academy-spine-ribbon"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            {MASTERCLASSES.map((c) => {
              const p = PASTEL[FRAME_TONE[c.frame]];
              const isCardDone = !!done[c.id];
              // Lesson count = number of authored sections (an honest catalog
              // fact, never a fabricated granular %). Pairs with duration in the
              // meta line ("N lessons · M min").
              const lessons = c.sections.length;
              return (
                <button
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className={`${cardCls} flex flex-col text-start overflow-hidden transition motion-safe:hover:-translate-y-0.5`}
                >
                  {/* Gradient header band — pulled from FRAME_TONE → PASTEL (soft→
                      elevated). No raw hex; Material Symbols "school" centred. */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      height: 74,
                      background: `linear-gradient(135deg, ${p.soft}, var(--arbor-paper-elevated))`,
                    }}
                  >
                    <span className="inline-flex items-center justify-center rounded-2xl" style={{ background: p.soft, color: p.ink, width: 44, height: 44 }}>
                      <Icon name="school" size={24} fill={1} />
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-2 p-5 flex-1">
                    {/* domain/frame pill at the top of the body */}
                    <span className="self-start text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: p.soft, color: p.ink }}>
                      {frameLabel(c.frame)}
                    </span>
                    <h3 className="text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      {he ? c.titleHe : c.title}
                    </h3>
                    {/* meta line — "N lessons · M min" (honest catalog facts) */}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold flex-wrap" style={{ color: "var(--arbor-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icon name="menu_book" size={13} /> {t("academy.lessons", { n: lessons })}</span>
                      <span aria-hidden="true" style={{ opacity: 0.6 }}>·</span>
                      <span className="inline-flex items-center gap-1"><Icon name="schedule" size={13} /> {c.durationMin} {t("master.min")}</span>
                    </span>
                    <p className="text-[12.5px] leading-relaxed line-clamp-2" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                      {he ? c.hookHe : c.hook}
                    </p>

                    {/* Per-card progress — binary 0/100 from the existing done
                        localStorage state. The app has NO granular course % model,
                        so the bar is strictly empty or full (1-of-1 done count),
                        never a fabricated continuous percentage. */}
                    <div className="mt-auto pt-3 space-y-3">
                      <ProgressBar value={isCardDone ? 1 : 0} total={1} tone="mint" height={6} />
                      {/* Footer status chip CTA */}
                      <span
                        className="inline-flex items-center justify-center gap-1.5 w-full rounded-full px-3 py-1.5 text-[12px] font-extrabold"
                        style={
                          isCardDone
                            ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                            : { background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
                        }
                      >
                        {isCardDone
                          ? <><Icon name="check" size={15} fill={1} /> {t("master.done")}</>
                          : <>{t("master.read")} →</>}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
    </>
  );
}

function Reader({ m, he, isDone, onDone, onBack, frameLabel, tone, reflection, onReflect }: {
  m: Masterclass; he: boolean; isDone: boolean; onDone: () => void; onBack: () => void; frameLabel: string; tone: PastelKey; reflection: string; onReflect: (v: string) => void;
}) {
  const { t } = useLanguage();
  // Wave-8: a single subtle brand-colored burst on completing a lesson (respects reduced-motion).
  const onComplete = () => {
    if (typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 90, spread: 75, startVelocity: 45, origin: { y: 0.7 }, colors: BRAND_CONFETTI, disableForReducedMotion: true });
    }
    onDone();
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 max-w-[760px]">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="arrow_back" size={16} /> {t("master.all")}
      </button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconBadge tone={tone}><Icon name="school" size={20} /></IconBadge>
          <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{frameLabel}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}><Icon name="schedule" size={13} /> {m.durationMin} {t("master.min")}</span>
        </div>
        <h1 className="text-2xl md:text-[1.9rem] leading-tight tracking-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {he ? m.titleHe : m.title}
        </h1>
        <p className="text-[15px] leading-relaxed mt-2" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {he ? m.hookHe : m.hook}
        </p>
      </div>

      <div className="space-y-5">
        {m.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-[15px] font-extrabold mb-1" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? s.headingHe : s.heading}</h2>
            <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{he ? s.bodyHe : s.body}</p>
          </section>
        ))}
      </div>

      {/* What to say — the verbatim parent script */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="format_quote" size={15} fill={1} /> {t("master.whatToSay")}
        </p>
        <p className="text-[15px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontStyle: "italic" }}>{he ? m.parentScriptHe : m.parentScript}</p>
      </div>

      {/* Try tonight */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="bedtime" size={15} fill={1} /> {t("master.tryTonight")}
        </p>
        <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? m.tryTonightHe : m.tryTonight}</p>
      </div>

      {/* Wave-8: private parent reflection — client-only localStorage, never sent or stored server-side. */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="edit_note" size={16} fill={1} /> {t("master.reflect.label")}
        </p>
        <textarea
          value={reflection}
          onChange={(e) => onReflect(e.target.value)}
          placeholder={t("master.reflect.placeholder")}
          dir="auto"
          rows={2}
          className="w-full text-[14px] leading-relaxed rounded-lg px-3 py-2 resize-y min-h-[64px] focus:outline-none focus:ring-2"
          style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-sunk)", border: "1px solid var(--arbor-rule)" }}
        />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--arbor-faint)" }}>{t("master.reflect.hint")}</p>
      </div>

      {isDone ? (
        <div className="text-center text-sm font-bold inline-flex items-center justify-center gap-2 w-full" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markedComplete")}
        </div>
      ) : (
        <button onClick={onComplete} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: "var(--gradient-cta)" }}>
          <Icon name="check" size={17} fill={1} /> {t("master.markComplete")}
        </button>
      )}
    </motion.div>
  );
}
