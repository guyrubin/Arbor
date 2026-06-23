import { Card, Badge, Avatar } from "arbor-private-beta-app";
import { Sprout, Heart, MessageCircleHeart, TrendingUp } from "lucide-react";

export function Default() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 420 }}>
      <Card className="p-5">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--arbor-green-soft)",
              color: "var(--arbor-clay)",
            }}
          >
            <Sprout size={18} />
          </span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--arbor-ink)", fontSize: 15 }}>
              This week's growth
            </div>
            <div style={{ color: "var(--arbor-muted)", fontSize: 12 }}>Mia · 22 months</div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Badge tone="green">On track</Badge>
          </span>
        </div>
        <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Two-word phrases are emerging — "more milk", "up please". Pointing to name familiar objects is
          right on schedule.
        </p>
      </Card>
    </div>
  );
}

export function Hoverable() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 420 }}>
      <Card hover className="p-5">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Heart size={16} style={{ color: "var(--arbor-clay)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--arbor-ink)", fontSize: 14 }}>
            A moment to savor
          </span>
        </div>
        <p style={{ color: "var(--arbor-muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          "Said 'love you Dada' unprompted at bedtime." Captured 2 days ago — your most-revisited memory
          this month. Hover to lift.
        </p>
      </Card>
    </div>
  );
}

export function MilestoneTile() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 300 }}>
      <Card className="p-5" style={{ textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 12px",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--arbor-peach-soft)",
            color: "var(--arbor-clay)",
          }}
        >
          <TrendingUp size={22} />
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "var(--arbor-ink)" }}>
          14
        </div>
        <div style={{ color: "var(--arbor-muted)", fontSize: 12, marginTop: 2 }}>milestones this month</div>
      </Card>
    </div>
  );
}

export function ProfileCard() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 360 }}>
      <Card hover className="p-5">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name="Mia Rubin" size={52} ring />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--arbor-ink)", fontSize: 16 }}>
              Mia Rubin
            </div>
            <div style={{ color: "var(--arbor-muted)", fontSize: 12, marginBottom: 8 }}>Born Aug 2024 · 22 months</div>
            <div style={{ display: "flex", gap: 6 }}>
              <Badge tone="green">Language ↑</Badge>
              <Badge tone="blue">Motor steady</Badge>
            </div>
          </div>
          <MessageCircleHeart size={18} style={{ color: "var(--arbor-clay)" }} />
        </div>
      </Card>
    </div>
  );
}
