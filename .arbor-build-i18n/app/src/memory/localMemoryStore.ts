import { promises as fs } from "fs";
import path from "path";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

const MEMORY_LEDGER_PATH = path.join(process.cwd(), ".data", "memory-ledger.json");

export class LocalMemoryStore implements MemoryStore {
  async listEvents(childId?: string) {
    try {
      const raw = await fs.readFile(MEMORY_LEDGER_PATH, "utf8");
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
      const events = Array.isArray(parsed) ? (parsed as MemoryLedgerEvent[]) : [];
      return childId ? events.filter((event) => event.childId === childId) : events;
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async appendEvent(event: MemoryLedgerEvent) {
    const events = await this.listEvents();
    await fs.mkdir(path.dirname(MEMORY_LEDGER_PATH), { recursive: true });
    await fs.writeFile(MEMORY_LEDGER_PATH, JSON.stringify([...events, event], null, 2));
  }

  async eraseChild(childId: string) {
    const events = await this.listEvents();
    const kept = events.filter((event) => event.childId !== childId);
    const removed = events.length - kept.length;
    if (removed > 0) {
      await fs.mkdir(path.dirname(MEMORY_LEDGER_PATH), { recursive: true });
      await fs.writeFile(MEMORY_LEDGER_PATH, JSON.stringify(kept, null, 2));
    }
    return removed;
  }
}
