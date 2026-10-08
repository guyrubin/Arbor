import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { HardMomentGuideContent } from "./HardMomentsSection";
import { PublicGuideShare } from "./PublicGuideShare";
import { HARD_MOMENT_CATEGORIES, locText } from "../../content/hardMomentSurface";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import { publicGuideCards, publicGuideContext, publicGuidePath, readPublicGuideQuery, type PublicGuideAge, type PublicGuideQuery } from "../../content/publicHardMoments";
import { translate } from "../../lib/i18n";
import { setAiLanguage } from "../../lib/api";

export default function PublicGuides() {
  const [query, setQuery] = useState<PublicGuideQuery>(() => readPublicGuideQuery(window.location.pathname, window.location.search, navigator.language));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [now, setNow] = useState(() => new Date());
  const t = (key: string, vars?: Record<string, string | number>) => translate(query.locale, key, vars);
  const copy = (key: string, vars?: Record<string, string | number>) => t(`elev.guides.${key}`, vars);
  const cards = publicGuideCards(query, now);
  const card = query.id ? cards.find((item) => item.id === query.id) : null;
  const words = search.trim().toLocaleLowerCase(query.locale);
  const visible = cards.filter((item) => (category === "all" || item.category === category) &&
    (!words || [locText(item.title, query.locale), locText(item.doNow, query.locale), t(`hm.cat.${item.category}`)].join(" ").toLocaleLowerCase(query.locale).includes(words)));

  useEffect(() => {
    document.documentElement.lang = query.locale;
    document.documentElement.dir = query.locale === "he" ? "rtl" : "ltr";
    setAiLanguage(query.locale);
    document.title = `${card ? locText(card.title, query.locale) : copy("all")} · Arbor`;
  }, [query.locale, card?.id]);

  useEffect(() => {
    const update = () => { setQuery(readPublicGuideQuery(window.location.pathname, window.location.search, navigator.language)); setSearch(""); setCategory("all"); setNow(new Date()); };
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("popstate", update);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("popstate", update); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const navigate = (next: PublicGuideQuery, scroll = true) => {
    window.history.pushState(null, "", publicGuidePath(next));
    setQuery(next); setNow(new Date());
    if (scroll) {
      setSearch(""); setCategory("all");
      window.scrollTo({ top: 0, behavior: "instant" });
      window.requestAnimationFrame(() => document.getElementById("guide-main")?.focus({ preventScroll: true }));
    }
  };
  const browse = () => navigate({ ...query, id: null, age: null });
  const link = (next: PublicGuideQuery) => ({ href: publicGuidePath(next), onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); navigate(next);
  } });
  const inputStyle = { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" };
  const control = "min-h-11 w-full min-w-0 rounded-xl px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
  const ageText = (ages: string[]) => ages.map((age) => age.replace("-", "–")).join(" · ");

  return (
    <div className="arbor-app arbor-parent min-h-dvh" lang={query.locale} dir={query.locale === "he" ? "rtl" : "ltr"}
      style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)" }} data-testid="public-guides">
      <a href="#guide-main" className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:p-4">{copy("skip")}</a>
      <header className="border-b px-5" style={{ borderColor: "var(--arbor-rule)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 py-3">
          <a {...link({ ...query, id: null, age: null })}
            className="inline-flex min-h-11 items-center text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Arbor</a>
          <a {...link({ ...query, locale: query.locale === "he" ? "en" : "he" })} lang={query.locale === "he" ? "en" : "he"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>
            <Icon name="language" size={18} /> {copy("changeLanguage")}
          </a>
        </div>
      </header>
      <main id="guide-main" tabIndex={-1} className={`mx-auto min-w-0 px-5 pb-12 pt-8 ${query.id ? "max-w-2xl" : "max-w-4xl"}`}>
        {query.id ? <>
          <a {...link({ ...query, id: null })} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>
            <Icon name="arrow_back" size={18} className="rtl:-scale-x-100" /> {copy("all")}
          </a>
          {card ? <article className="min-w-0 space-y-6" data-testid="public-guide-detail">
            <div>
              <p className="arbor-type-kicker mb-2" style={{ color: "var(--arbor-muted)" }}>{t(`hm.cat.${card.category}`)}</p>
              <h1 className="arbor-type-hero break-words">{locText(card.title, query.locale)}</h1>
              <p className="mt-3 text-sm" style={{ color: "var(--arbor-muted)" }}><bdi>{copy("writtenFor", { ages: ageText(card.ageBands) })}</bdi></p>
            </div>
            <HardMomentGuideContent card={card} context={publicGuideContext(card, query, now)} t={t} />
            <PublicGuideShare key={`${card.id}-${query.locale}`} card={card} locale={query.locale} />
            <aside className="rounded-[var(--r-lg)] border p-5" style={{ borderColor: "var(--arbor-rule)" }}>
              <h2 className="arbor-type-title">{copy("appHeading")}</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{copy("appDetail")}</p>
              <a href={`/?lang=${query.locale}`} onClick={() => {
                try { localStorage.setItem("arbor.uiLang", query.locale); localStorage.setItem("arbor.aiLang", query.locale); } catch { /* The app can still open without preference storage. */ }
              }} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>
                {copy("open")} <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
              </a>
            </aside>
          </article> : <div className="space-y-4" role="status">
            <h1 className="arbor-type-hero">{copy("unavailable")}</h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{copy("unavailableDetail")}</p>
            <button type="button" onClick={browse} className="inline-flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>{copy("browseGuides")}</button>
          </div>}
        </> : <>
          <div className="mb-8 max-w-2xl">
            <p className="arbor-type-kicker mb-3" style={{ color: "var(--arbor-muted)" }}>{copy("kicker")}</p>
            <h1 className="arbor-type-hero">{copy("title")}</h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{copy("intro")}</p>
            <p className="mt-3 text-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{hardMomentPilotText(query.locale).status}</p>
          </div>
          <section aria-label={copy("search")} className="mb-8 space-y-4 rounded-[var(--r-lg)] p-5 arbor-depth-card" style={{ background: "var(--arbor-paper-elevated)" }}>
            <div>
              <label htmlFor="guide-search" className="mb-2 block text-sm font-semibold">{copy("search")}</label>
              <input id="guide-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy("searchHint")} className={control} style={inputStyle} />
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="guide-age" className="mb-2 block text-sm font-semibold">{copy("age")}</label>
                <select id="guide-age" value={query.age ?? ""} onChange={(event) => navigate({ ...query, age: event.target.value ? event.target.value as PublicGuideAge : null }, false)} className={control} style={inputStyle}>
                  <option value="">{copy("anyAge")}</option><option value="2-5">{copy("age25")}</option><option value="6-9">{copy("age69")}</option><option value="10-12">{copy("age1012")}</option>
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="guide-category" className="mb-2 block text-sm font-semibold">{copy("category")}</label>
                <select id="guide-category" value={category} onChange={(event) => setCategory(event.target.value)} className={control} style={inputStyle}>
                  <option value="all">{copy("anyCategory")}</option>{HARD_MOMENT_CATEGORIES.map((value) => <option key={value} value={value}>{t(`hm.cat.${value}`)}</option>)}
                </select>
              </div>
            </div>
          </section>
          <p className="mb-3 text-sm" role="status" aria-live="polite" style={{ color: "var(--arbor-muted)" }}>{copy("count", { n: visible.length })}</p>
          {visible.length ? <div className="grid min-w-0 gap-3 sm:grid-cols-2" data-testid="public-guide-list">
            {visible.map((item) => <a key={item.id} {...link({ ...query, id: item.id })}
              className="group min-w-0 rounded-[var(--r-lg)] p-5 text-start arbor-depth-card transition focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5"
              style={{ background: "var(--arbor-paper-elevated)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{t(`hm.cat.${item.category}`)}</p>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h2 className="arbor-type-title break-words">{locText(item.title, query.locale)}</h2>
                <Icon name="arrow_forward" size={20} className="mt-1 shrink-0 rtl:-scale-x-100" style={{ color: "var(--arbor-clay)" }} />
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{locText(item.doNow, query.locale)}</p>
              <p className="mt-4 text-xs" style={{ color: "var(--arbor-muted)" }}><bdi>{copy("writtenFor", { ages: ageText(item.ageBands) })}</bdi></p>
            </a>)}
          </div> : <div className="space-y-3 rounded-[var(--r-lg)] p-5" style={{ background: "var(--arbor-paper-deep)" }}>
            <p className="text-base leading-relaxed">{copy(publicGuideCards({ locale: query.locale, age: null }, now).length ? "noResults" : "noGuides")}</p>
            {(search || category !== "all" || query.age) && <button type="button" onClick={() => { setSearch(""); setCategory("all"); navigate({ ...query, age: null }, false); }} className="min-h-11 text-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>{copy("reset")}</button>}
          </div>}
        </>}
        <footer className="mt-8 border-t pt-5 text-xs leading-relaxed" style={{ borderColor: "var(--arbor-rule)", color: "var(--arbor-muted)" }}>{copy("footer")}</footer>
      </main>
    </div>
  );
}
