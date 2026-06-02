import type { SchoolBrief } from "../types";

/**
 * H-08 — Turn a generated handoff brief into a clean, professional Markdown
 * document the parent can download and hand to a teacher or clinician. Pure
 * and deterministic so it is unit testable and works offline (no cloud bucket
 * required).
 */
export const briefToMarkdown = (
  brief: SchoolBrief,
  childName: string,
  audience: string
): string => {
  const bullets = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- —");
  const audienceLabel = audience.charAt(0).toUpperCase() + audience.slice(1);

  return `# Arbor Development Handoff — ${childName}

**Prepared for:** ${audienceLabel}
**Date:** ${brief.date || new Date().toISOString().slice(0, 10)}
**Document:** ${brief.title}

> Arbor is parent-support software, not a diagnosis. This summary reflects a parent's observations, not a clinical assessment.

## Overview
${brief.overview}

## Key strengths
${bullets(brief.keyStrengths)}

## Classroom / setting challenges
${bullets(brief.classroomChallenges)}

## Language support plan
${bullets(brief.languageSupportPlan)}

## Suggested strategies
${bullets(brief.suggestedTeacherStrategies)}

## When to escalate
${brief.crisisEscalationTrigger}
`;
};

/** Trigger a client-side file download (browser only; no-op without a DOM). */
export const downloadTextFile = (filename: string, contents: string, mime = "text/markdown"): void => {
  if (typeof document === "undefined") return;
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

/** Filesystem-safe slug for download filenames. */
export const safeFileName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "child";
