import { afterEach, describe, expect, it, vi } from "vitest";
import { clearVisitReceipt, currentVisitReceipt, showVisitReceipt, subscribeVisitReceipt } from "./visitReceipt";

describe("B-STATUS-01 · the visit receipt", () => {
  afterEach(() => clearVisitReceipt());

  it("one line replaces the last, and a blank answer says nothing", () => {
    const heard = vi.fn();
    const stop = subscribeVisitReceipt(heard);
    showVisitReceipt("  ");
    expect(currentVisitReceipt()).toBeNull();
    expect(heard).not.toHaveBeenCalled();
    showVisitReceipt(" Saved your changes. ");
    expect(currentVisitReceipt()).toEqual({ text: "Saved your changes.", seq: 1 });
    showVisitReceipt("Kept, with the day you gave it.");
    expect(currentVisitReceipt()?.text).toBe("Kept, with the day you gave it.");
    expect(currentVisitReceipt()?.seq).toBe(2);
    expect(heard).toHaveBeenCalledTimes(2);
    clearVisitReceipt();
    clearVisitReceipt();
    expect(heard).toHaveBeenCalledTimes(3);
    expect(currentVisitReceipt()).toBeNull();
    stop();
    showVisitReceipt("later");
    expect(heard).toHaveBeenCalledTimes(3);
  });
});
