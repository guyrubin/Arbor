/**
 * B-PROG-01 — the ONE program context line shared by todays_focus,
 * coach_chat, voice_reply and live_session ("Active program: {name}, week
 * {n}: {skill}"). "" without an active program, so a family with no program
 * gets the pre-B-PROG-01 bytes (parity pinned in prompts.test.ts). The name
 * and skill are Arbor's own program content (content/programs), never text
 * the parent typed and never a read of the child.
 */
export type ActiveProgramLine = { name: string; week: number; skill: string };

const clean = (value: string, cap: number): string => value.replace(/\s+/g, " ").trim().slice(0, cap);

export const renderActiveProgramLine = (program?: ActiveProgramLine | null): string => {
  if (!program || !Number.isFinite(program.week)) return "";
  const name = clean(program.name, 80);
  const skill = clean(program.skill, 300);
  if (!name || !skill) return "";
  return `Active program: ${name}, week ${Math.max(1, Math.floor(program.week))}: ${skill}\n`;
};
