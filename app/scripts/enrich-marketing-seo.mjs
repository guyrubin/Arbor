import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public/marketing");
const origin = "https://arborprd-westeu.web.app";
const logo = `${origin}/brand/arbor-mark-transparent.png`;

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listHtmlFiles(fullPath) : fullPath;
    }),
  );
  return files.flat().filter((file) => file.endsWith(".html"));
}

function pick(pattern, html) {
  return html.match(pattern)?.[1]?.trim() ?? "";
}

function toPublicPath(file) {
  return `/${path.relative(path.resolve("public"), file).replaceAll(path.sep, "/")}`;
}

function jsonLdFor({ file, html }) {
  const publicPath = toPublicPath(file);
  const canonical = pick(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i, html)
    || `${origin}${publicPath}`;
  const title = pick(/<title>([\s\S]*?)<\/title>/i, html);
  const description = pick(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i, html);
  const lang = pick(/<html[^>]*\slang=["']([^"']+)["']/i, html) || "en";
  const isHebrew = lang.startsWith("he") || publicPath.includes("/he/") || publicPath.endsWith("guides.html");
  const isGuideHub = publicPath.endsWith("/guides.html") || publicPath.endsWith("/guides-en.html");
  const isLanding = publicPath.endsWith("/marketing/index.html")
    || publicPath.endsWith("/arbor-marketing-landing-page-he.html")
    || publicPath.endsWith("/arbor-marketing-landing-page-en.html");

  const pageId = `${canonical}#webpage`;
  const appId = `${origin}/#software`;
  const orgId = `${origin}/#organization`;
  const siteId = `${origin}/#website`;

  const graph = [
    {
      "@type": "Organization",
      "@id": orgId,
      "name": "Arbor",
      "url": origin,
      "logo": {
        "@type": "ImageObject",
        "url": logo,
      },
      "sameAs": [],
    },
    {
      "@type": "WebSite",
      "@id": siteId,
      "name": "Arbor",
      "url": origin,
      "publisher": { "@id": orgId },
      "inLanguage": ["he", "en"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": appId,
      "name": "Arbor",
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web",
      "url": `${origin}/marketing/`,
      "image": logo,
      "description": isHebrew
        ? "Arbor היא מערכת הפעלה להתפתחות הילד: זיכרון חי, הכוונה ממומחים, משחק יומי, סיפורים אישיים וסיכום מקצועי מאושר להורה."
        : "Arbor is an operating system for child development: living memory, expert guidance, daily play, personalized stories, and parent-approved professional handoff.",
      "publisher": { "@id": orgId },
      "audience": {
        "@type": "Audience",
        "audienceType": isHebrew ? "הורים לילדים צעירים" : "parents of young children",
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/PreOrder",
      },
    },
  ];

  const pageType = isGuideHub ? "CollectionPage" : "WebPage";
  graph.push({
    "@type": pageType,
    "@id": pageId,
    "url": canonical,
    "name": title,
    "description": description,
    "isPartOf": { "@id": siteId },
    "about": { "@id": appId },
    "primaryImageOfPage": {
      "@type": "ImageObject",
      "url": logo,
    },
    "publisher": { "@id": orgId },
    "inLanguage": isHebrew ? "he" : "en",
    "dateModified": "2026-06-17",
  });

  if (!isLanding && !isGuideHub) {
    graph.push({
      "@type": "Article",
      "@id": `${canonical}#article`,
      "headline": title,
      "description": description,
      "mainEntityOfPage": { "@id": pageId },
      "author": { "@id": orgId },
      "publisher": { "@id": orgId },
      "dateModified": "2026-06-17",
      "inLanguage": isHebrew ? "he" : "en",
    });
  }

  const crumbs = [
    { name: "Arbor", item: `${origin}/marketing/` },
  ];
  if (isGuideHub) {
    crumbs.push({ name: isHebrew ? "מדריכים" : "Guides", item: canonical });
  } else if (!isLanding) {
    crumbs.push({
      name: isHebrew ? "מדריכים" : "Guides",
      item: `${origin}/marketing/${isHebrew ? "guides.html" : "guides-en.html"}`,
    });
    crumbs.push({ name: title.replace(/\s+\|\s+Arbor.*$/i, ""), item: canonical });
  }

  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    "itemListElement": crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.item,
    })),
  });

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function upsertTag(html, pattern, tag) {
  return pattern.test(html) ? html : html.replace("</head>", `${tag}\n</head>`);
}

function updateHeadTags(html, canonical) {
  let next = html;
  next = upsertTag(next, /<meta\s+property=["']og:type["']/i, `<meta property="og:type" content="website" />`);
  next = upsertTag(next, /<meta\s+property=["']og:site_name["']/i, `<meta property="og:site_name" content="Arbor" />`);
  next = upsertTag(next, /<meta\s+property=["']og:url["']/i, `<meta property="og:url" content="${canonical}" />`);
  next = upsertTag(next, /<meta\s+property=["']og:image["']/i, `<meta property="og:image" content="${logo}" />`);
  next = upsertTag(next, /<meta\s+name=["']twitter:card["']/i, `<meta name="twitter:card" content="summary_large_image" />`);
  return next;
}

function upsertJsonLd(html, data) {
  const block = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
  if (/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, block);
  }
  return html.replace("</head>", `${block}\n</head>`);
}

const files = await listHtmlFiles(root);
for (const file of files) {
  const html = await readFile(file, "utf8");
  const canonical = pick(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i, html)
    || `${origin}${toPublicPath(file)}`;
  const enriched = upsertJsonLd(updateHeadTags(html, canonical), jsonLdFor({ file, html }));
  await writeFile(file, enriched, "utf8");
}

console.log(`Enriched ${files.length} marketing pages with JSON-LD and social metadata.`);
