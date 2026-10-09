import React from "react";
import { FreeText } from "../ui/FreeText";
import { Receipt } from "../ui/Receipt";
import { routeHash } from "../../lib/routes";
import { useLanguage } from "../../context/LanguageContext";
import { shelfLabel } from "../../lib/shelves/registry";
import { MILESTONE_PROPOSAL_COPY, MILESTONE_PROPOSAL_DECLINE_KEY, type MilestoneCaptureProposal } from "../../lib/captureProposals";

/**
 * B-LOOP-06 — ONE proposal row under a saved moment, in the
 * ConversationProposalTray row style: "Sounds like {milestone} — in {shelf}.
 * Add it as seen?" · Add · Not this; a low-confidence match names the shelf
 * only ("Sounds like {shelf}. File it there?"). Nothing writes until the
 * parent taps; after Add / File it the row becomes a one-line receipt.
 * Parent register, tokens only, 44 px targets, logical properties.
 */
export default function MilestoneProposalRow({
  proposal,
  milestoneTitle,
  done,
  busy = false,
  onAccept,
  onDecline,
  onOpenShelf,
}: {
  proposal: MilestoneCaptureProposal;
  /** The milestone's title in the page language (gender-resolved by the caller). */
  milestoneTitle?: string;
  /** After Add / File it: the receipt replaces the buttons. */
  done?: boolean;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** B-STATUS-01: runs as the receipt's shelf link opens (the sheet closes). */
  onOpenShelf?: () => void;
}) {
  const { t } = useLanguage();
  const copy = MILESTONE_PROPOSAL_COPY[proposal.kind];
  const shelf = shelfLabel(proposal.shelf, t);
  const line = t(copy.line, { title: milestoneTitle ?? "", shelf });
  return (
    <div
      data-testid="capture-milestone-proposal"
      data-kind={proposal.kind}
      className="rounded-xl p-3"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
    >
      {done ? (
        /* B-STATUS-01: the one Receipt line, with a link to the shelf it was
           filed on (the host closes its sheet as the link opens). */
        <Receipt
          testId="capture-milestone-done"
          size="sm"
          link={{ where: shelf, href: `#${routeHash("journal", { shelf: proposal.shelf })}`, onOpen: onOpenShelf, testId: "capture-milestone-open" }}
        >
          {t(copy.done, { shelf })}
        </Receipt>
      ) : (
        <>
          <p className="text-[14px] leading-snug" style={{ color: "var(--arbor-ink)" }}>
            <FreeText text={line} />
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="capture-milestone-accept"
              onClick={onAccept}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold"
              style={{ color: "var(--arbor-clay)", background: "var(--arbor-paper-elevated)", border: "1.5px solid var(--arbor-clay)" }}
            >
              {t(copy.accept)}
            </button>
            <button
              type="button"
              data-testid="capture-milestone-decline"
              onClick={onDecline}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold"
              style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)" }}
            >
              {t(MILESTONE_PROPOSAL_DECLINE_KEY)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
