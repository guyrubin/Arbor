import React from "react";
import { Icon } from "../../ui/Icon";
import { Fig, LivingForm, MoreLink, Tile } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { UiLang } from "../../../lib/i18n";
import { TOGETHER_ART } from "../../../lib/parentArt";
import { plansCopy } from "./plansCopy";

/**
 * Stop 4, "Start another plan" (V77: two ways; Challenge Plans are one tab
 * under "Your plans", their own home).
 *  1. Start from a routine — the ready-made routines (one tap makes a plan,
 *     B-GROWTH-25), one link to Together › Routines, and the family's own
 *     routines with "Add a routine" (RoutinesCard, unchanged).
 *  2. Create a plan for a specific challenge — production's composer input
 *     (the host passes it in, with its suggestions and the crisis card).
 */

export interface StartAnotherProps {
  lang: UiLang;
  composition: Composition;
  childName: string;
  readyMadeCount: number;
  /** The ready-made routine chips (RoutineTemplates). */
  readyMade: React.ReactNode;
  onTogether: () => void;
  /** The family's own routines and "Add a routine" (RoutinesCard). */
  routines: React.ReactNode;
  writeOwn: React.ReactNode;
}

export function StartAnother(p: StartAnotherProps) {
  const l = p.lang === "he" ? "he" : "en";
  const c = plansCopy(l);
  const desk = p.composition === "desk";

  const readyMadeList = p.readyMadeCount > 0 && (
    <details className="group" data-testid="plans-ready-made">
      <summary className="ds-link" style={{ paddingInline: 0, listStyle: "none", cursor: "pointer" }}>
        {c.showReadyMade}
        <Icon name="expand_more" size={15} className="transition group-open:rotate-180" />
      </summary>
      <div style={{ paddingTop: 8 }}>{p.readyMade}</div>
    </details>
  );

  /* V77 phone: the routine way in is one row to Together › Routines, then the
     ready-made list and the family's own routines (Add a routine). */
  const routineTile = !desk ? (
    <section className="vt" style={{ padding: 16, borderRadius: 18, gap: 4 }} aria-labelledby="plans-start-routine">
      <button type="button" className="ds-plans-linkrow" onClick={p.onTogether}>
        <span className="gi kid" aria-hidden="true"><Icon name="interests" size={18} /></span>
        <span>
          <b id="plans-start-routine">{c.fromRoutine}</b>
          <small>{p.readyMadeCount > 0 ? c.readyMadeInTogether(p.readyMadeCount) : c.togetherRoutines}</small>
        </span>
        <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
      </button>
      {readyMadeList}
      <div className="stack ds-col" style={{ gap: 6, paddingTop: 10, borderTop: "1px solid var(--rule)" }}>{p.routines}</div>
    </section>
  ) : (
    <Tile className="x6" icon="interests" kind="kid" title={c.fromRoutine} titleId="plans-start-routine" link={<MoreLink onClick={p.onTogether}>{c.togetherRoutines}</MoreLink>}>
      {p.readyMadeCount > 0 && (
        <>
          <div className="line" style={{ gap: 12 }}>
            <LivingForm src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={72} height={46} />
            <Fig n={p.readyMadeCount} unit={c.readyMade} sub={c.readyMadeSub} size="sm" />
          </div>
          {readyMadeList}
        </>
      )}
      <div className="stack ds-col" style={{ gap: 6, paddingTop: 8, borderTop: "1px solid var(--rule)", marginTop: "auto" }}>{p.routines}</div>
    </Tile>
  );

  const draft = (
    <span className="ds-plans-draft">
      <Icon name="edit" size={15} />
      {c.draftLabel}
    </span>
  );
  /* N-Plans-D: glyph, name, the lede and the draft label. N-Plans-M: the name with the draft label
     beside it, then the field (no glyph, no lede). */
  const writeTile = desk ? (
    <Tile className="x6" icon="flag" kind="plan" title={c.writeOwn} titleId="plans-start-write">
      <p style={{ fontSize: 13, lineHeight: 1.4, color: "var(--ink-soft)" }}>{c.writeOwnLede}</p>
      {draft}
      <div className="stack ds-col" style={{ gap: 8, marginTop: 4 }}>{p.writeOwn}</div>
    </Tile>
  ) : (
    <Tile title={c.writeOwn} titleId="plans-start-write" link={draft}>
      <div className="stack ds-col" style={{ gap: 8 }}>{p.writeOwn}</div>
    </Tile>
  );

  return desk ? (
    <div className="g12">
      {routineTile}
      {writeTile}
    </div>
  ) : (
    <div className="stack ds-col" style={{ gap: 12 }}>
      {routineTile}
      {writeTile}
    </div>
  );
}

