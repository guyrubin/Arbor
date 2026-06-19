import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { GraduationCap, Clock, ArrowLeft, Check, MessageSquareQuote, MoonStar } from "lucide-react";
import { PageHeader, cardCls, IconBadge, type PastelKey } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";
import { MASTERCLASSES, FRAME_LABELS, type FrameId, type Masterclass } from "../../lib/masterclasses";
import { loadCharter, aimVirtues } from "../../lib/becoming";
import type { DevelopmentMetricId } from "../../types";

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

/** Arbor Academy › Parent Masterclasses — short, frame-routed lessons that build
 *  the parent's own competence (the calm, competent adult). Text-first, bilingual. */
export default function Masterclasses() {
  const { t, aiLang } = useLanguage();
  const he = aiLang === "he";
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => { setDone(loadDone()); }, []);
  const markDone = (id: string) => {
    setDone((d) => {
      const next = { ...d, [id]: true };
      try { localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
  if (open) return <Reader m={open} he={he} isDone={!!done[open.id]} onDone={() => markDone(open.id)} onBack={() => setOpenId(null)} frameLabel={frameLabel(open.frame)} tone={FRAME_TONE[open.frame]} />;

  // ── Catalog ──────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader title={t("sec.master.title")} subtitle={t("sec.master.sub")} />
      {recommended.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
          <p className="text-[11px] uppercase tracking-widest font-bold mb-2.5" style={{ color: "var(--arbor-green-ink)" }}>
            {he ? "מומלץ למשפחה שלכם" : "Recommended for your family"}
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
                {done[c.id] && <Check className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {MASTERCLASSES.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className={`${cardCls} p-5 flex flex-col gap-3 text-left transition hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between">
              <IconBadge tone={FRAME_TONE[c.frame]}><GraduationCap className="w-5 h-5" /></IconBadge>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                <Clock className="w-3 h-3" /> {c.durationMin} {he ? "דק'" : "min"}
              </span>
            </div>
            <h3 className="text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
              {he ? c.titleHe : c.title}
            </h3>
            <p className="text-[12.5px] leading-relaxed line-clamp-2" dir="auto" style={{ color: "var(--arbor-muted)" }}>
              {he ? c.hookHe : c.hook}
            </p>
            <div className="mt-auto flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {frameLabel(c.frame)}
              </span>
              {done[c.id]
                ? <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-green-ink)" }}><Check className="w-3.5 h-3.5" /> {he ? "הושלם" : "Done"}</span>
                : <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{he ? "קראו" : "Read"} →</span>}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Reader({ m, he, isDone, onDone, onBack, frameLabel, tone }: {
  m: Masterclass; he: boolean; isDone: boolean; onDone: () => void; onBack: () => void; frameLabel: string; tone: PastelKey;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-[760px]">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> {he ? "כל השיעורים" : "All masterclasses"}
      </button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconBadge tone={tone}><GraduationCap className="w-5 h-5" /></IconBadge>
          <span className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{frameLabel}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}><Clock className="w-3 h-3" /> {m.durationMin} {he ? "דק'" : "min"}</span>
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
          <MessageSquareQuote className="w-3.5 h-3.5" /> {he ? "מה לומר" : "What to say"}
        </p>
        <p className="text-[14px] leading-relaxed italic" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? m.parentScriptHe : m.parentScript}</p>
      </div>

      {/* Try tonight */}
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold mb-1.5 inline-flex items-center gap-1.5" style={{ color: "var(--arbor-muted)" }}>
          <MoonStar className="w-3.5 h-3.5" /> {he ? "נסו הערב" : "Try tonight"}
        </p>
        <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? m.tryTonightHe : m.tryTonight}</p>
      </div>

      {isDone ? (
        <div className="text-center text-sm font-bold inline-flex items-center justify-center gap-2 w-full" style={{ color: "var(--arbor-green-ink)" }}>
          <Check className="w-4 h-4" /> {he ? "סומן כהושלם" : "Marked complete"}
        </div>
      ) : (
        <button onClick={onDone} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]" style={{ background: "var(--gradient-cta)" }}>
          <Check className="w-4 h-4" /> {he ? "סמנו כהושלם" : "Mark complete"}
        </button>
      )}
    </motion.div>
  );
}
