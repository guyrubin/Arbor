/** Synthetic document fixtures: source lines become actual file bytes. The OCR
 * route never receives source text alongside them. No files or profiles from a
 * real family are read, and generated binary bytes stay in memory. */
export function syntheticPdf(lines: readonly string[]): Buffer {
  if (!lines.length || lines.some((line) => !/^[\x20-\x7e]*$/.test(line) || line.length > 95)) throw new Error("PDF fixtures require short ASCII source lines");
  const literal = (text: string) => text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 36 750 Td\n${lines.map((line, i) => `${i ? "0 -28 Td " : ""}(${literal(line)}) Tj`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

export async function syntheticDocumentDataUrl(input: Record<string, unknown>, locale: string): Promise<string> {
  const lines = input.sourceLines as string[];
  if (!Array.isArray(lines) || !lines.length || lines.length > 12 || lines.some((line) => typeof line !== "string" || line.length > 200)) throw new Error("Invalid synthetic document source lines");
  if (input.documentKind === "pdf") return `data:application/pdf;base64,${syntheticPdf(lines).toString("base64")}`;
  if (input.documentKind !== "photo") throw new Error("Invalid synthetic document kind");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
    const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    await page.setContent(`<html lang="${locale === "he" ? "he" : "en"}" dir="${locale === "he" ? "rtl" : "ltr"}"><body style="margin:0;padding:64px;background:white;color:black;font:36px/1.8 Arial,sans-serif">${lines.map((line) => `<p style="margin:0 0 24px">${escape(line)}</p>`).join("")}</body></html>`);
    const png = await page.screenshot({ type: "png", fullPage: true });
    return `data:image/png;base64,${png.toString("base64")}`;
  } finally { await browser.close(); }
}
