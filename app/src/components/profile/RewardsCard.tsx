import React, { useMemo } from "react";
import { usePracticeData } from "../../practice/usePracticeData";
import { evaluateCosmetics, lifetimeDomains, type CosmeticStats } from "../../practice/cosmetics";
import { useLanguage } from "../../context/LanguageContext";

/**
 * RewardsCard (A5) — gentle, earned-through-play rewards for the child, on a
 * PARENT surface (ProfileEditDrawer). Pure celebration: the cosmetics already
 * unlocked and ONE count sentence ("3 adventures so far").
 *
 * B-CAREPRO-44 (laws 1 + 3): no bar, no "Next:" target, no next-reward
 * silhouette. A fill toward the next cosmetic is a proportional fill of a child
 * record (firewall.proportionalFill.test.ts) and progress-toward-a-reward is a
 * pressure mechanic; the count says what happened and stops there.
 */
export default function RewardsCard({ childId, name }: { childId: string; name: string }) {
  const { t } = useLanguage();
  const data = usePracticeData(childId);

  const stats: CosmeticStats = useMemo(() => ({
    totalSessions:
      data.speech.items.length +
      data.mimic.items.length +
      data.adventures.items.length +
      data.events.items.length +
      data.missions.items.filter((m) => m.completed).length,
    daysPracticed: data.daysPracticed,
    // Lifetime, MONOTONIC domain count (never the resettable week window).
    domainsEverTouched: lifetimeDomains({
      speech: data.speech.items,
      mimic: data.mimic.items,
      adventures: data.adventures.items,
      events: data.events.items,
      missions: data.missions.items,
    }).length,
  }), [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.missions.items, data.daysPracticed]);

  const { unlocked } = useMemo(() => evaluateCosmetics(stats), [stats]);

  return (
    <div className="pt-4 mt-2 space-y-2" style={{ borderTop: "1px solid var(--arbor-rule)" }} data-testid="rewards-card">
      <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>
        {t("profile.rewards.title", { name })}
      </span>

      {unlocked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unlocked.map((c) => (
            <span
              key={c.id}
              title={c.requirement}
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full"
              style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }} data-testid="rewards-count">
        {rewardsCountLine(t, stats.totalSessions, name)}
      </p>
    </div>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The ONE line the card says about the child's play: a count, never a target. */
export function rewardsCountLine(t: T, n: number, name: string): string {
  if (n <= 0) return t("profile.rewards.none", { name });
  if (n === 1) return t("profile.rewards.count.one");
  return t("profile.rewards.count", { n });
}
