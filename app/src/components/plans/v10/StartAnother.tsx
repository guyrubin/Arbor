import React from "react";
import { Icon } from "../../ui/Icon";
import { Fig, LivingForm, MoreLink, Tile } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { UiLang } from "../../../lib/i18n";
import { planString } from "../../../lib/plans/planStrings";
import type { PatternDef } from "../../../lib/library/plans/patterns";
import { TOGETHER_ART } from "../../../lib/parentArt";
import { ChallengeBook } from "./ChallengeBook";
import { plansCopy } from "./plansCopy";

/**
 * Stop 4, "Start another plan": three ways in.
 *  1. Challenge Plans — the patterns this family may start (the server's
 *     table decides; a running or dark pattern is not offered), as covers,
 *     and one link to all of them.
 *  2. Start from a routine — the ready-made routines (one tap makes a plan,
 *     B-GROWTH-25), one link to Together › Routines, and the family's own
 *     routines with "Add a routine" (RoutinesCard, unchanged).
 *  3. Create a plan for a specific challenge — production's composer input
 *     (the host passes it in, with its suggestions and the crisis card).
 */

export interface StartAnotherProps {
  lang: UiLang;
  composition: Composition;
  childName: string;
  /** Patterns this family may start now (not running, not dark). */
  choosable: PatternDef[];
  /** How many Challenge Plans exist for this family in all (running + choosable). */
  challengeCount: number;
  onAllChallenges: () => void;
  onOpenPattern: (def: PatternDef) => void;
  readyMadeCount: number;
  /** The ready-made routine chips (RoutineTemplates). */
  readyMade: React.ReactNode;
  onTogether: () => void;
  /** The family's own routines and "Add a routine" (RoutinesCard). */
  routines: React.ReactNode;
  /** "Create a plan for a specific challenge": production's title. */
  writeOwnTitle: string;
  writeOwn: React.ReactNode;
}

export function StartAnother(p: StartAnotherProps) {
  const l = p.lang === "he" ? "he" : "en";
  const c = plansCopy(l);
  const desk = p.composition === "desk";
  const covers = p.choosable.slice(0, 4);
  const more = p.choosable.length - covers.length;

  const challengeTile = p.challengeCount > 0 && (
    <Tile
      className={desk ? "x4" : undefined}
      icon="auto_stories"
      title={planString("section.title", l)}
      titleId="plans-start-challenge"
      link={<MoreLink onClick={p.onAllChallenges}>{c.seeAll(p.challengeCount)}</MoreLink>}
    >
      {covers.length > 0 && (
        <div className="line" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          {covers.map((d) => (
            <button key={d.id} type="button" className="ds-plans-cover" onClick={() => p.onOpenPattern(d)} aria-label={c.openPlan(d.title[l])} data-plan-door={d.id}>
              <ChallengeBook title={d.title[l]} size="sm" width={38} label={c.book(d.title[l])} />
            </button>
          ))}
          {more > 0 && <span className="small" style={{ paddingBottom: 6 }}>{c.andMore(more)}</span>}
        </div>
      )}
      <b className="ds-plans-hard">{planString("section.hard", l)}</b>
      <p style={{ fontSize: 13.5, lineHeight: 1.38, color: "var(--ink-soft)" }}>{c.challengeLede(p.challengeCount, p.childName)}</p>
    </Tile>
  );

  const routineTile = (
    <Tile className={desk ? "x4" : undefined} icon="checklist" kind="kid" title={c.fromRoutine} titleId="plans-start-routine" link={<MoreLink onClick={p.onTogether}>{c.togetherRoutines}</MoreLink>}>
      {p.readyMadeCount > 0 && (
        <>
          <div className="line" style={{ gap: 12 }}>
            <LivingForm src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={72} height={46} />
            <Fig n={p.readyMadeCount} unit={c.readyMade} sub={c.readyMadeSub} size="sm" />
          </div>
          <details className="group" data-testid="plans-ready-made">
            <summary className="ds-link" style={{ paddingInline: 0, listStyle: "none", cursor: "pointer" }}>
              {c.showReadyMade}
              <Icon name="expand_more" size={16} className="transition group-open:rotate-180" />
            </summary>
            <div style={{ paddingTop: 8 }}>{p.readyMade}</div>
          </details>
        </>
      )}
      <div className="stack ds-col" style={{ gap: 6, paddingTop: 8, borderTop: "1px solid var(--rule)", marginTop: "auto" }}>{p.routines}</div>
    </Tile>
  );

  const writeTile = (
    <Tile className={desk ? "x4" : undefined} icon="edit_note" kind="plan" title={p.writeOwnTitle} titleId="plans-start-write">
      <p style={{ fontSize: 13.5, lineHeight: 1.4, color: "var(--ink-soft)" }}>{c.writeOwnLede}</p>
      <span className="ds-plans-draft">
        <Icon name="edit" size={14} />
        {c.draftLabel}
      </span>
      <div className="stack ds-col" style={{ gap: 8, marginTop: "auto" }}>{p.writeOwn}</div>
    </Tile>
  );

  return desk ? (
    <div className="g12">
      {challengeTile}
      {routineTile}
      {writeTile}
    </div>
  ) : (
    <div className="stack ds-col" style={{ gap: 12 }}>
      {challengeTile}
      {routineTile}
      {writeTile}
    </div>
  );
}

