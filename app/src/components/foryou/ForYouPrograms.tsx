import React, { useMemo, useState } from "react";
import { Fig, GlyphChip, Tile } from "../../design/primitives";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { SHELF_ART } from "../../lib/parentArt";
import { programPageModel, programPilotCount, startablePrograms, weekTitle, type ProgramPageModel, type StartableProgram } from "../../lib/programPage";
import type { ProgramEnrolment } from "../../lib/programs/enrolment";
import { programPilotText } from "../../content/hardMomentPilotText";
import type { Composition } from "../../design/useComposition";
import { AreaForm } from "./AreaForm";
import { ProgramStones } from "./ProgramStones";
import type { ForYouCopy } from "./forYouCopy";

/** The program page lives at #/development?view=program (B-PROG-05). */
export function openProgramPage(setActiveTab: (tab: never) => void) {
  setActiveTab("development" as never);
  window.location.hash = "#/development?view=program";
}

export interface ForYouProgramState {
  model: ProgramPageModel | null;
  startable: StartableProgram[];
  /** "Pilot program" while the program's content is still a draft (B-PROG-15), else null. */
  pilotLabel: string | null;
}

/**
 * The family's program for For you: the enrolment the program page shows (the
 * active one, else the newest paused one) through the program page's own view
 * model, or the two programs a family can start. Read-only here; enrolling,
 * pausing and finishing stay on the program page.
 */
export function useForYouProgram(lang: "en" | "he"): ForYouProgramState {
  const { childProfile } = useArbor();
  const programs = useChildCollection<ProgramEnrolment>(childProfile.id, "programs");
  const [now] = useState(() => new Date());
  const model = useMemo(
    () => programPageModel(programs.items, { childId: childProfile.id }, now, lang, childProfile.gender ?? null),
    [programs.items, childProfile.id, now, lang, childProfile.gender],
  );
  const months = ageMonthsFromProfile(childProfile);
  const startable = useMemo(() => startablePrograms(Number.isFinite(months) ? months : null, lang), [months, lang]);
  const pilot = programPilotCount(model ? [model.programId] : startable.map((p) => p.id));
  return { model, startable, pilotLabel: pilot ? programPilotText(lang, "one").status : null };
}

/** This week's short title of the running program (for the pick's thread). */
export function programWeekLine(model: ProgramPageModel | null): string | null {
  if (!model || model.status !== "active") return null;
  return weekTitle(model.skill);
}

export function ForYouPrograms({ state, copy, composition, onOpen }: { state: ForYouProgramState; copy: ForYouCopy; composition: Composition; onOpen: () => void }) {
  const { model, startable, pilotLabel } = state;
  const artW = composition === "desk" ? 112 : 84;
  if (model) {
    const title = weekTitle(model.skill);
    return (
      <Tile
        className="fy-prog"
        icon={model.programId === "steady-nights" ? "bedtime" : "chat_bubble"}
        kind="step"
        title={model.name}
        titleId="fy-program-title"
        link={pilotLabel ? <span className="pilot">{pilotLabel}</span> : undefined}
      >
        <div className="line" style={{ gap: 14 }}>
          <AreaForm art={SHELF_ART[model.shelf]} width={artW} ratio={0.7} zoom={1.27} />
          <Fig n={model.week} unit={copy.programWeeks(model.weeks)} sub={model.status === "paused" ? copy.programPaused : copy.programThisWeek(title)} />
        </div>
        <ProgramStones rows={model.weekRows} copy={copy} />
        <p className="skill" dir="auto">{model.skill}</p>
        <div className="fy-prog-foot">
          <button type="button" className="ghostb" data-testid="foryou-program-open" onClick={onOpen}>
            {copy.openThisWeek}
          </button>
        </div>
      </Tile>
    );
  }
  return (
    <div className={composition === "desk" ? "g12" : "stack fy-col"} style={composition === "desk" ? undefined : { gap: 12 }}>
      {startable.map((p) => (
        <section key={p.id} className={`vt fy-choice${composition === "desk" ? " x6" : ""}`} data-testid="foryou-program-choice" aria-labelledby={`fy-choice-${p.id}`}>
          <div className="vh">
            <GlyphChip icon={p.id === "steady-nights" ? "bedtime" : "chat_bubble"} kind="step" />
            <h3 className="h3" id={`fy-choice-${p.id}`}>{p.name}</h3>
            {pilotLabel && <span className="pilot">{pilotLabel}</span>}
          </div>
          <span className="small">{copy.programWeeksTotal(p.weeks)}</span>
          <p dir="auto">{p.describedAs}</p>
          <div className="fy-prog-foot">
            <button type="button" className="ghostb" onClick={onOpen} aria-label={copy.openProgram(p.name)}>
              {copy.seeProgram}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
