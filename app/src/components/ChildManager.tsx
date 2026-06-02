import React, { useState } from "react";
import { Plus, Pencil, Check, X, ChevronDown } from "lucide-react";
import type { ChildProfile } from "../types";
import type { NewChildInput } from "../state/children";

/** Sidebar control: shows the active child, switches between children, adds/edits. */
export const ChildSwitcher: React.FC<{
  children: ChildProfile[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: () => void;
}> = ({ children, activeId, onSelect, onAdd, onEdit }) => {
  const [open, setOpen] = useState(false);
  const active = children.find((c) => c.id === activeId) ?? children[0];

  return (
    <div className="relative">
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#141821] p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-400">
            {active?.name?.slice(0, 2) || "Ch"}
          </div>
          <div>
            <h4 className="text-sm font-bold leading-tight text-white">{active?.name || "Add a child"}</h4>
            <p className="text-xs text-[#a8a093]">
              {active ? `Age ${active.age}${active.languages?.[0] ? ` · ${active.languages[0]}` : ""}` : "No child yet"}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-[#a8a093] transition ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit child"
          className="rounded-lg p-1.5 text-[#a8a093] hover:bg-white/10 hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => {
                onSelect(child.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-white/5 ${
                child.id === activeId ? "text-[#f4d991]" : "text-gray-200"
              }`}
            >
              <span>
                {child.name} <span className="text-[10px] text-[#a8a093]">· age {child.age}</span>
              </span>
              {child.id === activeId && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onAdd();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-white/10 px-4 py-2.5 text-left text-sm font-bold text-[#f4d991] hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> Add a child
          </button>
        </div>
      )}
    </div>
  );
};

/** Create/edit modal for a child profile. */
export const ChildOnboarding: React.FC<{
  open: boolean;
  initial?: ChildProfile | null;
  onSave: (input: NewChildInput) => void;
  onClose: () => void;
}> = ({ open, initial, onSave, onClose }) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [birth, setBirth] = useState("");
  const [age, setAge] = useState<string>(initial?.age != null ? String(initial.age) : "");
  const [languages, setLanguages] = useState((initial?.languages ?? []).join(", "));
  const [school, setSchool] = useState(initial?.schoolContext ?? "");

  // Re-seed when the target child changes.
  React.useEffect(() => {
    setName(initial?.name ?? "");
    setAge(initial?.age != null ? String(initial.age) : "");
    setLanguages((initial?.languages ?? []).join(", "));
    setSchool(initial?.schoolContext ?? "");
    setBirth("");
  }, [initial, open]);

  if (!open) return null;

  const canSave = name.trim().length > 0 && (birth.trim() !== "" || age.trim() !== "");

  const submit = () => {
    onSave({
      name,
      birthMonthYear: birth || undefined,
      age: birth ? undefined : age ? Number(age) : undefined,
      languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
      schoolContext: school
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#0d1117] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[#a8a093] hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-extrabold text-white">{initial ? "Edit child" : "Add a child"}</h2>
        <p className="mt-1 text-xs text-[#a8a093]">A little context helps Arbor give age-true, specific guidance.</p>

        <div className="mt-4 space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#a8a093]">Name or nickname</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Noa"
              className="w-full rounded-xl border border-white/10 bg-[#08090c] px-3 py-2 text-white focus:border-[#d7aa55]/40 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[#a8a093]">Birth month</span>
              <input
                type="month"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08090c] px-3 py-2 text-white focus:border-[#d7aa55]/40 focus:outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-[#a8a093]">…or age (years)</span>
              <input
                type="number"
                min={0}
                max={12}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="5"
                className="w-full rounded-xl border border-white/10 bg-[#08090c] px-3 py-2 text-white focus:border-[#d7aa55]/40 focus:outline-none"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#a8a093]">Languages at home</span>
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="e.g. Dutch, English"
              className="w-full rounded-xl border border-white/10 bg-[#08090c] px-3 py-2 text-white focus:border-[#d7aa55]/40 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-[#a8a093]">School or daycare (optional)</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. starting kindergarten in autumn"
              className="w-full rounded-xl border border-white/10 bg-[#08090c] px-3 py-2 text-white focus:border-[#d7aa55]/40 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-[#a8a093] hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="rounded-xl bg-[#d7aa55] px-4 py-2 text-sm font-extrabold text-black hover:bg-[#c39947] disabled:opacity-40"
          >
            {initial ? "Save" : "Add child"}
          </button>
        </div>
      </div>
    </div>
  );
};
