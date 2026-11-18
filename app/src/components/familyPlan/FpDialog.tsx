import React from "react";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { DsRoot } from "../../design/primitives";

/**
 * The Family plan's dialogs: a bottom sheet on a phone, a centred dialog on a
 * desk (the app's two existing surfaces). Both portal to <body>, outside the
 * screen's `.ds` root, so the content gets its own `.ds` scope here.
 */
export function FpDialog({ open, onClose, title, wide = false, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  const compact = useCompactSurface();
  const body = (
    <DsRoot composition={compact ? "phone" : "desk"} className="fp">
      <div className="fp-sheet">{children}</div>
    </DsRoot>
  );
  return compact ? (
    <Sheet open={open} onClose={onClose} title={title}>{body}</Sheet>
  ) : (
    <Modal open={open} onClose={onClose} title={title} maxWidth={wide ? "max-w-3xl" : "max-w-xl"}>{body}</Modal>
  );
}
