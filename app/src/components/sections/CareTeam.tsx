import React from "react";
import { motion } from "motion/react";
import { Users, Eye, RefreshCw, CalendarPlus, Search } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, cardCls, Chip, PASTEL, PastelKey } from "../ui/kit";

const TEAM: { name: string; role: string; status: string; lastReport: string; next: string; permission: string; tone: PastelKey }[] = [
  { name: "Dr. Maya Levi", role: "Child Psychologist", status: "Active", lastReport: "Therapist Summary · 2 weeks ago", next: "Thu, 12 Jun · 16:00", permission: "Patterns + summaries", tone: "sky" },
  { name: "Ms. Tal (Preschool)", role: "Lead Teacher", status: "Active", lastReport: "Teacher Handoff · 5 days ago", next: "—", permission: "Handoff notes only", tone: "mint" },
];

/** Care Network › My Care Team. */
export default function CareTeam() {
  const { childProfile, setActiveTab } = useArbor();
  const first = childProfile.name.split(" ")[0];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Care Network"
        title="My care team"
        subtitle={`The professionals coordinating around ${first} — with exactly the context you've shared, and nothing more.`}
        action={
          <button onClick={() => setActiveTab("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}>
            <Search className="w-4 h-4" /> Find a professional
          </button>
        }
      />
      <div className="grid lg:grid-cols-2 gap-5">
        {TEAM.map((t) => (
          <div key={t.name} className={`${cardCls} p-5`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold" style={{ background: PASTEL[t.tone].soft, color: PASTEL[t.tone].ink, fontFamily: "var(--font-display)" }}>
                {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t.name}</h3>
                <p className="text-sm" style={{ color: "#1f8a5a" }}>{t.role}</p>
              </div>
              <Chip tone="mint">{t.status}</Chip>
            </div>
            <dl className="mt-4 space-y-1.5 text-[12px]">
              <Row k="Last shared" v={t.lastReport} />
              <Row k="Next appointment" v={t.next} />
              <Row k="Permission" v={t.permission} />
            </dl>
            <div className="flex flex-wrap gap-2 mt-4">
              <Action icon={<Eye className="w-3.5 h-3.5" />} label="View shared context" onClick={() => setActiveTab("sharing")} />
              <Action icon={<RefreshCw className="w-3.5 h-3.5" />} label="Update report" onClick={() => setActiveTab("reports")} />
              <Action icon={<CalendarPlus className="w-3.5 h-3.5" />} label="Request follow-up" onClick={() => setActiveTab("appointments")} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: "var(--arbor-muted)" }}>{k}</dt>
      <dd className="font-semibold text-right" style={{ color: "var(--arbor-ink)" }}>{v}</dd>
    </div>
  );
}
function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
      {icon} {label}
    </button>
  );
}
