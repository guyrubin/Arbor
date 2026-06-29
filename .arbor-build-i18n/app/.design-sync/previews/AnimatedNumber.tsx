import { AnimatedNumber } from "arbor-private-beta-app";

export function MilestonesReached() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, color: "var(--arbor-ink)", lineHeight: 1 }}>
        <AnimatedNumber value={18} />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--arbor-muted)" }}>milestones reached</div>
    </div>
  );
}

export function StreakDays() {
  return (
    <div
      style={{
        background: "var(--arbor-paper)",
        padding: 24,
        borderRadius: 24,
        display: "flex",
        gap: 32,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "var(--arbor-clay)", lineHeight: 1 }}>
          <AnimatedNumber value={12} />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--arbor-muted)", marginTop: 4 }}>day streak</div>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "var(--arbor-ink)", lineHeight: 1 }}>
          <AnimatedNumber value={47} />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--arbor-muted)", marginTop: 4 }}>moments saved</div>
      </div>
    </div>
  );
}

export function GrowthPercent() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, color: "var(--arbor-ink)", lineHeight: 1 }}>
        <AnimatedNumber value={92.5} decimals={1} suffix="%" />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--arbor-muted)" }}>on-track for 22 months</div>
    </div>
  );
}
