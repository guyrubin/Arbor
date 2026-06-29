import { Avatar } from "arbor-private-beta-app";

export function Initials() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <Avatar name="Mia Rubin" size={56} />
      <Avatar name="Noah Levi" size={56} />
      <Avatar name="Ava Cohen" size={56} />
      <Avatar name="Liam Berg" size={56} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <Avatar name="Mia Rubin" size={28} />
      <Avatar name="Mia Rubin" size={40} />
      <Avatar name="Mia Rubin" size={56} />
      <Avatar name="Mia Rubin" size={72} />
    </div>
  );
}

export function Ringed() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex" }}>
      <Avatar name="Guy Rubin" size={64} ring />
    </div>
  );
}

export function FamilyStack() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <Avatar name="Guy Rubin" size={48} ring />
      <span style={{ marginLeft: -12 }}>
        <Avatar name="Mia Rubin" size={48} ring />
      </span>
      <span style={{ marginLeft: -12 }}>
        <Avatar name="Noah Rubin" size={48} ring />
      </span>
      <span style={{ marginLeft: 12, color: "var(--arbor-muted)", fontSize: 13, fontWeight: 700 }}>
        Your family
      </span>
    </div>
  );
}
