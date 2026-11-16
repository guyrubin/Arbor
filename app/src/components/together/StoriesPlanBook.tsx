import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import TogetherBookPractices from "../program/TogetherBookPractices";
import { programSharedObjectOn } from "../../lib/programs/sharedObject";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";

/**
 * The running Challenge plan's book on Stories, read together in Kids Studio
 * (program flag). Scoped to one account and one child, as it was on Together:
 * nothing renders while hosted auth is unknown, and a new owner or child
 * remounts the shelf, so a chosen facet or an old tap never carries over.
 */
export default function StoriesPlanBook() {
  if (!programSharedObjectOn()) return null;
  return <ScopedPlanBook />;
}

function ScopedPlanBook() {
  const { childProfile } = useArbor();
  const { user, firebaseEnabled, loading } = useAuth();
  if (!childProfile.id || (firebaseEnabled && (loading || !user))) return null;
  const ownerId = firebaseEnabled ? user!.uid : "local-sandbox";
  return <PlanBookShelf key={JSON.stringify([ownerId, childProfile.id])} />;
}

function PlanBookShelf() {
  const { request, step } = useKidModeEntry();
  return (
    <>
      <TogetherBookPractices onOpen={(book) => request({ view: "library", book, together: true })} />
      {step}
    </>
  );
}
