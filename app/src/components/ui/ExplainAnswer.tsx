import React from "react";
import Icon from "./Icon";
import { AiBlock, Checklist } from "./AiBlock";
import { MarkdownBlock } from "./MarkdownBlock";
import type { ExplainAnswer } from "../../lib/explainAnswer";

/**
 * AI-17 — the structured render for a POST /api/explain answer.
 *
 * The explanation stays prose, because it IS prose; the step becomes the same
 * framed, tickable block the coach answer uses. Nothing is inferred from the
 * prose — only the two fields the route already returns are rendered, so this
 * adds no new model call and no new safety surface.
 *
 * The explanation still routes through MarkdownBlock, which is load-bearing:
 * the failure path writes its notice through this same slot, and MarkdownBlock
 * is what turns a helpline number into a tap target.
 *
 * CLINICAL FIREWALL: both fields are rendered verbatim. Nothing here derives a
 * score, a percentage, a ring, a delta or a graded verdict about a child.
 */
export function ExplainAnswerBlock({
  answer,
  tryTodayLabel,
  className = "space-y-1",
}: {
  answer: ExplainAnswer;
  /** Localized heading for the step block; the caller owns every string. */
  tryTodayLabel: string;
  /** Spacing for the prose half, preserved per surface. */
  className?: string;
}) {
  return (
    <div className="space-y-2.5">
      {answer.explanation && <MarkdownBlock text={answer.explanation} className={className} />}
      {answer.tryToday && (
        <AiBlock icon={<Icon name="checklist" size={12} />} title={tryTodayLabel} tint="var(--arbor-green-ink)">
          <Checklist items={[answer.tryToday]} />
        </AiBlock>
      )}
    </div>
  );
}

export default ExplainAnswerBlock;
