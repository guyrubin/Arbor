/**
 * plan-review-packet — B-GA-37: the review packet the licensed reviewer signs,
 * one Markdown file per Tier-1 pattern and language under
 * docs/everyday-plans/review/, generated from the pattern definitions so that
 * what the reviewer reads IS what the engine renders.
 *
 * Each packet lists EVERY visible string (the cover, the four frames and the
 * win, every menu item's child line and parent line, the box labels, the red
 * lines, the parent panel, the title lines) with a content hash per string
 * (sha256, first 12 hex) and one packet hash over all of them; the sourced
 * step menu; the sources; the red lines; the banned words; the poses; the
 * sceptic's three. The reviewer signs the PACKET HASH per language; the
 * server-side `PLANS_REVIEWED` record carries that signature. Nothing here is
 * a signature. Synthetic names only ({name} stays a placeholder).
 *
 *   npm run plans:packet            # regenerate (the test fails if stale)
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { authoredPatterns } from "../src/lib/library/plans/planBooks";
import type { PatternDef, PatternFramePage, PlanMenuItem } from "../src/lib/library/plans/patterns";
import type { BookLang, BookLine } from "../src/lib/library/types";

export const REVIEW_DIR = "docs/everyday-plans/review";
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
export const contentHash = (t: string) => sha(t).slice(0, 12);

type Row = { where: string; text: string };

function lineText(line: BookLine, lang: BookLang): string[] {
  return lang === "en" ? [line.en] : line.he.m === line.he.f ? [line.he.m] : [`${line.he.m}`, `${line.he.f}`];
}
const frameRows = (name: string, f: PatternFramePage, lang: BookLang): Row[] => [
  ...lineText(f.text, lang).map((t, i) => ({ where: `${name} · ${f.id}${i ? " (f)" : lang === "he" ? " (m)" : ""}`, text: t })),
  ...(f.closing ? lineText(f.closing, lang).map((t, i) => ({ where: `${name} · ${f.id} · closing${i ? " (f)" : lang === "he" ? " (m)" : ""}`, text: t })) : []),
];
const menuRows = (m: PlanMenuItem, lang: BookLang): Row[] => [
  ...lineText(m.text, lang).map((t, i) => ({ where: `step ${m.slot} · ${m.id}${i ? " (f)" : lang === "he" ? " (m)" : ""}`, text: t })),
  { where: `step ${m.slot} · ${m.id} · parent line`, text: m.parentLine[lang] },
];

/** Every string a parent or child can see for this pattern in this language, in reading order. */
export function visibleStrings(def: PatternDef, lang: BookLang): Row[] {
  const f = def.frames;
  return [
    { where: "title", text: def.title[lang] },
    { where: "cover line", text: def.coverLine[lang] },
    { where: "cover name line", text: def.coverNameLine[lang] },
    { where: "parent words (door)", text: def.parentWords[lang] },
    ...frameRows("cover", f.cover, lang),
    ...frameRows("page 1 body is good", f.bodyGood, lang),
    ...frameRows("page 2 how it works", f.howItWorks, lang),
    ...frameRows("page 3 sometimes hard", f.sometimesHard, lang),
    ...frameRows("page 4 we plan", f.wePlan, lang),
    ...def.menu.flatMap((m) => menuRows(m, lang)),
    ...frameRows("page 8 win", f.win, lang),
    ...def.boxItems.map((b) => ({ where: `box · ${b.id}`, text: b.label[lang] })),
    ...def.watchFor.map((w) => ({ where: `red line · ${w.id}`, text: w.text[lang] })),
    { where: "parent panel · knows", text: def.parent.knows[lang] },
    { where: "parent panel · why now", text: def.parent.whyNow[lang] },
    { where: "parent panel · tomorrow", text: def.parent.tomorrow[lang] },
    ...lineText(def.parent.askAfter, lang).map((t, i) => ({ where: `parent panel · ask after${i ? " (f)" : lang === "he" ? " (m)" : ""}`, text: t })),
    { where: "parent panel · together", text: def.parent.together[lang] },
    { where: "parent panel · source note", text: def.parent.sourceNote[lang] },
    { where: "parent panel · first week", text: def.parent.firstWeek[lang] },
    ...def.sources.map((s) => ({ where: `source · ${s.id}`, text: s.label[lang] })),
  ];
}

export function packetHash(def: PatternDef, lang: BookLang): string {
  return sha(visibleStrings(def, lang).map((r) => `${r.where}\u0000${r.text}`).join("\n")).slice(0, 16);
}

