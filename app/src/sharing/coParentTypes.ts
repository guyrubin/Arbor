/** Deliberately small projection of the existing child's ledgers. */
export interface CoParentActivity {
  id: string;
  text: string;
  do?: string;
  say?: string;
  practiceId?: string;
  selectedByUid?: string;
  acceptedAt: string;
  completedAt: string | null;
}
export interface CoParentActivityChoice { id: string; do: string; say: string; minutes: number }
export interface CoParentActivitySelection {
  activity: CoParentActivity | null;
  choices: CoParentActivityChoice[];
}
export interface CoParentWorkspace {
  childId: string;
  childName: string;
  ownerEmail: string | null;
  activity: CoParentActivity | null;
  moments: { id: string; text: string; at: string; addedByYou: boolean }[];
}
