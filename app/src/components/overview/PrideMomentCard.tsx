import { CelebrationMoment } from "../ui/CelebrationMoment";
import { usePrideMoment } from "../../hooks/usePrideMoment";

/**
 * PrideMomentCard (R3 → E7, mounted W5) — a calm, positive-only celebration
 * when the child crosses a development milestone threshold for the first time.
 * Originally designed for Today, but Rule A caps Today's module budget, so the
 * W5 mount lives on the Milestones tab (MilestonesTab) — the surface where
 * crossings are born (B-TODAY-17 removed Today's feed row, so this is the
 * hook's only mount). Renders nothing when there is no new crossing.
 * The data trigger (tested R3 detector via usePrideMoment: positive-only,
 * idempotent, no score number) is unchanged; presentation goes through the
 * shared E7 CelebrationMoment grammar (hero avatar, one warm sentence,
 * one-shot entrance, ≤1/session, parent-mediated share via the existing
 * pipeline).
 */
export default function PrideMomentCard() {
  const { crossing, firstName, dismiss } = usePrideMoment();
  if (!crossing) return null;

  return <CelebrationMoment firstName={firstName} surface="milestones" onDismiss={dismiss} testId="pride-moment" />;
}
