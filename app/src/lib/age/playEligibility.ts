/** The shared play library covers ages birth through twelve, in fractional years. */
export const isSupportedPlayAge = (years: number): boolean => Number.isFinite(years) && years >= 0 && years <= 12;
