import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import {
  publishedHardMomentCards,
  renderSayThis,
  type HardMomentCard,
  type HardMomentCategory,
} from "../../content/hardMomentCards";
import {
  HARD_MOMENT_CATEGORIES,
  buildHardMomentSeedPrompt,
  escalationText,
  locText,
} from "../../content/hardMomentSurface";

/**
 * CONT-2 (AR-CONT-01) — the Behaviors "Hard moments" surface, built dark.
 * Reads ONLY publishedHardMomentCards (fail-closed via isPublishableContent),
 * so with the real all-draft pack this component renders NOTHING; governance
 * stays the switch (GD-10). Category chips open a card sheet with the five
 * labeled sections; the escalation renders VERBATIM from the governed record
 * in a distinct calm safety band — never paraphrased (clinical firewall).
 * Parent register: calm/clinical, --arbor-green-* primary, tokens only.
 */
export default function HardMomentsSection() {
  const { childProfile, seedCoach } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const [category, setCategory] = useState<HardMomentCategory | "all">("all");
  const [openCard, setOpenCard] = useState<HardMomentCard | null>(null);

  const locale = uiLang === "he" ? "he" : "en";
  const childFirst = (childProfile.name || "").split(" ")[0];

  const categories = useMemo(
    () => HARD_MOMENT_CATEGORIES.filter((c) => publishedHardMomentCards.some((card) => card.category === c)),
    [],
  );
  const visible = useMemo(
    () => (category === "all" ? publishedHardMomentCards : publishedHardMomentCards.filter((card) => card.category === category)),
    [category],
  );

  // Fail-closed: the whole section is hidden until clinical review publishes cards.
  if (publishedHardMomentCards.length === 0) return null;

  const sections: { key: string; icon: string; text: (card: HardMomentCard) => string }[] = [
    { key: "hm.section.doNow", icon: "task_alt", text: (card) => locText(card.doNow, locale) },
    { key: "hm.section.sayThis", icon: "chat_bubble", text: (card) => locText(renderSayThis(card, childFirst), locale) },
    { key: "hm.section.avoid", icon: "block", text: (card) => locText(card.avoid, locale) },
    { key: "hm.section.observe", icon: "visibility", text: (card) => locText(card.observe, locale) },
  ];

  return (
    <section className={`${cardCls} min-w-0 p-5 space-y-4`} aria-labelledby="hard-moments-title" data-testid="hard-moments-section">
      <div className="min-w-0">
        <h3 id="hard-moments-title" className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--arbor-ink)" }}>
          {t("hm.title")}
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("hm.sub")}</p>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("hm.categoriesAria")}>
        {(["all", ...categories] as (HardMomentCategory | "all")[]).map((value) => {
          const on = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={on}
              className="min-h-10 rounded-full px-3.5 text-xs font-bold transition"
              style={on
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)" }
                : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              {value === "all" ? t("hm.cat.all") : t(`hm.cat.${value}`)}
            </button>
          );
        })}
      </div>

      {/* Card list */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setOpenCard(card)}
            className="flex min-h-[52px] min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-start transition"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{locText(card.title, locale)}</span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-green-ink)" }}>{t(`hm.cat.${card.category}`)}</span>
            </span>
            <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:-scale-x-100" style={{ color: "var(--arbor-green-ink)" }} />
          </button>
        ))}
      </div>

      {/* Card sheet — the five labeled sections */}
      <Modal open={openCard !== null} onClose={() => setOpenCard(null)} title={openCard ? locText(openCard.title, locale) : undefined}>
        {openCard && (
          <div className="space-y-3">
            {sections.map(({ key, icon, text }) => (
              <div key={key} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                  <Icon name={icon} size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-green-ink)" }}>{t(key)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{text(openCard)}</p>
                </div>
              </div>
            ))}

            {/* Escalation — distinct calm safety band. VERBATIM from the
                governed record via escalationText (never paraphrased). */}
            <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule-strong)" }} role="note" data-testid="hard-moment-escalation">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)" }}>
                <Icon name="volunteer_activism" size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.section.escalation")}</p>
                <p className="mt-0.5 text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{escalationText(openCard, locale)}</p>
              </div>
            </div>

            {/* Talk this through — the existing seedCoach seam, card context attached. */}
            <button
              type="button"
              onClick={() => {
                seedCoach({ prompt: buildHardMomentSeedPrompt(openCard, aiLang === "he" ? "he" : "en", childFirst), source: "hard-moment-card" });
                setOpenCard(null);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98]"
              style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
            >
              <Icon name="forum" size={16} /> {t("hm.talkThrough")}
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}
