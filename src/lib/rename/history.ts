import { createStore, get as idbGet, set as idbSet } from "idb-keyval";

export interface RenameChange {
  trackId: string;
  oldPath: string;
  newPath: string;
  oldName: string;
  newName: string;
}

export interface RenameOperation {
  id: string;
  libraryId: string;
  libraryName: string;
  template: string;
  at: number;
  changes: RenameChange[];
  undone?: boolean;
}

const store = createStore("tempokey-rename", "history");
const KEY = "operations";

export async function loadHistory(): Promise<RenameOperation[]> {
  try {
    const list = (await idbGet(KEY, store)) as RenameOperation[] | undefined;
    return list ?? [];
  } catch {
    return [];
  }
}

export async function saveHistory(ops: RenameOperation[]): Promise<void> {
  try {
    // Cap at 50 ops to keep storage bounded.
    const trimmed = ops.slice(0, 50);
    await idbSet(KEY, trimmed, store);
  } catch {
    /* ignore */
  }
}

export async function pushOperation(op: RenameOperation): Promise<RenameOperation[]> {
  const list = await loadHistory();
  const next = [op, ...list];
  await saveHistory(next);
  return next;
}

export async function markUndone(opId: string): Promise<RenameOperation[]> {
  const list = await loadHistory();
  const next = list.map((o) => (o.id === opId ? { ...o, undone: true } : o));
  await saveHistory(next);
  return next;
}