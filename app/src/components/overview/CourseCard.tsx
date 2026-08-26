import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { ContentActionBar, ContentWhyLine } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";
import { useLanguage } from "../../context/LanguageContext";
import { localizeActivity, type PlayActivity } from "../../playbank/content";
import { localizeCourse, courseActivities, courseProgress, type PlayCourse } from "../../playbank/courses";

/* Daily Play Course — a short, challenge-targeted track. Shows progress and the
   sequence of activities; the next one is expanded with its steps so the parent
   always knows the single next thing to do. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";
const CLAY = "var(--arbor-clay)";

export default function CourseCard({
  course,
  childName,
  completedIds,
  onToggle,
  onCoach,
  why,
}: {
  course: PlayCourse;
  childName: string;
  completedIds: string[];
  onToggle: (activityId: string) => void;
  onCoach: (activity: PlayActivity) => void;
  /** Masterplan 3.1 why-line (honesty gate): the caller passes `why` ONLY when
   *  an honest per-child rationale exists — i.e. the course's domain is among
   *  the child's logged concern domains. Parent-chosen readiness tracks and the
   *  no-signal fallback omit it, and the card then mounts the bare TrustLink so
   *  the why → Trust Center chain is still present without a fabricated
   *  rationale. */
  why?: string;
}) {
  const { t, uiLang } = useLanguage();
  const loc = localizeCourse(course, uiLang);
  const activities = courseActivities(course).map((a) => localizeActivity(a, uiLang));
  const progress = courseProgress(course, completedIds);
  const [openId, setOpenId] = useState<string | null>(progress.nextActivityId);

  return (
    <section className="rounded-[22px] overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
      <div className="p-6">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Icon name="route" size={14} /> {t("course.eyebrow")}
        </span>
        <h2 className="text-[1.35rem] font-extrabold leading-tight mt-1" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          {loc.title}
        </h2>
        <p className="text-[14px] leading-relaxed mt-2" style={{ color: INK, textWrap: "pretty" } as React.CSSProperties}>
          {loc.whatItBuilds}
        </p>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-sunk)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress.percent}%`, background: CLAY, transition: "width .4s cubic-bezier(.22,1,.36,1)" }} />
          </div>
          <span className="text-[12px] font-bold flex-shrink-0" style={{ color: MUTED }}>
            {t("course.progress", { done: progress.done, total: progress.total })}
          </span>
        </div>

        {/* Masterplan 3.1: the why-line's Trust-Center chain, below the bar on
            its own quiet row (never competing with the per-activity actions).
            With an honest per-child `why` it renders through the shared slot
            (trustLink ON); without one, the bare TrustLink keeps the chain. */}
        <div className="mt-3">
          {why
            ? <ContentWhyLine why={why} trustLink surface="course-card" />
            : <TrustLink surface="course-card" />}
        </div>

        {progress.complete && (
          <p className="mt-3 text-[13px] font-bold inline-flex items-center gap-1.5" style={{ color: GREEN }}>
            <Icon name="auto_awesome" size={14} /> {t("course.complete")}
          </p>
        )}

        {/* Days */}
        <ol className="mt-4 space-y-2">
          {activities.map((a, i) => {
            const done = completedIds.includes(a.id);
            const isNext = !progress.complete && a.id === progress.nextActivityId;
            const open = openId === a.id;
            return (
              <li key={a.id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isNext ? "rgba(88,166,255,0.4)" : RULE}`, background: isNext ? GREEN_SOFT : "var(--arbor-paper-deep)" }}>
                <div className="w-full flex items-center gap-3 p-3">
                  <button
                    onClick={() => onToggle(a.id)}
                    aria-pressed={done}
                    aria-label={done ? "Mark not done" : "Mark done"}
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition"
                    style={done ? { background: CLAY, color: "#fff" } : { background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}
                  >
                    {done ? <Icon name="check" size={14} /> : <span className="text-[11px] font-extrabold" style={{ color: MUTED }}>{i + 1}</span>}
                  </button>
                  <button
                    onClick={() => setOpenId(open ? null : a.id)}
                    aria-expanded={open}
                    className="flex-1 min-w-0 flex items-center gap-3 text-start"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-bold" style={{ color: INK, textDecoration: done ? "line-through" : "none" }}>{a.title}</span>
                      {isNext && <span className="text-[11px] font-bold" style={{ color: GREEN }}>{t("course.next")}</span>}
                    </span>
                    <Icon name="expand_more" size={16} style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>
                </div>
                {open && (
                  <div className="px-4 pb-4">
                    <p className="text-[13px] mb-2" style={{ color: MUTED }}>
                      <span style={{ color: GREEN, fontWeight: 700 }}>{t("play.builds")} </span>{a.whatItBuilds}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {a.householdItems.map((it) => (
                        <span key={it} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: GREEN_SOFT, color: GREEN }}>{it}</span>
                      ))}
                    </div>
                    <ol className="space-y-2">
                      {a.steps.map((s, si) => (
                        <li key={si} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: INK }}>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold" style={{ background: GREEN_SOFT, color: GREEN }}>{si + 1}</span>
                          <span style={{ textWrap: "pretty" } as React.CSSProperties}>{s}</span>
                        </li>
                      ))}
                    </ol>
                    {/* Shared ContentActionBar (masterplan 4.2) replaces the old
                        paired lozenges. Judgment call, documented: "I did it" IS
                        the canonical done verb (toggle, active when done), so the
                        primary CTA moves INTO the bar rather than staying outside
                        it; "Coach me on this" is a surface-specific extra (ask),
                        rendered after the canonical verbs. Same handlers as
                        before — onToggle(a.id) / onCoach(a). */}
                    <ContentActionBar
                      variant="bar"
                      surface="course-activity"
                      className="mt-4"
                      actions={[
                        {
                          verb: "done",
                          onClick: () => onToggle(a.id),
                          active: done,
                          label: done ? t("play.added", { name: childName }) : t("play.did"),
                          icon: done ? "check_circle" : "check",
                          fill: done ? 1 : 0,
                        },
                      ]}
                      extras={[
                        { id: "ask", label: t("play.coach"), icon: "chat_bubble", onClick: () => onCoach(a) },
                      ]}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
