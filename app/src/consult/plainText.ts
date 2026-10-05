/* W2-CAREPRO c2 r1 (consult design P1) — what leaves Consult is clean plain
 * text. `serializeForExport` still builds the guarded Markdown (every ceiling
 * and scan runs on it, and every existing egress test pins it); this pure pass
 * turns that string into the words a parent pastes into WhatsApp, SMS or an
 * email: a title line, plain section heads, "•" bullets — never "#", "**" or
 * "_" — plus each line's ROLE, so the verbatim preview can give the same
 * string a type hierarchy without changing a single character of it. The PDF
 * keeps its own typographic heads (exportPrintSections). */

export type ExportLineRole = "title" | "head" | "note" | "item" | "body" | "blank";
export interface ExportLine { text: string; role: ExportLineRole }

/** Markdown export text → plain lines with roles. Total and pure. */
export function exportPlainLines(markdown: string): ExportLine[] {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const out: ExportLine[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      // One blank line between blocks, never a run of them.
      if (out.length && out[out.length - 1].role !== "blank") out.push({ text: "", role: "blank" });
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^#\s+(.*)$/.exec(line))) out.push({ text: m[1], role: "title" });
    else if ((m = /^#{2,6}\s+(.*)$/.exec(line))) out.push({ text: m[1], role: "head" });
    else if ((m = /^\*\*(.+)\*\*$/.exec(line))) out.push({ text: m[1], role: "note" });
    else if ((m = /^_(.+)_$/.exec(line))) out.push({ text: m[1], role: "note" });
    else if ((m = /^[-*]\s+(.*)$/.exec(line))) out.push({ text: `• ${m[1]}`, role: "item" });
    else out.push({ text: line, role: "body" });
  }
  return out;
}

/** The plain string itself (what Copy and Send carry). */
export function exportPlainText(markdown: string): string {
  return exportPlainLines(markdown).map((l) => l.text).join("\n");
}
