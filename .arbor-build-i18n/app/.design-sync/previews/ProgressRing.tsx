import { ProgressRing } from "arbor-private-beta-app";

export function MilestoneProgress() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex" }}>
      <ProgressRing value={72} size={88} stroke={9}>
        <div style={{ textAlign: "center", lineHeight: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--arbor-ink)" }}>
            18
          </div>
          <div style={{ fontSize: 10, color: "var(--arbor-muted)", marginTop: 2 }}>of 25</div>
        </div>
      </ProgressRing>
    </div>
  );
}

export function WeeklyGoal() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", gap: 18, alignItems: "center" }}>
      <ProgressRing value={86} size={72} stroke={8}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--arbor-ink)" }}>
          6/7
        </span>
      </ProgressRing>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--arbor-ink)" }}>
          Daily check-ins
        </div>
        <div style={{ fontSize: 12.5, color: "var(--arbor-muted)", marginTop: 3 }}>
          One more and you'll close the week.
        </div>
      </div>
    </div>
  );
}

export function DomainTriptych() {
  const domains: { label: string; value: number; color: string }[] = [
    { label: "Language", value: 78, color: "var(--arbor-clay)" },
    { label: "Motor", value: 64, color: "#E8A87C" },
    { label: "Social", value: 91, color: "#9DB4C0" },
  ];
  return (
    <div
      style={{
        background: "var(--arbor-paper)",
        padding: 24,
        borderRadius: 24,
        display: "flex",
        gap: 28,
      }}
    >
      {domains.map((d) => (
        <div key={d.label} style={{ textAlign: "center" }}>
          <ProgressRing value={d.value} size={64} stroke={7} color={d.color}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--arbor-ink)" }}>{d.value}</span>
          </ProgressRing>
          <div style={{ fontSize: 11.5, color: "var(--arbor-muted)", marginTop: 8, fontWeight: 600 }}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NearlyThere() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex" }}>
      <ProgressRing value={96} size={96} stroke={10}>
        <div style={{ textAlign: "center", lineHeight: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--arbor-ink)" }}>
            96%
          </div>
          <div style={{ fontSize: 10, color: "var(--arbor-muted)", marginTop: 3 }}>profile</div>
        </div>
      </ProgressRing>
    </div>
  );
}