const md = (t: string) => t.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function renderPacket(def: PatternDef, lang: BookLang): string {
  const rows = visibleStrings(def, lang);
  const L = lang.toUpperCase();
  const lines: string[] = [];
  lines.push(`# Review packet — \`${def.id}\` (${L})`, "");
  lines.push(`Generated from \`app/src/lib/library/plans/patterns/\` by \`npm run plans:packet\`. **Packet hash: \`${packetHash(def, lang)}\`** — the reviewer signs this hash for this language; the signature is recorded server-side (\`PLANS_REVIEWED\`), never here. Hebrew is AI-written: native review owed.`, "");
  lines.push(`- Parent words (the door): ${def.parentWords[lang]}`, `- The win the child says: ${def.title[lang]}`, `- Shelf: \`${def.shelf}\` · age bands: ${def.ageBands.join(", ")} · parent panel age text: ${def.ageText}`, `- Default duration: ${def.defaultDurationDays} days · step minutes: ${def.minutesRange[0]}–${def.minutesRange[1]} · default steps: ${def.defaultSteps.map((s) => `\`${s}\``).join(", ")}`, `- Knowledge (the one adult sentence): ${def.knowledge}`, "");
  lines.push("## Every visible string", "", "| # | Where | Text | Hash |", "|---|---|---|---|");
  rows.forEach((r, i) => lines.push(`| ${i + 1} | ${md(r.where)} | ${md(r.text)} | \`${contentHash(r.text)}\` |`));
  lines.push("", "## The sourced step menu", "", "| Slot | Id | Child line | Parent line | Minutes | Time | Pose | Sources |", "|---|---|---|---|---|---|---|---|");
  for (const m of def.menu) lines.push(`| ${m.slot} | \`${m.id}\` | ${md(lineText(m.text, lang)[0])} | ${md(m.parentLine[lang])} | ${m.defaultMinutes ?? "—"} | ${m.defaultTime ?? "—"} | \`${m.pose}\` | ${m.sourceIds.map((s) => `\`${s}\``).join(", ")} |`);
  lines.push("", "## The box", "", ...def.boxItems.map((b) => `- \`${b.id}\` — ${b.label[lang]}`));
  lines.push("", "## Red lines (asked first; one match = care, no plan)", "", ...def.watchFor.map((w) => `- \`${w.id}\` — ${w.text[lang]}`));
  lines.push("", "## Sources", "", ...def.sources.map((s) => `- \`${s.id}\` — ${s.label[lang]}${s.url ? ` — ${s.url}` : ""}`));
  lines.push("", "## Banned words (beyond the shared §5 lists)", "", `- EN: ${def.bannedWords.en.map((w) => `\`${w}\``).join(", ") || "—"}`, `- HE: ${def.bannedWords.he.map((w) => `\`${w}\``).join(", ") || "—"}`);
  lines.push("", "## Poses", "", def.poses.map((p) => `\`${p}\``).join(", "));
  lines.push("", "## The sceptic's three (for the reviewer; never rendered)", "", ...def.scepticsThree.map((s, i) => `${i + 1}. ${s.en}`));
  lines.push("", "## Sign-off", "", "| Field | Value |", "|---|---|", `| Pattern | \`${def.id}\` |`, `| Language | ${L} |`, `| Packet hash | \`${packetHash(def, lang)}\` |`, "| Reviewer | _(name, licence, date — recorded server-side)_ |", "| Native editor (HE) | _(owed)_ |", "");
  return lines.join("\n");
}

export function renderIndex(defs: PatternDef[]): string {
  const lines = ["# Review packets — B-GA-37", "", "One packet per pattern and language, generated by `npm run plans:packet` (the test `scripts/plan-review-packet.test.ts` fails when a packet is stale). The reviewer signs the packet hash per language; the server's `PLANS_REVIEWED` record carries the signature. Nothing here is a signature.", "", "| Pattern | EN packet | EN hash | HE packet | HE hash |", "|---|---|---|---|---|"];
  for (const d of defs) lines.push(`| \`${d.id}\` | [${d.id}.en.md](${d.id}.en.md) | \`${packetHash(d, "en")}\` | [${d.id}.he.md](${d.id}.he.md) | \`${packetHash(d, "he")}\` |`);
  return lines.join("\n") + "\n";
}

/** Every file the packet set consists of, as { relativePath, content }. */
export function packetFiles(): { path: string; content: string }[] {
  const defs = authoredPatterns();
  const out = defs.flatMap((d) => (["en", "he"] as const).map((lang) => ({ path: `${REVIEW_DIR}/${d.id}.${lang}.md`, content: renderPacket(d, lang) })));
  out.push({ path: `${REVIEW_DIR}/README.md`, content: renderIndex(defs) });
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const files = packetFiles();
  for (const f of files) {
    const target = join(root, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
  console.log(`[plan-review-packet] ${files.length} files written under ${REVIEW_DIR}/`);
}
