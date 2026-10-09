/** B-GAME-20: the game being released is not approval to share a child's
 * picture. Counsel's specific production gate remains closed. No device
 * flag or browser storage value can turn it on in a production build. */
export function statueShareAllowed(developmentBuild: boolean): boolean {
  return developmentBuild === true;
}
