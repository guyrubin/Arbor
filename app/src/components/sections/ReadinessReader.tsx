import { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";
import { courseActivities, localizeCourse, type PlayCourse } from "../../playbank/courses";
import { localizeActivity } from "../../playbank/content";
import { courseArea } from "../../learn/courseAreas";
import { domainName } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { DOMAIN_VARS } from "../../lib/tokens";
import { TryTodayButton } from "./useTryToday";

/**
 * v3 F-FORYOU-1 (critic [29]) — a readiness course (starting school, a new
 * sibling, calmer bedtimes), read on For you, the parent. These were Daily
 * Play's readiness tracks; here they are the parent's reading: what the course
 * builds, then each activity as plain text (its time, what it builds, its
 * steps) with one "Try it today".
 *
 * FIREWALL: no progress of any shape. No bar, no "day n of m", no done count
 * and no per-activity state — the activities are a list to choose from, in
 * the course's own order, and nothing here is about the child.
 */
export default function ReadinessReader({ course, onBack }: { course: PlayCourse; onBack: () => void }) {
  const { t, aiLang } = useLanguage();
  const lang = aiLang === "he" ? "he" : "en";
  const shown = localizeCourse(course, lang);
  const activities = courseActivities(course).map((a) => localizeActivity(a, lang));
  const area = courseArea(course.id);
  const tone = area ? DOMAIN_VARS[area] : null;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { headingRef.current?.focus(); }, [course.id]);

  return (
    <article data-testid="readiness-reader" className="mx-auto w-full min-w-0 max-w-[760px] space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" /> {t("companion.door.learn")}
      </button>

      <header className="space-y-2">
        {area && tone && (
          <span data-testid="readiness-area" data-area={area} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: tone.soft, color: tone.ink }}>
            <Icon name={DOMAIN_ICONS[area]} size={14} /><span>{domainName(area, t)}</span>
          </span>
        )}
        <h1
          ref={headingRef}
          tabIndex={-1}
          data-testid="readiness-heading"
          className="text-2xl md:text-[1.9rem] leading-tight tracking-tight focus:outline-none"
          dir="auto"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {shown.title}
        </h1>
        <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{shown.whatItBuilds}</p>
        <p className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="toys" size={14} />{t("elev.learnCare.readiness.activities", { n: activities.length })}
        </p>
      </header>

      <section aria-labelledby="readiness-activities-title" className="space-y-3">
        <h2 id="readiness-activities-title" className="text-lg font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.readiness.inThis")}</h2>
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} data-testid="readiness-activity" className={`${cardCls} space-y-2 p-4 sm:p-5`}>
              <h3 className="text-[17px] font-bold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>{a.title}</h3>
              <p className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
                <Icon name="schedule" size={13} />{t("learn.minutes", { n: a.durationMin })}
              </p>
              <p className="t-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>{a.whatItBuilds}</p>
              {a.steps.length > 0 && (
                <ol className="list-decimal space-y-1 ps-5 t-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                  {a.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              )}
              <TryTodayButton recommendation={a.title} testId="readiness-try-today" />
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
