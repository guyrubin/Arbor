import { ArborMark } from "arbor-private-beta-app";

export function Logo() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", alignItems: "center", gap: 14 }}>
      <ArborMark size={48} />
      <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--arbor-ink)", letterSpacing: "-0.01em" }}>
        Arbor
      </span>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", alignItems: "flex-end", gap: 20 }}>
      <ArborMark size={28} />
      <ArborMark size={40} />
      <ArborMark size={64} />
      <ArborMark size={96} />
    </div>
  );
}

export function OnInk() {
  return (
    <div style={{ background: "var(--arbor-ink)", padding: 32, borderRadius: 24, display: "flex", alignItems: "center", gap: 14 }}>
      <ArborMark size={56} />
      <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--arbor-paper)", letterSpacing: "-0.01em" }}>
        Arbor
      </span>
    </div>
  );
}

export function AppIcon() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 28, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 28,
          background: "var(--arbor-green-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 32px rgba(41,51,63,0.12)",
        }}
      >
        <ArborMark size={76} />
      </div>
    </div>
  );
}
