import { ComingSoon, IconBadge } from "arbor-private-beta-app";
import { Mic, Camera } from "lucide-react";

export function Default() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "inline-flex" }}>
      <ComingSoon label="Coming soon" />
    </div>
  );
}

export function Labels() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <ComingSoon label="Coming soon" />
      <ComingSoon label="In private beta" />
      <ComingSoon label="Early access" />
    </div>
  );
}

export function InContext() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", flexDirection: "column", gap: 14, minWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconBadge tone="lav" size={40}><Mic size={20} /></IconBadge>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--arbor-ink)" }}>Voice journaling</span>
          <ComingSoon label="Coming soon" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconBadge tone="sky" size={40}><Camera size={20} /></IconBadge>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--arbor-ink)" }}>Photo milestones</span>
          <ComingSoon label="In private beta" />
        </div>
      </div>
    </div>
  );
}
