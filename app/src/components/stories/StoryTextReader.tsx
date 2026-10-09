import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { getStorySpec, runTitle } from "../../lib/heroJourneys";
import { completeRender, type StoryHero } from "../../lib/heroJourneyRender";
import { langDir } from "../../lib/bidi";
import { fmtDay } from "../../lib/formatDate";
import type { HeroJourneyRun, HeroSceneRender } from "../../types";

/**
 * B-PLAY-12 — a text "book" on the Comics shelf, read again in place.
 *
 * A run with no comic (a hero-less story, or one whose comic is not on this
 * device) used to reopen from the Stories library. It now reopens here, as
 * the words the child heard: the run's own personalised text in the language
 * it was told in, every page in spine order, the decision page with the
 * choice the child made and the consequence that choice led to. Text only —
 * no art, no generation, no write, zero model calls. Parent register.
 */

const CARD: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  borderRadius: "var(--r-lg)",
};

/** The pages to read, in spine order; the consequence page carries the
 *  consequence of the choice the child made (the player's own rule). */
export function storyTextPages(run: HeroJourneyRun, hero?: StoryHero): { pages: HeroSceneRender[]; choiceLabel: string | null } {
  const lang = run.language === "he" ? "he" : "en";
  const spec = getStorySpec(run.storyId);
  const { scenes, choices } = spec
    ? completeRender(spec, run.render, lang, hero)
    : { scenes: run.render?.scenes ?? [], choices: run.render?.choices ?? [] };
  const chosen = choices.find((c) => c.id === run.choiceId);
  const pages = scenes.map((scene) => (scene.beatId === "consequence" && chosen ? { ...scene, narration: chosen.consequence } : scene));
  return { pages, choiceLabel: chosen?.label ?? null };
}

export default function StoryTextReader({ run, hero, onBack }: { run: HeroJourneyRun; hero?: StoryHero; onBack: () => void }) {
  const { t, uiLang } = useLanguage();
  const ui = uiLang === "he" ? "he" : "en";
  const lang = run.language === "he" ? "he" : "en";
  const { pages, choiceLabel } = storyTextPages(run, hero);
  const when = run.completedAt ? fmtDay(run.completedAt, ui) : t("elev.comics.storyBook.inProgress");

  return (
    <article data-testid="story-text-reader" className="mx-auto flex w-full min-w-0 max-w-[680px] flex-col gap-4">
      <button
        type="button"
        data-testid="story-text-reader-back"
        onClick={onBack}
        className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start px-1 t-sm font-bold focus:outline-none focus-visible:ring-2"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="arrow_back" size={18} aria-hidden className="rtl:-scale-x-100" />
        {t("elev.comics.storyBook.back")}
      </button>
      <header>
        <h2 lang={lang} dir={langDir(lang)} className="t-2xl leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {runTitle(run, lang)}
        </h2>
        <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{when}</p>
      </header>
      <ol className="flex flex-col gap-3" lang={lang} dir={langDir(lang)}>
        {pages.map((scene, i) => (
          <li key={`${scene.beatId}-${i}`} data-testid="story-text-page" data-beat={scene.beatId} className="p-4" style={CARD}>
            {scene.title && <h3 className="t-base font-semibold leading-snug" style={{ color: "var(--arbor-ink)" }}>{scene.title}</h3>}
            <p className="mt-1 t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{scene.narration}</p>
            {scene.beatId === "decision" && choiceLabel && (
              <p data-testid="story-text-choice" className="mt-2 t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>
                <span lang={ui} dir={langDir(ui)}>{t("elev.comics.storyBook.choice")}</span>{" "}
                <bdi dir="auto">{choiceLabel}</bdi>
              </p>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full px-5 t-sm font-bold focus:outline-none focus-visible:ring-2"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
      >
        {t("elev.comics.storyBook.back")}
      </button>
    </article>
  );
}
