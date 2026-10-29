/**
 * verdict-tokens.mjs — B-INF-08: the clinical firewall, counted on a rendered screen.
 *
 * Counts never verdicts (app/PRODUCT.md; PAI arbor reference/ui-enforcement-and-audit.md, the
 * 13 Oct ruling): a parent may read "31 seen" or "Reviewed 28 of 44 for this age" (a count, a
 * record's coverage), never a grade of the child. A verdict token is one of:
 *   - a percentage ("64%");
 *   - an achievement ratio ("seen 31 of 44", "3/12 reached", "נצפו 3 מתוך 12");
 *   - a graded word about the child (Low/Medium/High/Urgent, behind, delayed, at risk, on track);
 *   - a progress bar (role=progressbar or <progress>);
 *   - area rows painted in different backgrounds (a colour code), counted once.
 * The text half is pure (unit-tested here); the sweep passes the pattern sources into the page.
 */
export const VERDICT_TEXT_PATTERNS = Object.freeze([
  // a percentage
  String.raw`\d\s?%`,
  // an achievement ratio: an achievement verb within a few words of "n of m" (either order)
  String.raw`(?:seen|observed|done|met|reached|mastered|achieved|passed|נצפו|נצפה|ראינו|הושגו|הושג)[^.\n]{0,24}?\d+\s*(?:of|out of|/|מתוך)\s*\d+`,
  String.raw`\d+\s*(?:of|out of|/|מתוך)\s*\d+[^.\n]{0,24}?(?:seen|observed|done|met|reached|mastered|achieved|passed|נצפו|נצפה|הושגו|הושג)`,
  // a graded chip about the child: the whole label is the grade
  String.raw`^\s*(?:low|medium|high|urgent|moderate|severe)\s*$`,
  // a graded phrase about the child
  String.raw`(?<![A-Za-z])(?:falling behind|behind (?:schedule|peers|for (?:his|her|their) age)|delayed|at risk|on track|off track|ahead of (?:schedule|peers|age))(?![A-Za-z])`,
  // Hebrew: "מאחר" alone is also the everyday "since" (מאחר ש…), so only the lagging sense counts —
  // "מאחר/מאחרת/מאחרים ב…" (behind in …).
  String.raw`(?:בפיגור|בסיכון|רמה נמוכה|רמה גבוהה|מאחר(?:ת|ים|ות)?\s+ב)`,
]);

/** Verdict tokens in a list of visible own-text strings (one hit per string at most). */
export function verdictTextTokens(texts, sources = VERDICT_TEXT_PATTERNS) {
  const patterns = sources.map((source) => new RegExp(source, 'iu'));
  return texts.filter((text) => patterns.some((re) => re.test(text))).length;
}
