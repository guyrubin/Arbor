/** Transient, explicitly supplied files. Only metadata may enter a saved conversation. */
export type ComposerAttachment = { id: string; childId: string; kind: "photo" | "document"; name: string; mimeType: string; dataUrl: string };
export type AttachmentReceipt = { id: string; kind: "photo" | "document"; name: string; mimeType: string; originalAvailable: false };
export type AttachmentContext = { kind: "model-interpretation"; attachmentIds: string[]; originalsAvailable: false };
export const MAX_COMPANION_ATTACHMENTS = 3;
const MAX_FILE = 4 * 1024 * 1024;
const MAX_TOTAL = 6 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function parseCompanionAttachments(raw: unknown, childId: string): ComposerAttachment[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_COMPANION_ATTACHMENTS) throw new Error("Choose up to three files.");
  const ids = new Set<string>();
  let total = 0;
  return raw.map(value => {
    if (!value || typeof value !== "object") throw new Error("Invalid file.");
    const a = value as ComposerAttachment;
    if (!childId || a.childId !== childId || typeof a.id !== "string" || !a.id || a.id.length > 100 || ids.has(a.id)) throw new Error("This file belongs to another draft. Please attach it again.");
    ids.add(a.id);
    if ((a.kind !== "photo" && a.kind !== "document") || !TYPES.has(a.mimeType) || (a.kind === "photo" && !a.mimeType.startsWith("image/"))) throw new Error("Choose a JPG, PNG, WebP or PDF file.");
    if (typeof a.dataUrl !== "string" || a.dataUrl.length > Math.ceil(MAX_FILE * 4 / 3) + 100) throw new Error("Each file must be under 4 MB.");
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(a.dataUrl);
    if (!match || match[1] !== a.mimeType || match[2].length % 4 !== 0) throw new Error("Invalid file encoding.");
    const bytes = atob(match[2]);
    const signature = a.mimeType === "image/png" ? bytes.startsWith("\x89PNG\r\n\x1a\n") : a.mimeType === "image/jpeg" ? bytes.startsWith("\xff\xd8\xff") : a.mimeType === "image/webp" ? bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP" : bytes.startsWith("%PDF-");
    if (!signature || bytes.length > MAX_FILE) throw new Error("This file could not be read. Choose another file.");
    total += bytes.length;
    if (total > MAX_TOTAL) throw new Error("Choose files totalling less than 6 MB.");
    if (typeof a.name !== "string" || !a.name.trim()) throw new Error("Invalid file name.");
    return { id: a.id, childId, kind: a.kind, name: a.name.replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 120), mimeType: a.mimeType, dataUrl: a.dataUrl };
  });
}
export const attachmentMetadata = (files: ComposerAttachment[]): AttachmentReceipt[] => files.map(({ id, kind, name, mimeType }) => ({ id, kind, name, mimeType, originalAvailable: false }));
export async function prepareCompanionAttachment(file: File, childId: string, kind: ComposerAttachment["kind"]): Promise<ComposerAttachment> {
  if (file.size > MAX_FILE) throw new Error("Each file must be under 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const dataUrl = `data:${file.type};base64,${btoa(binary)}`;
  return parseCompanionAttachments([{ id: crypto.randomUUID(), childId, kind, name: file.name, mimeType: file.type, dataUrl }], childId)[0];
}
