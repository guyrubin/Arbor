import { MIMIC_PACKS, type MimicPack } from "./content";

type Translate = (key: string) => string;

/** Presentation-only copies: IDs, order, emoji and the English bank stay intact.
 * Use the same localized fields on cards, read-aloud, completion and stamps;
 * session records continue to use only the original pack/prompt IDs.
 */
export function localizedMimicPacks(t: Translate): MimicPack[] {
  return MIMIC_PACKS.map((pack) => ({
    ...pack,
    title: t(`elev.mimic.content.pack.${pack.id}.title`),
    blurb: t(`elev.mimic.content.pack.${pack.id}.blurb`),
    prompts: pack.prompts.map((prompt) => ({
      ...prompt,
      title: t(`elev.mimic.content.prompt.${prompt.id}.title`),
      instruction: t(`elev.mimic.content.prompt.${prompt.id}.instruction`),
      focus: t(`elev.mimic.content.prompt.${prompt.id}.focus`),
    })),
  }));
}
