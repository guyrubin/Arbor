import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Trash2, Camera, Sparkles, Check, Plus } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { exportChildData, downloadJson } from "../../lib/childData";
import { ChildProfile } from "../../types";
import { Avatar } from "../ui/Avatar";
import { fileToThumbnail } from "../../lib/image";
import { uploadChildPhoto } from "../../lib/storage";
import AvatarCreator from "./AvatarCreator";
import RewardsCard from "./RewardsCard";

// CI-29: The 12 curated interest suggestion keys (i18n-resolved at render).
// Banned clinical/behavioral strings are never in this list (FIX 1 compliance).
const INTEREST_SUGGESTION_KEYS = [
  "interest.trains",
  "interest.dinosaurs",
  "interest.animals",
  "interest.trucks",
  "interest.superheroes",
  "interest.princesses",
  "interest.cooking",
  "interest.music",
  "interest.water",
  "interest.space",
  "interest.building",
  "interest.nature",
] as const;

export default function ProfileEditDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeChild, updateChild, deleteChild, profiles } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(activeChild.name);
  const [age, setAge] = useState(activeChild.age);
  const [schoolContext, setSchoolContext] = useState(activeChild.schoolContext);
  const [languages, setLanguages] = useState(activeChild.languages.join(", "));
  const [strengths, setStrengths] = useState(activeChild.strengths.join("\n"));
  const [challenges, setChallenges] = useState(activeChild.challenges.join("\n"));
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(activeChild.photoUrl);
  const [avatarMeta, setAvatarMeta] = useState<ChildProfile["avatar"]>(activeChild.avatar);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [saving, setSaving] = useState(false);

  // CI-29: Interests state — suggestion toggles + custom additions.
  // Resolved suggestion labels (EN/HE) mapped from their i18n keys.
  const suggestionLabels = INTEREST_SUGGESTION_KEYS.map((k) => t(k));
  const [activeInterests, setActiveInterests] = useState<string[]>(activeChild.interests ?? []);
  const [interestInput, setInterestInput] = useState("");

  const onPickPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const thumb = await fileToThumbnail(file, 256, 0.85);
      let url = thumb;
      if (user?.uid && user.uid !== "local-sandbox") {
        try { url = await uploadChildPhoto(user.uid, activeChild.id, thumb); } catch { /* keep inline data URL */ }
      }
      setPhotoUrl(url);
      setAvatarMeta(undefined); // a raw uploaded photo isn't a generated avatar
    } catch {
      toast("Couldn't process that image", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  // Escape closes the drawer (keyboard parity with the backdrop click).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Re-sync the form whenever the drawer opens or the active child changes.
  useEffect(() => {
    if (!open) return;
    setName(activeChild.name);
    setAge(activeChild.age);
    setSchoolContext(activeChild.schoolContext);
    setLanguages(activeChild.languages.join(", "));
    setStrengths(activeChild.strengths.join("\n"));
    setChallenges(activeChild.challenges.join("\n"));
    setPhotoUrl(activeChild.photoUrl);
    setAvatarMeta(activeChild.avatar);
    // CI-29: restore saved interests on re-open.
    setActiveInterests(activeChild.interests ?? []);
    setInterestInput("");
  }, [open, activeChild]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await exportChildData(user?.uid, activeChild);
      downloadJson(`arbor-${activeChild.name.toLowerCase().replace(/\s+/g, "-")}-export.json`, data);
      toast("Data exported", "success");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (profiles.length <= 1) {
      toast("Can't delete your only child profile", "error");
      return;
    }
    if (!window.confirm(`Permanently delete ${activeChild.name} and ALL of their data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteChild(activeChild.id);
      toast(`${activeChild.name}'s data was deleted`, "success");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // CI-29: Toggle a suggestion chip on/off.
  const toggleSuggestion = (label: string) => {
    setActiveInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  // CI-29: Add a custom free-text interest (trim, dedup, max 40 chars).
  const addCustomInterest = () => {
    const trimmed = interestInput.trim().slice(0, 40);
    if (!trimmed || activeInterests.includes(trimmed)) { setInterestInput(""); return; }
    setActiveInterests((prev) => [...prev, trimmed]);
    setInterestInput("");
  };

  // CI-29: Remove a custom (non-suggestion) interest chip.
  const removeInterest = (label: string) => {
    setActiveInterests((prev) => prev.filter((i) => i !== label));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateChild(activeChild.id, {
        name: name.trim() || activeChild.name,
        age,
        schoolContext,
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
        strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
        challenges: challenges.split("\n").map((s) => s.trim()).filter(Boolean),
        // Firewall: riskLevel is no longer parent-authored (a verdict field has no
        // place in the parent-facing editor); preserve any stored value untouched.
        riskLevel: activeChild.riskLevel,
        photoUrl: photoUrl || "",
        ...(avatarMeta ? { avatar: avatarMeta } : {}),
        // CI-29: persist interests[] + ISO timestamp (parent-written only, COPPA-gated).
        interests: activeInterests,
        interestsUpdatedAt: new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="arbor-app fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(41,51,63,0.4)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("aria.editChildProfile")}
            className="w-full max-w-md h-full bg-white p-6 overflow-y-auto"
            style={{ borderLeft: "1px solid var(--arbor-rule)" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Edit profile</h3>
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg transition" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }} aria-label={t("aria.close")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <Avatar name={name} photoURL={photoUrl} size={56} ring />
                <div className="flex flex-col items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCreator(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition"
                    style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-primary-border)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> {photoUrl ? "New avatar" : "Create avatar"}
                  </button>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer" style={{ color: "var(--arbor-muted)" }}>
                      <Camera className="w-3 h-3" /> {photoBusy ? "Uploading…" : "Upload a photo instead"}
                      <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => onPickPhoto(e.target.files?.[0])} />
                    </label>
                    {photoUrl && (
                      <button type="button" onClick={() => { setPhotoUrl(undefined); setAvatarMeta(undefined); }} className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl px-4 py-2.5 focus:outline-none" style={inputStyle} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Age: <span style={{ color: "var(--arbor-green-ink)" }}>{age}</span></label>
                <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-primary)" }} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>School context</label>
                <input value={schoolContext} onChange={(e) => setSchoolContext(e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={inputStyle} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Languages <span style={{ color: "var(--arbor-muted)", opacity: 0.7 }}>(comma separated)</span></label>
                <input value={languages} onChange={(e) => setLanguages(e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={inputStyle} />
              </div>

              {/* CI-29: Interests section — parent-entered only, never child-facing.
                  Preference record only; never interpreted as a clinical/behavioral signal.
                  Banned: restricted/repetitive/fixation/perseveration/hyperfocus (FIX 1). */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>
                  {t("profile.interests.label", { name: name.trim() || activeChild.name })}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>
                  {t("profile.interests.helper", { name: name.trim() || activeChild.name })}
                </p>
                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label={t("aria.interests")}>
                  {suggestionLabels.map((label) => {
                    const isActive = activeInterests.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleSuggestion(label)}
                        aria-pressed={isActive}
                        aria-label={isActive ? `${label}, selected` : `${label}, not selected`}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition"
                        style={isActive
                          ? { background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-primary-border)", color: "var(--arbor-green-ink)" }
                          : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-muted)" }}
                      >
                        {isActive && <Check className="w-3 h-3" />}
                        {label}
                      </button>
                    );
                  })}
                  {/* Custom chips (non-suggestion) with X dismiss */}
                  {activeInterests
                    .filter((i) => !suggestionLabels.includes(i))
                    .map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold"
                        style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-primary-border)", color: "var(--arbor-green-ink)" }}
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => removeInterest(label)}
                          aria-label={`Remove ${label}`}
                          className="ms-0.5 inline-flex items-center justify-center rounded-full -my-3 -me-3 p-3 transition"
                          style={{ color: "var(--arbor-green-ink)" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
                {/* Free-text add row */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value.slice(0, 40))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest(); } }}
                    placeholder={t("profile.interests.addPlaceholder")}
                    aria-label={t("aria.addCustomInterest")}
                    maxLength={40}
                    className="flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={addCustomInterest}
                    aria-label={t("aria.addInterest")}
                    className="inline-flex items-center gap-1 px-3 min-h-[44px] rounded-lg text-xs font-bold transition"
                    style={{ color: "var(--arbor-green-ink)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("profile.interests.addBtn")}
                  </button>
                </div>
                {/* Last-updated line (Flow 3: returning parent) */}
                {activeChild.interestsUpdatedAt && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--arbor-faint)" }}>
                    {t("profile.interests.updated", {
                      when: new Date(activeChild.interestsUpdatedAt).toLocaleDateString(),
                    })}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Strengths <span style={{ color: "var(--arbor-muted)", opacity: 0.7 }}>(one per line)</span></label>
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={inputStyle} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Challenges <span style={{ color: "var(--arbor-muted)", opacity: 0.7 }}>(one per line)</span></label>
                <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={inputStyle} />
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full mt-2 py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: "var(--arbor-gradient-primary)" }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              {/* A5: earned-through-play rewards */}
              <RewardsCard childId={activeChild.id} name={name || activeChild.name} />

              {/* Data & privacy (GDPR) */}
              <div className="pt-4 mt-2 space-y-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>Data & privacy</span>
                <button onClick={handleExport} disabled={busy} className="w-full py-2.5 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
                  <Download className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} /> Export {activeChild.name}&apos;s data (JSON)
                </button>
                <button onClick={handleDelete} disabled={busy} className="w-full py-2.5 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete this child & all data
                </button>
              </div>
            </div>
          </motion.div>
          <AvatarCreator
            open={showCreator}
            childId={activeChild.id}
            childName={name || activeChild.name}
            onClose={() => setShowCreator(false)}
            onCreated={({ dataUrl, style, source }) => {
              setPhotoUrl(dataUrl);
              setAvatarMeta({ style, source, createdAt: new Date().toISOString() });
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
