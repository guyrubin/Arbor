import { Modal, Button, Badge } from "arbor-private-beta-app";
import { Sparkles, Trash2 } from "lucide-react";

export function Confirm() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, minHeight: 280 }}>
      <Modal open title="Add this milestone?" onClose={() => {}}>
        <p style={{ color: "var(--arbor-muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
          We'll log <strong style={{ color: "var(--arbor-ink)" }}>"Stacks three blocks"</strong> to Mia's growth
          story and update her fine-motor track. You can edit or remove it anytime.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary">Not yet</Button>
          <Button variant="primary">
            <Sparkles size={16} /> Save milestone
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function InsightDialog() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, minHeight: 320 }}>
      <Modal open title="What Arbor noticed" onClose={() => {}}>
        <div style={{ marginBottom: 12 }}>
          <Badge tone="green">Language ↑</Badge>
        </div>
        <p style={{ color: "var(--arbor-muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
          Over the last two weeks Mia's vocabulary roughly doubled — from 18 words to 35. Combining words
          into short phrases is the next gentle step. Narrating your day out loud is the simplest way to help.
        </p>
        <div
          style={{
            background: "var(--arbor-green-soft)",
            borderRadius: 16,
            padding: 14,
            fontSize: 13,
            color: "var(--arbor-ink)",
            marginBottom: 20,
          }}
        >
          Try at bath time: name each body part as you wash. Repetition in routine moments is where new
          words stick.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost">Maybe later</Button>
          <Button variant="primary">Got it</Button>
        </div>
      </Modal>
    </div>
  );
}

export function DestructiveConfirm() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, minHeight: 260 }}>
      <Modal open title="Delete this memory?" onClose={() => {}}>
        <p style={{ color: "var(--arbor-muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
          "First splash in the sea" will be permanently removed from Mia's timeline. This can't be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary">Keep it</Button>
          <Button variant="primary">
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
