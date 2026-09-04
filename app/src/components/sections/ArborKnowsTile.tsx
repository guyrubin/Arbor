import React from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import { arborKnows, countProfileFacts } from "../../lib/keepsakeCounts";

/**
 * ArborKnowsTile — ENG-14(a): "Arbor knows {n} things about {name}".
 *
 * THE DEFECT: compounding value was invisible in week 1. The dev-map card
 * returns null until devScore confidence exists, ProgressNarrative is skipped
 * on day 0, and the "Arbor remembers" counter lives inside the since-strip —
 * which only renders for a RETURNING parent who already has rows. The newest
 * parent, the one deciding whether Arbor is worth keeping, watched nothing
 * grow. This tile answers on day 0, from the profile alone.
 *
 * CLINICAL FIREWALL — THIS IS A COUNT, NOT A SCORE.
 * There is no denominator, no target, no ring, no bar, no "of 20", no delta
 * against last week, and no colour that means good or bad about the child.
 * Seven is not better than three; it is simply what the parent has told Arbor
 * so far. The arithmetic lives in lib/keepsakeCounts (tested there, and its
 * return shape deliberately cannot express a ratio).
 *
 * RTL: logical properties only; counts are rendered as plain numbers inside
 * the localized sentence. Tokens only — no raw hex.
 */
export default function ArborKnowsTile() {
  const { childProfile, behaviorLogs, milestones, approvedMemoryItems } = useArbor();
  const { t } = useLanguage();

  const first = (childProfile?.name || "").split(" ")[0];
  const knows = arborKnows({
    profileFacts: countProfileFacts(childProfile),
    moments: behaviorLogs?.length ?? 0,
    milestones: (milestones ?? []).filter((m) => m.checked).length,
    memories: approvedMemoryItems?.length ?? 0,
  });

  const empty = knows.total === 0;
  const title = empty
    ? t("elev.knows.empty.title", { name: first })
    : knows.total === 1
      ? t("elev.knows.titleOne", { name: first })
      : t("elev.knows.title", { count: knows.total, name: first });
  const sub = empty ? t("elev.knows.empty.sub", { name: first }) : t("elev.knows.sub");

  return (
    <section className={`${cardCls} p-5`} data-testid="arbor-knows-tile">
      <div className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <Icon name="bookmark" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[15px] font-extrabold leading-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {title}
          </h2>
          <p className="text-xs mt-0.5" dir="auto" style={{ color: "var(--arbor-muted)" }}>
            {sub}
          </p>
        </div>
      </div>

      {/* The breakdown: one row per part that actually holds something. A part
          with nothing in it is omitted — an empty row would read as a gap the
          parent is failing to fill, which is exactly what this must never do. */}
      {knows.parts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {knows.parts.map((part) => (
            <li
              key={part.id}
              className="flex items-center justify-between gap-3 text-[12.5px]"
              style={{ color: "var(--arbor-ink-soft)" }}
            >
              <span dir="auto">{t(`elev.knows.part.${part.id}`)}</span>
              <span className="font-extrabold tabular-nums" style={{ color: "var(--arbor-green-ink)" }}>
                {part.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
