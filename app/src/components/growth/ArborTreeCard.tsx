import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ContentWhyLine } from "../ui/ContentActionBar";
import { ARBOR_TREE_LEAF_CAP, ARBOR_TREE_VIEWBOX, arborTreeView } from "../../lib/arborTree";

/* ════════════════════════════════════════════════════════════════════════════
   ArborTreeCard — GP-30: "a leaf per noticed milestone, same frame, counts only".

   WHOSE TREE THIS IS. The parent's. Every word on the card attributes the
   record to the parent ("moments you've noticed"), the child's name never
   appears on it, and there is no possessive anywhere. A tree drawn for a child
   is a growth metaphor about that child, which is the exact class of surface
   the clinical firewall exists to prevent; a tree drawn for a parent's own
   noticing is a keepsake of what they wrote down. The whole design rides on
   holding that distinction, so it is restated in lib/arborTree.ts too.

   COUNTS ONLY. There is no denominator on this card, and none can be derived
   from it: no percentage, ratio, "x of y", ring, band, level, delta, trend,
   domain ranking or weakest-area pointer, and no colour that means good or
   bad about the child. Every leaf is identical — same size, same colour, same
   weight — so the picture cannot rank anything by inspection. There is also
   no empty-slot placeholder leaf: an unfilled slot IS a completion ratio,
   drawn, and a canopy of hollow outlines is exactly the "you are missing
   these" read this card must never have.

   THE COUNT CANNOT FALL. `arborTreeView` counts the FULL milestone record from
   ArborContext, unwindowed and age-blind. The age-windowed count that Growth's
   record card shows (current corrected CDC band + one earlier) is right there
   and is right for what it does — but windowed leaves would VANISH the day the
   child crosses a band, telling a parent their child went backwards because
   they had a birthday. `elev.arborTree.basis` says out loud that this number
   spans the whole record, so the two honest numbers on this hub cannot read as
   a contradiction. lib/arborTree.test.ts pins the property, with the windowed
   derivation as the negative control.

   SAME FRAME. This is the Growth hub's shipped card frame, byte-for-byte the
   one MonthInReview and FirstWordsLedger use: rounded-[24px] on
   --arbor-paper-elevated, a 1px --arbor-rule border, --shadow-sm, an uppercase
   eyebrow, a --font-display heading, and inner tiles on --arbor-paper-deep.
   The drawing is inline SVG built only from --arbor-* tokens (no new palette,
   no illustration library, no animation, no new dependency).

   ACCESSIBILITY. The picture is never the only carrier: the count is stated in
   plain words above it, and the SVG is a single role="img" node with a text
   label naming the same number. Nothing here is conveyed by colour or shape
   alone.
   ════════════════════════════════════════════════════════════════════════════ */

/** Every leaf is drawn identically — see the firewall note above. */
const LEAF_RX = 5.4;
const LEAF_RY = 3.1;

export default function ArborTreeCard() {
  const { milestones, setActiveTab } = useArbor();
  const { t } = useLanguage();

  const view = useMemo(() => arborTreeView(milestones), [milestones]);
  const { noticedCount, leaves, capped } = view;
  const isEmpty = noticedCount === 0;

  const ariaLabel = isEmpty
    ? t("elev.arborTree.aria.empty")
    : noticedCount === 1
      ? t("elev.arborTree.aria.one")
      : t("elev.arborTree.aria.many", { n: noticedCount });

  return (
    <section
      data-testid="growth-arbor-tree"
      aria-labelledby="growth-arbor-tree-title"
      className="overflow-hidden rounded-[24px] p-4 sm:p-6"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="min-w-0">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          <Icon name="eco" size={16} />
          {t("elev.arborTree.eyebrow")}
        </span>
        <h2
          id="growth-arbor-tree-title"
          className="mt-2 break-words text-xl font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {t("elev.arborTree.title")}
        </h2>

        {/* The text equivalent of the drawing, and the ONLY number on the card.
            Absent entirely at zero: a "0" beside a bare tree is a number that
            implies a deficiency, which is the whole failure mode here. */}
        {!isEmpty && (
          <>
            <p
              data-testid="growth-arbor-tree-count"
              className="mt-1 text-[13px] font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              {noticedCount === 1
                ? t("elev.arborTree.count.one")
                : t("elev.arborTree.count.many", { n: noticedCount })}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.arborTree.basis")}
            </p>
          </>
        )}
      </div>

      {/* The drawing. Trunk and branches are always present — a record with
          little in it is a young tree, never a bare skeleton — and leaves are
          added from the crown's centre outwards as the parent notices more. */}
      <div
        className="mt-4 flex justify-center rounded-2xl p-4"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <svg
          data-testid="growth-arbor-tree-svg"
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${ARBOR_TREE_VIEWBOX.width} ${ARBOR_TREE_VIEWBOX.height}`}
          className="h-auto w-full max-w-[280px]"
        >
          <path
            d="M100 146 L100 88"
            fill="none"
            stroke="var(--arbor-muted)"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <path
            d="M100 120 C100 110 89 105 79 100"
            fill="none"
            stroke="var(--arbor-muted)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            d="M100 112 C100 102 111 98 121 93"
            fill="none"
            stroke="var(--arbor-muted)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {leaves.map((leaf) => (
            <ellipse
              key={leaf.i}
              data-testid="growth-arbor-tree-leaf"
              cx={leaf.x}
              cy={leaf.y}
              rx={LEAF_RX}
              ry={LEAF_RY}
              fill="var(--arbor-green-ink)"
              transform={`rotate(${leaf.rotation} ${leaf.x} ${leaf.y})`}
            />
          ))}
        </svg>
      </div>

      {/* Day 0, or a parent who has not marked anything yet. Warm and true:
          it says what makes a leaf appear, and says there is nothing to fill
          in — never a count, never a target, never a shortfall. */}
      {isEmpty && (
        <div className="mt-3" data-testid="growth-arbor-tree-empty">
          <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.arborTree.empty.title")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.arborTree.empty.body")}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("milestones")}
            data-testid="growth-arbor-tree-cta"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
            style={{ background: "var(--arbor-clay)" }}
          >
            <Icon name="edit_note" size={18} /> {t("elev.arborTree.empty.cta")}
          </button>
        </div>
      )}

      {/* The drawing has stopped adding marks; the number above has not. */}
      {capped && (
        <p
          data-testid="growth-arbor-tree-cap"
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: "var(--arbor-muted)" }}
        >
          {t("elev.arborTree.cap", { n: ARBOR_TREE_LEAF_CAP })}
        </p>
      )}

      {/* Where the number came from, and the door to the Trust Center. */}
      <div className="mt-3">
        <ContentWhyLine why={t("elev.arborTree.why")} trustLink surface="growth-arbor-tree" />
      </div>
    </section>
  );
}
