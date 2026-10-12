import React from "react";
import Icon from "../ui/Icon";
import { guideFaceFor } from "./nowGuideFace";

export type NowPlanKind = "practice" | "step" | "recommendation" | "program" | "record" | "visit" | "tonight" | "notice";

const PLAN_ICON: Record<NowPlanKind, string> = {
  practice: "lightbulb", step: "flag", recommendation: "auto_awesome", program: "menu_book",
  record: "edit_note", visit: "event", tonight: "bedtime", notice: "visibility",
};

/**
 * v3 Now "plan" card (11 Oct 2026; F-NOW-1 12 Oct): one object, two panels.
 * The start panel is the guide's face and the wider one — the active
 * question's guide picture once it has shipped (lib/guideArt), otherwise
 * shapes and a medallion carrying the question's glyph — with the lead's tag,
 * its say line and a line of plan meta in words. The end panel holds the lead
 * itself. Never a picture of the child, never a verdict, never a count of
 * the child's progress.
 */
export default function NowPlanFrame({ kind, lang, tag, say, meta, question, bare, children }: {
  kind: NowPlanKind;
  lang: "en" | "he";
  tag: string;
  /** The say line: the lead's own words when it has them, else its one-liner. */
  say?: string | null;
  /** Plan meta in words about the parent's own step (never a ratio or a bar). */
  meta?: string | null;
  /** The active question, for the guide's glyph and picture only; never quoted here. */
  question?: string | null;
  /** Render the lead alone: it brings its own frame. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  if (bare) return <>{children}</>;
  const face = guideFaceFor(question, lang);
  const art = face.art;
  return <div className="now-plan arbor-depth-primary" data-plan={kind} data-guide={face.topic}>
    <div className={art ? "now-plan-art now-plan-art-picture" : "now-plan-art"}>
      {art ? <>
        <img className="now-plan-img" src={art.src} srcSet={art.srcSet} sizes="(min-width: 900px) 40vw, 100vw" width={art.width} height={art.height} alt={art.alt} loading="lazy" decoding="async" />
        <span className="now-plan-scrim" aria-hidden="true" />
      </> : <>
        <span className="now-plan-blob now-plan-blob-a" aria-hidden="true" />
        <span className="now-plan-blob now-plan-blob-b" aria-hidden="true" />
        <span className="now-plan-medallion" aria-hidden="true"><Icon name={face.glyph ?? PLAN_ICON[kind]} size={46} /></span>
      </>}
      <div className="now-plan-art-text">
        <p className="now-plan-tag"><Icon name="lightbulb" size={16} />{tag}</p>
        {(say || meta) && <div className="now-plan-face">
          {say && <blockquote className="now-plan-say" dir="auto">{say}</blockquote>}
          {meta && <p className="now-plan-meta">{meta}</p>}
        </div>}
      </div>
    </div>
    <div className="now-plan-body">{children}</div>
  </div>;
}
