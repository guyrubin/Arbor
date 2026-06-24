import React from "react";

type MissionTone = "sky" | "lav" | "peach" | "yellow" | "clay" | "green" | "pink";

const TONE: Record<MissionTone, { bg: string; ink: string }> = {
  sky: { bg: "var(--arbor-sky-soft)", ink: "var(--arbor-sky-ink)" },
  lav: { bg: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)" },
  peach: { bg: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)" },
  yellow: { bg: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)" },
  clay: { bg: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  green: { bg: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  pink: { bg: "var(--arbor-pink-soft)", ink: "var(--arbor-pink-ink)" },
};

export function MissionStatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: React.ReactNode; tone?: MissionTone; hint?: string }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {stats.map((stat) => {
        const tone = TONE[stat.tone ?? "sky"];
        return (
          <div key={stat.label} className="rounded-2xl px-4 py-3" style={{ background: tone.bg, border: "2px solid rgba(41,51,63,.12)" }}>
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: tone.ink }}>{stat.label}</p>
            <p className="mt-1 text-[22px] font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{stat.value}</p>
            {stat.hint && <p className="mt-1 text-[11px] font-bold leading-snug" style={{ color: "var(--arbor-muted)" }}>{stat.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function MissionBridge({
  title,
  children,
  tone = "yellow",
}: {
  title: string;
  children: React.ReactNode;
  tone?: MissionTone;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-3xl px-4 py-3 text-left" style={{ background: t.bg, border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
      <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: t.ink }}>{title}</p>
      <p className="mt-1 text-[14px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{children}</p>
    </div>
  );
}
