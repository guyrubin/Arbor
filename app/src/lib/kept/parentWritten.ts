/** Existing parent-write schemas have no source field. Fail closed if a row
 * does carry different provenance, including future AI/practice imports. */
export function parentWritten(row: object): boolean {
  if (!row || typeof row !== "object") return false;
  const value = row as Record<string, unknown>;
  return value.contentSource === undefined
    && !value.conversationProposalId
    && value.captureSource !== "co_parent"
    && (value.source === undefined || value.source === "parent_typed" || value.source === "parent_voice")
    && (value.observationSource === undefined || value.observationSource === "parent_typed" || value.observationSource === "parent_voice");
}
