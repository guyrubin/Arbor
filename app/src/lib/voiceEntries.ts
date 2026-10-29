/**
 * B-VOICE-04 — every place the app opens the microphone, and the review the
 * parent passes before anything said there is kept.
 *
 * Pure registry, read by voiceEntries.guard.test.ts, which scans the source
 * for every microphone opening (dictation, the hands-free loop, Live, a raw
 * audio stream) and fails when one is not listed here, when a listed review
 * no longer shows in its source, or when a voice path writes a record before
 * the parent's Confirm. The contract (P8-VOICE B-VOICE-04): no voice-originated
 * write without an explicit confirm, edit or discard; "Don't keep" leaves
 * nothing behind. It is not a second review surface: each entry names the
 * existing one it folds into.
 *
 * Reviews:
 *  - close-card: Talk's voice session ends in VoiceCloseCard — the drafts in
 *    ConversationProposalTray (Keep · edit · Don't keep) and the session's one
 *    next step, kept as today's step only on the parent's tap.
 *  - capture-confirm: the capture sheet — dictation fills the ONE moment field
 *    the parent reads and edits; Save keeps it, and a drafted entry goes
 *    through ConfirmCaptureReview.
 *  - describe-readback: "Tell Arbor" — nothing is kept before "Keep these"
 *    (DescribeReadback).
 *  - draft-field: dictation lands in the composer's draft; the parent sends
 *    it into the conversation or keeps it with the explicit Keep tile.
 *  - kid-practice: kid mode — the child's own practice try, behind the voice
 *    consent gate; it proposes no record about the child to the parent.
 */

export type VoiceReview = "close-card" | "capture-confirm" | "describe-readback" | "draft-field" | "kid-practice";

export interface VoiceEntry {
  review: VoiceReview;
  /** Source that must still carry the review: file (relative to src/) → strings it contains. */
  evidence: Readonly<Record<string, readonly string[]>>;
  why: string;
}

/** Every source file (relative to src/) that opens the microphone. */
export const VOICE_ENTRIES: Readonly<Record<string, VoiceEntry>> = {
  "components/tabs/CoachTab.tsx": {
    review: "close-card",
    evidence: {
      "components/tabs/CoachTab.tsx": ["<VoiceCloseCard", "<ConversationProposalTray", "onConfirm={async (proposal)", "onKeepNextStep={() => void keepVoiceNextStep()}"],
      "components/coach/VoiceCloseCard.tsx": ["copy.discard", "copy.keepNext"],
    },
    why: "Talk by voice (the hands-free loop and Live): drafts and the next step wait in the closing review",
  },
  "components/overview/QuickLogModal.tsx": {
    review: "capture-confirm",
    evidence: {
      "components/overview/QuickLogModal.tsx": ["setNewLogTrigger(said)", "ConfirmCaptureReview"],
    },
    why: "Note something by voice: the words land in the moment field; Save or the capture review keeps them",
  },
  "components/describe/DescribeChild.tsx": {
    review: "describe-readback",
    evidence: {
      "components/describe/TellArborMore.tsx": ["<DescribeReadback"],
      "components/auth/OnboardingFlow.tsx": ["DescribeReadback"],
    },
    why: "Tell Arbor by voice (My child, onboarding): the answer is a draft until \"Keep these\"",
  },
  "components/companion/CompanionComposer.tsx": {
    review: "draft-field",
    evidence: {
      "components/companion/CompanionComposer.tsx": ["onChange([textRef.current.trim(), text.trim()].filter(Boolean).join(\" \"))"],
    },
    why: "Dictate into Talk's composer: the words are the draft the parent sends or keeps",
  },
  "components/practice/SpeechCoachTab.tsx": {
    review: "kid-practice",
    evidence: {
      "components/practice/SpeechCoachTab.tsx": ["from \"./speechConsentGate\""],
    },
    why: "kid mode sound practice: the child's own try, behind the voice consent gate; no parent record is proposed",
  },
};

/** The library files that implement a microphone opening for the entries above. */
export const VOICE_IMPLEMENTATIONS: readonly string[] = ["lib/speech.ts", "lib/dictationLoop.ts", "lib/geminiLiveClient.ts"];
