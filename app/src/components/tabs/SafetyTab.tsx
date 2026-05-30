import React from "react";
import { motion } from "motion/react";

export default function SafetyTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Trust & Safety Guidelines</h2>
        <p className="text-sm text-[#a8a093] mt-1">Our platform enforces safety as a top-level product feature. Secure data processing and boundaries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-yellow-500/15 rounded-xl flex items-center justify-center text-xl text-yellow-300">🩺</div>
          <h3 className="font-bold text-white text-sm">Medical Escalation Safeguard</h3>
          <p className="text-[#a8a093] leading-relaxed">
            Our Parent Coach evaluates high-risk terms such as fever, injury, self-harm language, abuse concerns, regression, and severe distress, then routes parents toward professional or urgent support.
          </p>
        </div>

        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-xl text-blue-300">🇪🇺</div>
          <h3 className="font-bold text-white text-sm">GDPR & Minimization Controls</h3>
          <p className="text-[#a8a093] leading-relaxed">
            Arbor is designed for GDPR-aligned children&apos;s data minimization. No unsupervised AI interaction is permitted for children, and child details should be stored as parent-approved observations.
          </p>
        </div>

        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center text-xl text-green-300">🛡️</div>
          <h3 className="font-bold text-white text-sm">Multi-Professional Handoff</h3>
          <p className="text-[#a8a093] leading-relaxed">
            The printable summary bridges home observations with specialized care profiles, giving teachers and clinics clear, non-diagnosing observational context instantly.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
