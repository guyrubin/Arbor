import { Sparkline } from "arbor-private-beta-app";
import { TrendingUp } from "lucide-react";

export function MoodTrend() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--arbor-muted)", fontWeight: 600 }}>Mood this week</div>
      <Sparkline data={[3, 3.5, 2, 4, 4.5, 5, 4.5]} width={140} height={36} max={5} />
    </div>
  );
}

export function NewWordsStat() {
  return (
    <div
      style={{
        background: "var(--arbor-paper)",
        padding: 20,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        gap: 16,
        maxWidth: 320,
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--arbor-ink)", lineHeight: 1 }}>
          47
        </div>
        <div style={{ fontSize: 11.5, color: "var(--arbor-muted)", marginTop: 4 }}>new words logged</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--arbor-clay)" }}>
          <TrendingUp size={13} /> +12
        </span>
        <Sparkline data={[1, 2, 2, 3, 4, 4, 5]} width={96} height={24} max={5} />
      </div>
    </div>
  );
}

export function SleepConsistency() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "var(--arbor-muted)", fontWeight: 600 }}>Sleep settling time</div>
      <Sparkline data={[5, 4.5, 4, 3, 3.5, 2.5, 2]} width={140} height={36} max={5} color="#9DB4C0" />
      <div style={{ fontSize: 11, color: "var(--arbor-muted)" }}>Settling faster — trending the right way.</div>
    </div>
  );
}
