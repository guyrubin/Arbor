/** Choice helpers for Add Child / Edit Child parity.
 * Stored strings are left untouched until the parent explicitly changes a
 * choice. Unknown/custom values always survive a toggle. */
export type ProfileChoiceDelimiter = "\n" | ",";

const tokens = (value: string, delimiter: ProfileChoiceDelimiter) =>
  value.split(delimiter).map(item => item.trim()).filter(Boolean);

export function choiceSelected(value: string, aliases: readonly string[], delimiter: ProfileChoiceDelimiter): boolean {
  const recognized = new Set(aliases.map(alias => alias.trim()).filter(Boolean));
  return tokens(value, delimiter).some(value => recognized.has(value));
}

export function toggleDelimitedChoice(
  value: string,
  aliases: readonly string[],
  selectedValue: string,
  delimiter: ProfileChoiceDelimiter,
): string {
  const items = tokens(value, delimiter);
  const recognized = new Set(aliases.map(alias => alias.trim()).filter(Boolean));
  const selected = items.some(item => recognized.has(item));
  const next = selected ? items.filter(item => !recognized.has(item)) : [...items, selectedValue.trim()];
  return next.join(delimiter === "," ? ", " : "\n");
}
