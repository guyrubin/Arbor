import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized } from "../../lib/routines";
import { routineTemplatesForAge, routineToPlan } from "../../lib/routineTemplates";
import { track } from "../../lib/analytics";

/* B-GROWTH-25 — the ready-made routines as Plans templates.

   #/routines retired to Plans: each board is one chip here, offered only in
   its age window (no nap board past 4, potty only 18–48 m). One tap writes
   ONE actionPlans row through ArborContext.startPlanFromTemplate — no goal,
   no AI call — and the plan runs on the plan track (PlanTrackCard /
   PlanSteps) like any other. Lives inside the create card (no new module).
   Parent register: tokens only, 44 px targets, logical properties. */

export default function RoutineTemplates() {
  const { childProfile, startPlanFromTemplate } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const first = (childProfile.name || "").split(" ")[0];
  const months = ageMonthsFromProfile(childProfile);
  const templates = useMemo(() => routineTemplatesForAge(months), [months]);
  const [starting, setStarting] = useState<string | null>(null);

  const start = async (routineId: string) => {
    const routine = templates.find((r) => r.id === routineId);
    if (!routine || starting) return;
    setStarting(routineId);
    try {
      await startPlanFromTemplate(routineToPlan(routine, lang, first, Date.now()));
      // Counts and an id only — never the plan text.
      try { track("plan_template_start", { surface: "plans", template: routine.id }); } catch { /* noop */ }
    } finally {
      setStarting(null);
    }
  };

  if (templates.length === 0) return null;
  return (
    <div data-testid="plans-routine-templates" className="flex flex-col gap-2">
      <span className="t-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("elev.plans.routineTemplates.title")}</span>
      <span className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.routineTemplates.sub")}</span>
      <div className="flex flex-wrap gap-1.5">
        {templates.map((r) => {
          const title = localized(r.title, lang);
          const time = localized(r.time, lang);
          return (
            <button
              key={r.id}
              type="button"
              data-routine-template={r.id}
              disabled={starting !== null}
              onClick={() => void start(r.id)}
              aria-label={t("elev.plans.routineTemplates.start", { title, time })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-60"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
            >
              <Icon name={r.ms} size={16} />
              <span>{title}</span>
              <span className="font-semibold" style={{ color: "var(--arbor-muted)" }}>· {time}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
