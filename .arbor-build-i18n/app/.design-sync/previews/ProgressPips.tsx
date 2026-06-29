import { ProgressPips } from "arbor-private-beta-app";

export function MidGame() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, width: "fit-content" }}>
      <ProgressPips total={5} current={2} tone="lav" />
    </div>
  );
}

export function JustStarted() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, width: "fit-content" }}>
      <ProgressPips total={6} current={0} tone="sky" />
    </div>
  );
}

export function NearlyDone() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, width: "fit-content" }}>
      <ProgressPips total={4} current={3} tone="peach" />
    </div>
  );
}

export function Tones() {
  return (
    <div
      style={{
        background: "var(--arbor-paper)",
        padding: 24,
        borderRadius: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "fit-content",
      }}
    >
      <ProgressPips total={5} current={3} tone="clay" />
      <ProgressPips total={5} current={3} tone="lav" />
      <ProgressPips total={5} current={3} tone="yellow" />
      <ProgressPips total={5} current={3} tone="pink" />
    </div>
  );
}
