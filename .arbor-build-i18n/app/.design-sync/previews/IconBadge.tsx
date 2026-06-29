import { IconBadge } from "arbor-private-beta-app";
import { Sprout, MessageCircle, Heart, Moon, Footprints, Sparkles } from "lucide-react";

export function Tones() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <IconBadge tone="mint"><Sprout size={20} /></IconBadge>
      <IconBadge tone="coral"><Sparkles size={20} /></IconBadge>
      <IconBadge tone="lav"><MessageCircle size={20} /></IconBadge>
      <IconBadge tone="yellow"><Moon size={20} /></IconBadge>
      <IconBadge tone="pink"><Heart size={20} /></IconBadge>
      <IconBadge tone="sky"><Footprints size={20} /></IconBadge>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <IconBadge tone="mint" size={32}><Sprout size={16} /></IconBadge>
      <IconBadge tone="mint" size={44}><Sprout size={22} /></IconBadge>
      <IconBadge tone="mint" size={56}><Sprout size={28} /></IconBadge>
    </div>
  );
}

export function DomainRow() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <IconBadge tone="lav" size={48}><MessageCircle size={24} /></IconBadge>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--arbor-muted)" }}>Speech</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <IconBadge tone="sky" size={48}><Footprints size={24} /></IconBadge>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--arbor-muted)" }}>Motor</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <IconBadge tone="pink" size={48}><Heart size={24} /></IconBadge>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--arbor-muted)" }}>Feelings</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <IconBadge tone="mint" size={48}><Sprout size={24} /></IconBadge>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--arbor-muted)" }}>Growth</span>
      </div>
    </div>
  );
}
