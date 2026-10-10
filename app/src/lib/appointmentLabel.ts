import { isAppointmentProfession, type Appointment, type AppointmentProfession } from "./careTrack";

export const PROFESSION_KEY: Record<AppointmentProfession, string> = {
  pediatrician: "elev.careNet.appt.profession.pediatrician",
  slp: "elev.careNet.appt.profession.slp",
  ot: "elev.careNet.appt.profession.ot",
  pt: "elev.careNet.appt.profession.pt",
  psychologist: "elev.careNet.appt.profession.psychologist",
  teacher: "elev.careNet.appt.profession.teacher",
  other: "elev.careNet.appt.profession.other",
};

/** What a row says the visit is with: the profession when one is stored; a
 *  legacy row's typed role as written; the old English default ("Professional")
 *  and an empty role read the keyed word instead. */
export function appointmentRoleLabel(a: Pick<Appointment, "role" | "profession">, t: (key: string) => string): string {
  if (a.profession && isAppointmentProfession(a.profession)) return t(PROFESSION_KEY[a.profession]);
  const role = (a.role ?? "").trim();
  return role && role.toLowerCase() !== "professional" ? role : t("elev.careNet.appt.professional");
}
