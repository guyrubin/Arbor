import { StatBubble } from "arbor-private-beta-app";

export function Single() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, width: "fit-content" }}>
      <StatBubble value="7" label="Day streak" tone="clay" />
    </div>
  );
}

export function Row() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatBubble value="24" label="Words practiced" tone="lav" />
        <StatBubble value="18⭐" label="Stars earned" tone="yellow" />
        <StatBubble value="92%" label="Sounds matched" tone="sky" />
      </div>
    </div>
  );
}

export function Tones() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatBubble value="3" label="Clay" tone="clay" />
        <StatBubble value="3" label="Peach" tone="peach" />
        <StatBubble value="3" label="Pink" tone="pink" />
      </div>
    </div>
  );
}
