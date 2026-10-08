import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicGuideCards } from "../src/content/publicHardMoments";
import { HARD_MOMENT_PILOT } from "../src/content/pilotRelease";
import { PUBLIC_WEB_ORIGIN } from "../src/lib/publicWebOrigin";

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");

/** Static social metadata only. No guidance, names, records, or clinical claims
 * are pre-rendered: the app re-checks availability whenever the page is read.
 * One static file serves both ?lang options, so the preview is bilingual. */
export function renderPublicGuidePreview(shell: string, title: string, url: string): string {
  const description = `מדריך בפיילוט · Pilot guide. תקופת הפיילוט מסתיימת ב־${HARD_MOMENT_PILOT.expiresAt.slice(0, 10)}. Pilot availability is checked when you open the guide.`;
  const fields: Array<[RegExp, string]> = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(description)}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escape(title)}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escape(description)}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escape(url)}" />`],
  ];
  // The native app uses relative Vite asset paths. Nested public routes need
  // their own root base or /guides/<topic>/assets/... returns the SPA as HTML.
  let html = shell.replace("<head>", '<head>\n  <base href="/" />');
  for (const [pattern, replacement] of fields) {
    if (!pattern.test(html)) throw new Error(`Public guide preview could not find ${pattern.source}`);
    html = html.replace(pattern, () => replacement);
  }
  return html.replace("</head>", `<link rel="canonical" href="${escape(url)}" />\n  </head>`);
}

export function buildPublicGuidePages(dist: string, now = new Date()): number {
  const shell = readFileSync(join(dist, "index.html"), "utf8");
  const cards = publicGuideCards({ locale: "en", age: null }, now);
  const pages = [
    { path: "guides", title: "מדריכים לרגעים קשים · Guides for hard moments | Arbor" },
    ...cards.map((card) => ({ path: `guides/${card.id}`, title: `${card.title.he} · ${card.title.en} | Arbor` })),
  ];
  for (const page of pages) {
    const target = join(dist, page.path, "index.html");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, renderPublicGuidePreview(shell, page.title, `${PUBLIC_WEB_ORIGIN}/${page.path}`));
  }
  return pages.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
  console.log(`[public-guides] ${buildPublicGuidePages(dist)} generic preview pages written.`);
}
