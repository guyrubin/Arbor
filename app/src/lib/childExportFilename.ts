/** Use a portable ASCII basename for the Your data download.
 * Keep the original name in the JSON and UI; this token is only a file label.
 * The fixed prefix/suffix also keep device names (CON, AUX, etc.) harmless. */
export function childExportFilename(name: string, status: "complete" | "incomplete"): string {
  const first = name.trim().split(/\s+/)[0];
  const token = first.replace(/[^A-Za-z0-9_-]+/g, "-")
    .toLowerCase().slice(0, 64).replace(/^[-_]+|[-_]+$/g, "") || "child";
  return `arbor-${token}-data${status === "incomplete" ? ".partial" : ""}.json`;
}
