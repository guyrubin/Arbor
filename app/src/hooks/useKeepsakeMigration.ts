import { useEffect, useRef } from "react";
import { migrateLocalKeepsakes, type KeepsakeDoc, type KeepsakeMap } from "../lib/firstsKeepsake";
import type { ChildCollection } from "./useChildCollection";

/**
 * v3 F-CHILD-1 — the one-time keepsake migration, for any surface that reads
 * the `keepsakes` subcollection.
 *
 * The legacy device-local map (`arbor.firstsKeepsakes.<childId>`) is moved
 * into the registered subcollection by `migrateLocalKeepsakes`. A device that
 * never opened the old Milestones page still holds that key, so the new
 * Milestones pill must run the move too, or those notes stay invisible there
 * and outside the GDPR export.
 *
 * The rules are MilestonesTab's (GP-31 / B-GROWTH-10), now in one place:
 *  · once per child per mount;
 *  · never in the first commit after a child switch, when the collection still
 *    holds the PREVIOUS child's documents (a stale "remote" map would make
 *    every local note look missing and write it under the wrong comparison);
 *  · never before the collection has loaded;
 *  · a failed write releases the claim, so the next load retries; the local
 *    key stays until every write landed, so no note is dropped.
 */

/** The migration's memory for one mount. Pure data, so it tests without React. */
export interface KeepsakeMigrationGate {
  /** The child the previous commit rendered for. */
  seen: string | null;
  /** The child whose migration ran (or is running) in this mount. */
  migratedFor: string | null;
}

export const newKeepsakeMigrationGate = (childId: string | null): KeepsakeMigrationGate => ({ seen: childId, migratedFor: null });

/** True when this commit may start the migration for `childId`; claims it if so. */
export function claimKeepsakeMigration(gate: KeepsakeMigrationGate, childId: string, loaded: boolean): boolean {
  const switched = gate.seen !== childId;
  gate.seen = childId;
  if (switched || !loaded || !childId || gate.migratedFor === childId) return false;
  gate.migratedFor = childId;
  return true;
}

/** A failed run gives the claim back, so the next load retries. A late
 *  failure for a child the page already left never clears the new child's claim. */
export function releaseKeepsakeMigration(gate: KeepsakeMigrationGate, childId: string): void {
  if (gate.migratedFor === childId) gate.migratedFor = null;
}

/**
 * One commit's turn: claims, migrates, releases on failure. Returns the
 * migration (how many keepsakes it wrote; 0 after a failure) or null when this
 * commit may not run it.
 */
export function runKeepsakeMigration(
  gate: KeepsakeMigrationGate,
  childId: string,
  loaded: boolean,
  remote: KeepsakeMap,
  upsert: (doc: KeepsakeDoc) => Promise<void>,
  storage?: Storage | null,
): Promise<number> | null {
  if (!claimKeepsakeMigration(gate, childId, loaded)) return null;
  return migrateLocalKeepsakes(childId, remote, upsert, storage).catch(() => {
    releaseKeepsakeMigration(gate, childId); // the local key stays; the next load retries
    return 0;
  });
}

/** Runs the migration for the child on screen, from the collection the page already holds. */
export function useKeepsakeMigration(
  childId: string,
  collection: Pick<ChildCollection<KeepsakeDoc>, "loaded" | "items" | "upsert">,
  remote: KeepsakeMap,
): void {
  const gate = useRef<KeepsakeMigrationGate>(newKeepsakeMigrationGate(childId));
  useEffect(() => {
    void runKeepsakeMigration(gate.current, childId, collection.loaded, remote, collection.upsert);
    // `items` is the re-run trigger: a load that lands after a failure retries.
  }, [childId, collection.loaded, collection.items, collection.upsert, remote]);
}
