import React from "react";
import Icon from "../ui/Icon";

export type NowPlanKind = "practice" | "step" | "recommendation" | "program" | "record" | "visit" | "tonight" | "notice";

const PLAN_ICON: Record<NowPlanKind, string> = {
  practice: "lightbulb", step: "flag", recommendation: "auto_awesome", program: "menu_book",
  record: "edit_note", visit: "event", tonight: "bedtime", notice: "visibility",
};

/**
 * v3 Now "plan" card (11 Oct 2026): one object, two panels. The start panel is
 * the guide's face — art, the lead's kind, and the words to say when the lead
 * has real ones; the end panel holds the lead itself, unchanged. The art is
 * shape and colour only: never a picture of the child, never a verdict.
 */
export default function NowPlanFrame({ kind, tag, say, bare, children }: {
  kind: NowPlanKind;
  tag: string;
  /** Words the parent could say — only from the lead's own content. */
  say?: string | null;
  /** Render the lead alone: it brings its own frame. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  if (bare) return <>{children}</>;
  return <div className="now-plan arbor-depth-primary" data-plan={kind}>
    <div className="now-plan-art">
      <span className="now-plan-blob now-plan-blob-a" aria-hidden="true" />
      <span className="now-plan-blob now-plan-blob-b" aria-hidden="true" />
      <span className="now-plan-medallion" aria-hidden="true"><Icon name={PLAN_ICON[kind]} size={44} /></span>
      <div className="now-plan-art-text">
        <p className="now-plan-tag"><Icon name="lightbulb" size={16} />{tag}</p>
        {say && <blockquote className="now-plan-say" dir="auto">{say}</blockquote>}
      </div>
    </div>
    <div className="now-plan-body">{children}</div>
  </div>;
}
