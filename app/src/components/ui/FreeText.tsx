import React from "react";
import { leadingForeignRun } from "../../lib/bidi";

/**
 * B-SHELL-28 — a parent's free text (a remembered fact, a quote) rendered so
 * the child's name never flips the sentence: `<bdi dir="auto">` isolates the
 * whole text from the page, and an opening run in the other script (a Hebrew
 * name opening an English sentence, or the reverse) sits in its own <bdi>,
 * which dir="auto" skips — so the paragraph follows the words after it.
 */
export function FreeText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const { lead, rest } = leadingForeignRun(text);
  return (
    <bdi dir="auto" data-free-text="" className={className} style={style}>
      {lead ? <bdi>{lead}</bdi> : null}
      {rest}
    </bdi>
  );
}

export default FreeText;
