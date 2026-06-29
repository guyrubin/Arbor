import React, { useMemo } from "react";
import { usePracticeData } from "../../practice/usePracticeData";
import { evaluateCosmetics, type CosmeticStats } from "../../practice/cosmetics";

/**
 * RewardsCard (A5) — gentle, earned-through-play rewards for the child. Pure
 * celebration: shows the cosmetics unlocked by practice and the nearest next one,
 * with no streak-shaming or countdowns (per the PRD's no-dark-patterns stance).
 */
export default function RewardsCard({ childId, name }: { childId: string; name: string }) {
  const data = usePracticeData(childId);

  const stats: CosmeticStats = useMemo(() => ({
    totalSessions:
      data.speech.items.length +
      data.mimic.items.length +
      data.adventures.items.length +
      data.events.items.length +
      data.missions.items.filter((m) => m.completed).length,
    daysPracticed: data.daysPracticed,
    domainsTouched: data.week.domainsTouched.length,
  }), [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.missions.items, data.daysPracticed, data.week.domainsTouched]);

  const { unlocked, next } = useMemo(() => evaluateCosmetics(stats), [stats]);

  return (
    <div className="pt-4 mt-2 space-y-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
      <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>
        {name}&apos;s rewards
      </span>

      {unlocked.length > 0 ? (
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
      ) : (
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
          Play an activity to earn {name}&apos;s first reward 🌱
        </p>
      )}

      {next && (
        <div className="rounded-xl p-3 mt-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span style={{ color: "var(--arbor-ink)" }}>
              <b>Next:</b> <span aria-hidden="true">{next.cosmetic.emoji}</span> {next.cosmetic.label}
            </span>
            <span style={{ color: "var(--arbor-muted)" }}>{next.cosmetic.requirement}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(41,51,63,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(next.progress * 100)}%`, background: "var(--arbor-clay)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
