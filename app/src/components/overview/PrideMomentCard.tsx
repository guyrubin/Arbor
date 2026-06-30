import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { prefersReducedMotion } from "../../lib/devscore";
import { usePrideMoment } from "../../hooks/usePrideMoment";

/**
 * PrideMomentCard (R3) — a calm, positive-only celebration on Today when the child
 * crosses a development milestone threshold for the first time. Renders nothing when
 * there is no new crossing. AADC: no streak/loss, no nagging; G2: no score number or
 * efficacy claim; face-safety: first name only, no photo. Respects reduced motion.
 */
export default function PrideMomentCard() {
  const { crossing, firstName, dismiss } = usePrideMoment();
  const { t } = useLanguage();
  if (!crossing) return null;

  const reduce = prefersReducedMotion();
  const title = firstName ? t("pride.title", { name: firstName }) : t("pride.titleGeneric");

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={reduce ? {} : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className="relative rounded-[22px] p-5"
      style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("pride.dismiss")}
        className="absolute flex items-center justify-center rounded-full"
        style={{ insetInlineEnd: 10, top: 10, width: 36, height: 36, color: "var(--arbor-green-ink)" }}
      >
        <Icon name="close" size={18} />
      </button>
      <div className="flex items-center gap-3 pe-9">
        <span
          className="flex items-center justify-center flex-shrink-0 rounded-2xl"
          style={{ width: 44, height: 44, background: "#fff", color: "var(--arbor-green-ink)" }}
        >
          <Icon name="auto_awesome" size={20} />
        </span>
        <div className="min-w-0">
          <p
            className="text-[15px] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {title}
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--arbor-green-ink)" }}>
            {t("pride.subtitle")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
