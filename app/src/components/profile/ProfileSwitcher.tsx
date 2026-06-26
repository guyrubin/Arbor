import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Plus, Check, Pencil } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import AddChildModal from "./AddChildModal";
import ProfileEditDrawer from "./ProfileEditDrawer";
import { Avatar } from "../ui/Avatar";
import FamilyGlanceCard from "./FamilyGlanceCard";

export default function ProfileSwitcher() {
  const { profiles, activeChild, setActiveChild } = useProfile();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="relative">
      <div className="rounded-2xl p-3 flex items-center justify-between gap-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 flex-1 text-start group">
          <Avatar name={activeChild.name} photoURL={activeChild.photoUrl} size={36} ring />
          <div className="min-w-0">
            <h4 className="text-sm font-bold leading-tight truncate" style={{ color: "var(--arbor-ink)" }}>{activeChild.name}</h4>
            <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>Age {activeChild.age}</p>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--arbor-muted)" }} />
        </button>
        {/* VIS-2/VIS-3: icon-only → min 44×44 hit area + explicit aria-label */}
        <button
          onClick={() => setShowEdit(true)}
          title="Edit profile"
          aria-label="Edit child profile"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition"
          style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl p-1.5 bg-white"
              style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 12px 32px rgba(41,51,63,0.12)" }}
            >
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveChild(p.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-start transition"
                  style={{ background: p.id === activeChild.id ? "var(--arbor-paper-deep)" : "transparent" }}
                >
                  <Avatar name={p.name} photoURL={p.photoUrl} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold truncate block" style={{ color: "var(--arbor-ink)" }}>{p.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>Age {p.age}</span>
                  </div>
                  {p.id === activeChild.id && <Check className="w-4 h-4" style={{ color: "var(--arbor-clay)" }} />}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(false);
                  setShowAdd(true);
                }}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-start transition mt-1"
                style={{ color: "var(--arbor-green-ink)", borderTop: "1px solid var(--arbor-rule)" }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--arbor-green-soft)" }}>
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold">Add child</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* C3 — Family glance: shown below the switcher for 2+ child households.
          Reads only the existing DevScore snapshot per child — no new data. */}
      <FamilyGlanceCard />

      <AddChildModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ProfileEditDrawer open={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
