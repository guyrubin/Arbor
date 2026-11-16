import type { Composition } from "../../../design/useComposition";
import { LivingForm, Token } from "../../../design/primitives";
import { SHELF_ART } from "../../../lib/parentArt";
import { SHELF_IDS, type ShelfId } from "../../../lib/shelves/registry";
import { squareCrop } from "./livingFormCrop";

/**
 * Moments · Shelf by shelf — the nine shelves (Moments only), each a ledge
 * with its Living Form; one leaf stands on the ledge for each thing the parent
 * recorded on that shelf (production's journal count: the last 30 days), the
 * count printed beside them. The newest thing's leaf is ringed. An empty shelf
 * says production's "Nothing yet". Each ledge opens its shelf page.
 */
const LEAF_CAP = 8;

export default function MomentsShelves({ composition, counts, newestShelf, label, nothingYet, tokenLabel, onOpen }: {
  composition: Composition;
  counts: Partial<Record<ShelfId, number>>;
  newestShelf: ShelfId | null;
  label: (id: ShelfId) => string;
  nothingYet: string;
  tokenLabel: string;
  onOpen: (id: ShelfId) => void;
}) {
  const phone = composition === "phone";
  const form = phone ? 28 : 40;
  return (
    <ul className={phone ? "ldgs ldgm" : "ldgs"}>
      {SHELF_IDS.map((id) => {
        const n = counts[id] ?? 0;
        const art = SHELF_ART[id];
        const shown = Math.min(n, LEAF_CAP);
        return (
          <li key={id}>
            <button type="button" className={n ? "ldg" : "ldg empty"} data-shelf={id} onClick={() => onOpen(id)}>
              <span className="lhd">
                <span style={{ opacity: n ? 1 : 0.55, display: "flex" }}>
                  <LivingForm src={art.src} srcSet={art.srcSet} width={form} height={Math.round(form * 0.66)} crop={squareCrop(form, Math.round(form * 0.66))} />
                </span>
                <span className="lnm">{label(id)}</span>
              </span>
              <span className="on">
                {n > 0 ? <>
                  {Array.from({ length: shown }, (_, i) => (
                    <Token key={i} kind="moment" size={phone ? "sm" : "md"} isNew={id === newestShelf && i === shown - 1} label={tokenLabel}
                      style={i ? { marginInlineStart: phone ? -12 : -8 } : undefined} />
                  ))}
                  <b className="arbor-num">{n}</b>
                </> : <span className="ny">{nothingYet}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
