import { CelebrationMoment } from "../ui/CelebrationMoment";
import { usePrideMoment } from "../../hooks/usePrideMoment";

/**
 * PrideMomentCard (R3 → E7) — a calm, positive-only celebration on Today when
 * the child crosses a development milestone threshold for the first time.
 * Renders nothing when there is no new crossing. The data trigger (tested R3
 * detector via usePrideMoment: positive-only, idempotent, no score number)
 * is unchanged; presentation now goes through the shared E7 CelebrationMoment
 * grammar (hero avatar, one warm sentence, one-shot entrance, ≤1/session,
 * parent-mediated share via the existing pipeline).
 */
export default function PrideMomentCard() {
  const { crossing, firstName, dismiss } = usePrideMoment();
  if (!crossing) return null;

  return <CelebrationMoment firstName={firstName} onDismiss={dismiss} testId="pride-moment" />;
}
