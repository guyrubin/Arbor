import React from "react";

/**
 * v3 IA-06r — the slot a dialog's companion renders in (ui/Modal and ui/Sheet
 * take it as `companion`): chrome that belongs to the open dialog but sits
 * outside its box, today the L2 crumb over the top bar title or under the
 * phone header (layout/Breadcrumb).
 *
 * It lives inside the dialog layer, so it is above the backdrop (60 % black
 * and a blur on Modal), the inert shield over the app root never reaches it,
 * and it fades with the layer. It comes before the dialog box, so Tab reaches
 * it first, as it sits first on screen, and it is lifted over the box. The
 * slot lets every pointer through to the backdrop; only the companion's own
 * controls take one. The dialog box claims it with aria-owns, so a reader
 * honouring aria-modal still reaches it (as the dialog's last child), and
 * lib/dialogStack lets focus rest in it and cycles Tab through it.
 */
export function DialogCompanion({ id, children }: { id: string; children: React.ReactNode }) {
  // The attribute is lib/dialogStack's DIALOG_COMPANION (breadcrumb.test pins the pair).
  return (
    <div id={id} data-dialog-companion="" className="pointer-events-none absolute inset-0" style={{ zIndex: 1 }}>
      {children}
    </div>
  );
}
