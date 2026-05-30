import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Plus, Check, Pencil } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import AddChildModal from "./AddChildModal";
import ProfileEditDrawer from "./ProfileEditDrawer";

export default function ProfileSwitcher() {
  const { profiles, activeChild, setActiveChild } = useProfile();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="relative">
      <div className="bg-[#141821] border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 flex-1 text-left group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-[#f4d991] bg-[#d7aa55]/10 ring-2 ring-[#d7aa55]/40">
            {activeChild.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white leading-tight truncate">{activeChild.name}</h4>
            <p className="text-[11px] text-[#a8a093]">Age {activeChild.age}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#a8a093] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setShowEdit(true)}
          title="Edit profile"
          className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-[#a8a093] hover:text-[#f4d991] transition"
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
              className="absolute left-0 right-0 top-full mt-2 z-20 bg-[#0c0e14] border border-white/10 rounded-2xl p-1.5 shadow-2xl"
            >
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveChild(p.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition ${
                    p.id === activeChild.id ? "bg-white/5" : "hover:bg-white/5"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-[#f4d991] bg-[#d7aa55]/10">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-bold truncate block">{p.name}</span>
                    <span className="text-[10px] text-[#a8a093]">Age {p.age}</span>
                  </div>
                  {p.id === activeChild.id && <Check className="w-4 h-4 text-[#d7aa55]" />}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(false);
                  setShowAdd(true);
                }}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-[#f4d991] hover:bg-[#d7aa55]/10 transition mt-1 border-t border-white/5"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#d7aa55]/10">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold">Add child</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddChildModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ProfileEditDrawer open={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
