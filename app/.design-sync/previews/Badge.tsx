import { Badge } from "arbor-private-beta-app";

export function Tones() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Badge tone="green">On track</Badge>
      <Badge tone="blue">Motor steady</Badge>
      <Badge tone="amber">Worth a look</Badge>
      <Badge tone="red">Talk to us</Badge>
      <Badge tone="neutral">Not started</Badge>
    </div>
  );
}

export function MilestoneStatus() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Badge tone="green">New word</Badge>
      <Badge tone="green">Climbs stairs</Badge>
      <Badge tone="amber">Emerging</Badge>
    </div>
  );
}

export function Counts() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Badge tone="blue">3 new</Badge>
      <Badge tone="amber">2 pending</Badge>
      <Badge tone="neutral">12 total</Badge>
    </div>
  );
}

export function OnLabel() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--arbor-ink)", fontSize: 15 }}>
        Speech & language
      </span>
      <Badge tone="green">Ahead</Badge>
    </div>
  );
}
