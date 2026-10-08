/** Shared, pure intake contract. Files remain transient; only the parent's
 * confirmed text/provenance enters the existing exportable programs record. */
export const PROGRAM_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const PROGRAM_SOURCE_MAX = 12000;
export const PROGRAM_IMPORT_VERSION = "home-recommendations-v1";
export interface RecommendationDraft { sourceText: string; recommendations: string[]; unreadable: boolean; offTopic: boolean }
export interface ProgramImportSource { kind: "photo" | "pdf" | "text"; name: string; sourceText: string; confirmedAt: string; extractionVersion: string; quotations: string[] }

export function parseRecommendationDraft(value: unknown): RecommendationDraft {
  if (!value || typeof value !== "object") throw new Error("Invalid extraction");
  const v = value as Record<string, unknown>;
  if (typeof v.sourceText !== "string" || v.sourceText.length > PROGRAM_SOURCE_MAX || typeof v.unreadable !== "boolean" || typeof v.offTopic !== "boolean" || !Array.isArray(v.recommendations)) throw new Error("Invalid extraction");
  const sourceText = v.sourceText.trim();
  // Whole lines preserve negation/conditions. A substring could reverse advice:
  // 'Do not ask...' must never become 'ask...'. Ambiguous fragments are omitted.
  const sourceLines = new Set(sourceText.split(/\r?\n/).map(line => line.trim()));
  const recommendations = [...new Set(v.recommendations.filter((s): s is string => typeof s === "string").map(s => s.trim()).filter(s => s.length > 0 && s.length <= 200 && sourceLines.has(s)))].slice(0, 8);
  return { sourceText, recommendations: v.unreadable || v.offTopic ? [] : recommendations, unreadable: v.unreadable, offTopic: v.offTopic };
}
export function pastedRecommendations(text: string): RecommendationDraft {
  if (!text.trim() || text.length > PROGRAM_SOURCE_MAX) throw new Error("Paste up to 12000 characters");
  return parseRecommendationDraft({ sourceText: text, recommendations: text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length <= 200), unreadable: false, offTopic: false });
}
export function parseProgramDocument(dataUrl: unknown): { data: string; mimeType: string } {
  if (typeof dataUrl !== "string") throw new Error("A document is required");
  const match = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0 || match[2].length > Math.ceil(PROGRAM_DOCUMENT_MAX_BYTES / 3) * 4) throw new Error("Unsupported document or too large");
  // Check signatures without node imports so the contract can be used by the UI.
  const prefix = match[2];
  const valid = match[1] === "application/pdf" ? prefix.startsWith("JVBERi0") : match[1] === "image/png" ? prefix.startsWith("iVBORw0KGgo") : match[1] === "image/jpeg" ? prefix.startsWith("/9j/") : prefix.startsWith("UklGR");
  if (!valid) throw new Error("File contents do not match the file type");
  return { data: match[2], mimeType: match[1] };
}
