import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  MessageSquare, Plus, RefreshCw, Sun, Sunrise, Moon, ArrowRight,
  Heart, BookOpen, Smile, Phone, ChevronRight, BookMarked,
  Share2, Waypoints, ClipboardCheck,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ProgressRing } from "../ui/ProgressRing";
import { Skeleton } from "../ui/Skeleton";
import { ParentChildIllustration } from "../ui/ParentChildIllustration";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import QuickLogModal from "../overview/QuickLogModal";
import RemindersCard from "../overview/RemindersCard";
import TrendsChart from "../overview/TrendsChart";
import GoalsCard from "../overview/GoalsCard";
import DailyCheckinCard from "../overview/DailyCheckinCard";
import { PASTEL, PastelKey, cardCls } from "../ui/kit";

const card = cardCls;
const DAY = 86_400_000;

export default function OverviewTab() {
  const {
    setActiveTab, milestonesPercent, checkedMilestones, totalMilestones,
    behaviorLogs, childProfile, setPlanChallengeTopic, setChatInput,
    pendingMemoryItems, approvedMemoryItems,
  } = useArbor();

  const [quickLog, setQuickLog] = useState(false);
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const photoUrl = (childProfile as unknown as { photoUrl?: string }).photoUrl;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? { text: "Good morning", icon: <Sunrise className="w-4 h-4" /> }
    : hour < 18 ? { text: "Good afternoon", icon: <Sun className="w-4 h-4" /> }
    : { text: "Good evening", icon: <Moon className="w-4 h-4" /> };

  const recentCount = useMemo(
    () => behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= Date.now() - 7 * DAY).length,
    [behaviorLogs]
  );

  const { weekAvg, trend } = useMemo(() => {
    const now = Date.now();
    const inWindow = (start: number, end: number) =>
      behaviorLogs.filter((l) => { const t = new Date(l.timestamp).getTime(); return t >= start && t < end; });
    const avg = (arr: typeof behaviorLogs) => (arr.length ? arr.reduce((s, l) => s + l.intensity, 0) / arr.length : 0);
    const r = avg(inWindow(now - 7 * DAY, now + DAY));
    const p = avg(inWindow(now - 14 * DAY, now - 7 * DAY));
    const t: "up" | "down" | "flat" = r > p + 0.1 ? "up" : r < p - 0.1 ? "down" : "flat";
    return { weekAvg: r, trend: t };
  }, [behaviorLogs]);

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = ""; let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);

  const { focus, loading: focusLoading, regenerate } = useTodaysFocus(childProfile, {
    count: recentCount, avg: weekAvg, topTrigger, milestonesPercent,
  });

  // One-line pulse: how the week is going, in plain words.
  const pulse =
    recentCount === 0 ? `Start ${firstName}'s story by capturing a moment or asking a question.`
    : trend === "down" ? `${firstName} has had a calmer week. Hard moments are easing.`
    : trend === "up" ? `${firstName}'s harder moments have picked up a little this week.`
    : `${firstName}'s week looks steady, in line with last week.`;

  const recommendations: { tone: PastelKey; icon: React.ReactNode; title: string; desc: string; tab: any }[] = [
    { tone: "mint", icon: <Heart className="w-5 h-5" />, title: "Connect through play", desc: "Ten minutes of child-led play to refill the tank.", tab: "plans" },
    { tone: "coral", icon: <Smile className="w-5 h-5" />, title: "Name the feeling", desc: `A quick co-regulation script for ${firstName}'s big moments.`, tab: "coach" },
    { tone: "lav", icon: <BookOpen className="w-5 h-5" />, title: "Tonight's hero story", desc: "A short story that builds courage and resilience.", tab: "stories" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 relative max-w-[1100px]"
    >
      {/* ── Greeting + one-line pulse ───────────────────────────────────── */}
      <section className="flex items-center gap-4 md:gap-5">
        <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full p-[3px] flex-shrink-0" style={{ background: "linear-gradient(135deg,#5fce97,#34b277)" }}>
          <div className="w-full h-full rounded-full bg-white p-[3px]">
            {photoUrl ? (
              <img src={photoUrl} alt={firstName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center text-2xl font-extrabold" style={{ background: "#e4f4ec", color: "#1f8a5a", fontFamily: "var(--font-display)" }}>
                {firstName.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "#1f8a5a" }}>{greeting.icon} {greeting.text}</span>
          <h1 className="text-2xl md:text-[1.9rem] font-extrabold leading-[1.1] mt-0.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" } as React.CSSProperties}>
            {pulse}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>
            {firstName}, age {childProfile.age}{childProfile.schoolContext ? ` · ${childProfile.schoolContext}` : ""}
          </p>
        </div>
      </section>

      {/* ── Today's one next step (the dominant action zone) ────────────── */}
      <section className={`${card} p-6 md:p-7`} style={{ boxShadow: "0 6px 22px rgba(52,178,119,0.10)" }}>
        <span className="text-[12px] font-extrabold" style={{ color: "#1f8a5a" }}>Today for {firstName}</span>
        <div className="mt-2 min-h-[2.5rem]">
          {focusLoading && !focus ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
          ) : focus ? (
            <p className="text-[17px] leading-relaxed font-medium" style={{ color: "var(--arbor-ink)", textWrap: "pretty" } as React.CSSProperties}>{focus.text}</p>
          ) : recentCount > 0 ? (
            <p className="text-[17px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>Looking at {firstName}'s week to pick today's focus…</p>
          ) : (
            <p className="text-[17px] leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
              Tell Arbor about a hard moment, or log one, and you'll get a calm, age-aware next step, plus a picture of {firstName} that grows over time.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          <button
            onClick={() => setQuickLog(true)}
            className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.26)" }}
          >
            <Plus className="w-4 h-4" /> Log a moment
          </button>
          <button
            onClick={() => { if (focus) setChatInput(`About today: ${focus.text} What is one concrete thing I can do for ${firstName} today?`); setActiveTab("coach"); }}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition"
            style={{ background: "#e4f4ec", color: "#1f8a5a" }}
          >
            <MessageSquare className="w-4 h-4" /> Ask Arbor
          </button>
          {focus && (
            <button
              onClick={() => void regenerate()}
              disabled={focusLoading}
              title="Suggest another focus"
              aria-label="Suggest another focus"
              className="inline-flex items-center justify-center w-10 h-10 rounded-2xl transition disabled:opacity-50"
              style={{ background: "var(--arbor-paper-deep)", color: "#1f8a5a" }}
            >
              <RefreshCw className={`w-4 h-4 ${focusLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </section>

      {/* ── How your child is doing (the picture, with the moat folded in) ─ */}
      <section className={`${card} overflow-hidden`}>
        <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>How {firstName} is doing</h2>
          <button onClick={() => setActiveTab("timeline")} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#1f8a5a" }}>
            Open {firstName}'s story <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid sm:grid-cols-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
          {/* Milestones */}
          <button onClick={() => setActiveTab("milestones")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderRight: "1px solid var(--arbor-rule)" }}>
            <ProgressRing value={milestonesPercent} size={52} stroke={6}>
              <span className="text-[12px] font-extrabold" style={{ color: "#1f8a5a" }}>{milestonesPercent}%</span>
            </ProgressRing>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                <AnimatedNumber value={checkedMilestones} /> of {totalMilestones} milestones
              </span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>noticed for age {childProfile.age}</span>
            </span>
          </button>

          {/* Memory (the moat) */}
          <button onClick={() => setActiveTab("memory")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]" style={{ borderRight: "1px solid var(--arbor-rule)" }}>
            <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: pendingMemoryItems.length ? "#fbf1d4" : "#ece9fb", color: pendingMemoryItems.length ? "#a9780f" : "#6354c4" }}>
              <BookMarked className="w-6 h-6" />
            </span>
            <span className="min-w-0">
              {pendingMemoryItems.length > 0 ? (
                <>
                  <span className="block text-sm font-extrabold" style={{ color: "#a9780f" }}>{pendingMemoryItems.length} to review</span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>facts waiting for your approval</span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}><AnimatedNumber value={approvedMemoryItems.length} /> things remembered</span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>only what you've approved</span>
                </>
              )}
            </span>
          </button>

          {/* Story / capture */}
          <button onClick={() => setActiveTab("timeline")} className="text-left p-5 flex items-center gap-4 transition hover:bg-[var(--arbor-paper-deep)]">
            <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#e5f0fb", color: "#2f7bbf" }}>
              <Waypoints className="w-6 h-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{recentCount} this week</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>moments in {firstName}'s story</span>
            </span>
          </button>
        </div>
      </section>

      {/* ── A few things to try ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>A few things to try this week</h2>
          <button onClick={() => setActiveTab("plans")} className="hidden sm:inline-flex items-center gap-1 text-sm font-bold" style={{ color: "#1f8a5a" }}>
            All plans <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommendations.map((r) => (
            <button key={r.title} onClick={() => setActiveTab(r.tab)} className="group text-left rounded-2xl p-4 transition hover:-translate-y-0.5" style={{ background: PASTEL[r.tone].soft }}>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white mb-3" style={{ color: PASTEL[r.tone].ink }}>{r.icon}</span>
              <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{r.title}</h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{r.desc}</p>
              <span className="inline-flex items-center gap-1 text-xs font-bold mt-2.5" style={{ color: PASTEL[r.tone].ink }}>
                Start <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Loop in your circle + check-in (trust + B2B2C entry) ────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => setActiveTab("sharing")} className={`${card} p-5 text-left flex items-center gap-4 transition hover:-translate-y-0.5`}>
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#e4f4ec", color: "#1f8a5a" }}><Share2 className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>Share with your circle</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>A co-parent, teacher or therapist. You choose what, and for how long.</span>
          </span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "#1f8a5a" }} />
        </button>
        <button onClick={() => setActiveTab("screening")} className={`${card} p-5 text-left flex items-center gap-4 transition hover:-translate-y-0.5`}>
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#e5f0fb", color: "#2f7bbf" }}><ClipboardCheck className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>Is {firstName} on track?</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>A short, non-diagnostic check across developmental areas.</span>
          </span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "#2f7bbf" }} />
        </button>
      </section>

      {/* ── Your daily tools (secondary, kept) ──────────────────────────── */}
      <section className="pt-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide mb-3" style={{ color: "var(--arbor-muted)" }}>Your daily tools</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyCheckinCard />
          <GoalsCard />
        </div>
        <div className="mt-4 space-y-4">
          <RemindersCard />
          <TrendsChart logs={behaviorLogs} milestonesPercent={milestonesPercent} />
        </div>
      </section>

      {/* ── Quiet safety footer ─────────────────────────────────────────── */}
      <section className="rounded-[22px] p-5 md:p-6 flex flex-col sm:flex-row items-center gap-5" style={{ background: "linear-gradient(120deg,#e4f4ec,#eef6f1)", border: "1px solid var(--arbor-rule)" }}>
        <ParentChildIllustration size={80} className="flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Not sure something's right? We're here.</h3>
          <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>Arbor is non-diagnostic. For anything urgent, or that needs an expert, we'll help you reach a professional.</p>
        </div>
        <button onClick={() => setActiveTab("safety")} className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition flex-shrink-0 bg-white" style={{ color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}>
          <Phone className="w-4 h-4" /> Reach a professional
        </button>
      </section>

      <QuickLogModal open={quickLog} onClose={() => setQuickLog(false)} />
    </motion.div>
  );
}
