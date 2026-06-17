import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public/marketing");
const origin = "https://arborprd-westeu.web.app";
const logo = `${origin}/brand/arbor-mark-transparent.png`;
const supportedLanguages = ["he", "en", "de", "nl", "fr"];

const localeMeta = {
  he: {
    appDescription:
      "Arbor היא מערכת הפעלה להתפתחות הילד: זיכרון חי, הכוונה ממומחים, משחק יומי, סיפורים אישיים וסיכום מקצועי מאושר להורה.",
    audience: "הורים לילדים צעירים",
    guidesName: "מדריכים",
    guidesPath: "guides.html",
  },
  en: {
    appDescription:
      "Arbor is an operating system for child development: living memory, expert guidance, daily play, personalized stories, and parent-approved professional handoff.",
    audience: "parents of young children",
    guidesName: "Guides",
    guidesPath: "guides-en.html",
  },
  de: {
    appDescription:
      "Arbor ist ein Betriebssystem für kindliche Entwicklung: lebendige Erinnerung, fundierte Orientierung, tägliches Spiel, personalisierte Geschichten und eine von Eltern freigegebene professionelle Übergabe.",
    audience: "Eltern junger Kinder",
    guidesName: "Guides",
    guidesPath: "guides-en.html",
  },
  nl: {
    appDescription:
      "Arbor is een besturingssysteem voor kinderontwikkeling: levend geheugen, deskundige begeleiding, dagelijks spel, persoonlijke verhalen en een door ouders goedgekeurde professionele overdracht.",
    audience: "ouders van jonge kinderen",
    guidesName: "Guides",
    guidesPath: "guides-en.html",
  },
  fr: {
    appDescription:
      "Arbor est un système de pilotage pour le développement de l'enfant: mémoire vivante, repères experts, jeu quotidien, histoires personnalisées et dossier professionnel validé par les parents.",
    audience: "parents de jeunes enfants",
    guidesName: "Guides",
    guidesPath: "guides-en.html",
  },
};

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

function pageLanguage({ publicPath, htmlLang }) {
  const landingLocale = publicPath.match(/arbor-marketing-landing-page-(he|en|de|nl|fr)\.html$/)?.[1];
  const sectionLocale = publicPath.match(/\/marketing\/(he|en)\//)?.[1];
  const resolvedLang =
    landingLocale
    ?? sectionLocale
    ?? (publicPath.endsWith("/guides.html") || publicPath.endsWith("/marketing/index.html")
      ? "he"
      : htmlLang.slice(0, 2));

  return supportedLanguages.includes(resolvedLang) ? resolvedLang : "en";
}

function isLandingPage(publicPath) {
  return publicPath.endsWith("/marketing/index.html")
    || /\/arbor-marketing-landing-page-(he|en|de|nl|fr)\.html$/.test(publicPath);
}

function jsonLdFor({ file, html }) {
  const publicPath = toPublicPath(file);
  const canonical = pick(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i, html)
    || `${origin}${publicPath}`;
  const title = pick(/<title>([\s\S]*?)<\/title>/i, html);
  const description = pick(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i, html);
  const htmlLang = pick(/<html[^>]*\slang=["']([^"']+)["']/i, html) || "en";
  const lang = pageLanguage({ publicPath, htmlLang });
  const locale = localeMeta[lang] ?? localeMeta.en;
  const isGuideHub = publicPath.endsWith("/guides.html") || publicPath.endsWith("/guides-en.html");
  const isLanding = isLandingPage(publicPath);

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
      "inLanguage": supportedLanguages,
    },
    {
      "@type": "SoftwareApplication",
      "@id": appId,
      "name": "Arbor",
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web",
      "url": `${origin}/marketing/`,
      "image": logo,
      "description": locale.appDescription,
      "publisher": { "@id": orgId },
      "audience": {
        "@type": "Audience",
        "audienceType": locale.audience,
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
    "inLanguage": lang,
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
      "inLanguage": lang,
    });
  }

  const crumbs = [
    { name: "Arbor", item: `${origin}/marketing/` },
  ];
  if (isGuideHub) {
    crumbs.push({ name: locale.guidesName, item: canonical });
  } else if (!isLanding) {
    crumbs.push({
      name: locale.guidesName,
      item: `${origin}/marketing/${locale.guidesPath}`,
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
