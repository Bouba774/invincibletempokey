import { useMemo } from "react";
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { Track } from "./library-store";
import { useLibraryStore } from "./library-store";
import { CAMELOT_CODES } from "./library-filters";

/**
 * Single source of truth for the *order* in which tracks are presented across
 * the whole app (library, analysis lists, rename, etc.).
 *
 * - "computed" sources (bpm-asc, camelot, …) are evaluated lazily from the
 *   library; they survive analysis updates because they're recomputed.
 * - "explicit" sources (auto-mix, harmonic-*, setbuilder-*, manual) carry an
 *   ordered list of track IDs. Tracks no longer in the library are dropped;
 *   newly imported tracks are appended at the end so nothing is lost.
 */

export type OrderSource =
  | "import"
  | "bpm-asc"
  | "bpm-desc"
  | "camelot"
  | "duration"
  | "title"
  | "energy"
  | "auto-mix"
  | "harmonic-progressive"
  | "harmonic-energy"
  | "harmonic-smooth"
  | "harmonic-cold-hot"
  | "harmonic-hot-cold"
  | "setbuilder-warmup"
  | "setbuilder-peak"
  | "setbuilder-closing"
  | "manual";

export interface ActiveOrder {
  source: OrderSource;
  label: string;
  /** Explicit track-id ordering for non-computed sources. */
  ids: string[] | null;
  /** Library this ordering belongs to. */
  libraryId: string;
  updatedAt: number;
}

export const DEFAULT_ORDER_LABEL: Record<OrderSource, string> = {
  import: "Ordre d'import",
  "bpm-asc": "BPM croissant",
  "bpm-desc": "BPM décroissant",
  camelot: "Camelot",
  duration: "Durée",
  title: "Titre",
  energy: "Énergie",
  "auto-mix": "Auto Mix Order",
  "harmonic-progressive": "Progressive Mix",
  "harmonic-energy": "Energy Build",
  "harmonic-smooth": "Smooth Transition",
  "harmonic-cold-hot": "Cold → Hot",
  "harmonic-hot-cold": "Hot → Cold",
  "setbuilder-warmup": "Set · Warm-up",
  "setbuilder-peak": "Set · Peak Time",
  "setbuilder-closing": "Set · Closing",
  manual: "Manuel",
};

const IDB_KEY = "tempokey:active-order";
const CAMELOT_ORDER = new Map<string, number>(
  CAMELOT_CODES.map((c, i) => [c, i]),
);

function importIndex(tracks: Track[]): Map<string, number> {
  const m = new Map<string, number>();
  tracks.forEach((t, i) => m.set(t.id, i));
  return m;
}

function energyScoreLocal(t: Track): number {
  const bpm = t.bpm ?? 0;
  const bpmPart = Math.max(0, Math.min(1, (bpm - 80) / 60));
  const letter = t.camelot?.toUpperCase().slice(-1);
  const boost = letter === "B" ? 0.1 : letter === "A" ? -0.05 : 0;
  return bpmPart * 0.9 + boost + 0.05;
}

/**
 * Compute the ordered list of tracks for the active order. Always returns
 * every library track exactly once. Unknown / unanalyzed tracks fall back to
 * their import position so the list never silently shrinks.
 */
export function orderTracks(tracks: Track[], order: ActiveOrder | null): Track[] {
  if (!order || order.source === "import") {
    return tracks.slice();
  }

  const importIdx = importIndex(tracks);

  if (order.ids && order.ids.length > 0) {
    const present = new Set(tracks.map((t) => t.id));
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const out: Track[] = [];
    const used = new Set<string>();
    for (const id of order.ids) {
      if (present.has(id) && !used.has(id)) {
        out.push(byId.get(id)!);
        used.add(id);
      }
    }
    // Append unseen tracks (newly imported, or unanalyzed for harmonic orders).
    const tail = tracks
      .filter((t) => !used.has(t.id))
      .sort((a, b) => (importIdx.get(a.id) ?? 0) - (importIdx.get(b.id) ?? 0));
    return out.concat(tail);
  }

  const arr = tracks.slice();
  switch (order.source) {
    case "bpm-asc":
      arr.sort((a, b) => (a.bpm ?? Infinity) - (b.bpm ?? Infinity));
      break;
    case "bpm-desc":
      arr.sort((a, b) => (b.bpm ?? -Infinity) - (a.bpm ?? -Infinity));
      break;
    case "camelot":
      arr.sort((a, b) => {
        const ai = a.camelot ? CAMELOT_ORDER.get(a.camelot.toUpperCase()) ?? 999 : 999;
        const bi = b.camelot ? CAMELOT_ORDER.get(b.camelot.toUpperCase()) ?? 999 : 999;
        return ai - bi;
      });
      break;
    case "duration":
      arr.sort((a, b) => (a.durationSec ?? Infinity) - (b.durationSec ?? Infinity));
      break;
    case "title":
      arr.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "energy":
      arr.sort((a, b) => energyScoreLocal(b) - energyScoreLocal(a));
      break;
  }
  return arr;
}

interface OrderingState {
  active: ActiveOrder | null;
  hydrated: boolean;
  hydrate: (libraryId: string) => Promise<void>;
  setOrder: (source: OrderSource, opts?: { ids?: string[]; label?: string }) => void;
  /** Promote the current ordering to manual using the supplied final id list. */
  setManual: (ids: string[]) => void;
  reset: () => void;
}

async function persist(order: ActiveOrder | null): Promise<void> {
  try {
    const all = ((await idbGet(IDB_KEY)) as Record<string, ActiveOrder> | undefined) ?? {};
    if (order) all[order.libraryId] = order;
    await idbSet(IDB_KEY, all);
  } catch (e) {
    console.warn("[tempokey] ordering persist failed", e);
  }
}

export const useOrderingStore = create<OrderingState>((set, get) => ({
  active: null,
  hydrated: false,

  hydrate: async (libraryId) => {
    try {
      const all = ((await idbGet(IDB_KEY)) as Record<string, ActiveOrder> | undefined) ?? {};
      const found = all[libraryId] ?? null;
      set({
        active:
          found ??
          {
            source: "import",
            label: DEFAULT_ORDER_LABEL.import,
            ids: null,
            libraryId,
            updatedAt: Date.now(),
          },
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setOrder: (source, opts) => {
    const libraryId = useLibraryStore.getState().library?.id;
    if (!libraryId) return;
    const next: ActiveOrder = {
      source,
      label: opts?.label ?? DEFAULT_ORDER_LABEL[source],
      ids: opts?.ids ?? null,
      libraryId,
      updatedAt: Date.now(),
    };
    set({ active: next });
    void persist(next);
  },

  setManual: (ids) => {
    const libraryId = useLibraryStore.getState().library?.id;
    if (!libraryId) return;
    const next: ActiveOrder = {
      source: "manual",
      label: DEFAULT_ORDER_LABEL.manual,
      ids: ids.slice(),
      libraryId,
      updatedAt: Date.now(),
    };
    set({ active: next });
    void persist(next);
  },

  reset: () => {
    const libraryId = useLibraryStore.getState().library?.id;
    if (!libraryId) return;
    const next: ActiveOrder = {
      source: "import",
      label: DEFAULT_ORDER_LABEL.import,
      ids: null,
      libraryId,
      updatedAt: Date.now(),
    };
    set({ active: next });
    void persist(next);
  },
}));

/** Convenience hook returning library tracks in active order. */
export function useOrderedTracks(): Track[] {
  const library = useLibraryStore((s) => s.library);
  const active = useOrderingStore((s) => s.active);
  return useMemo(
    () => (library ? orderTracks(library.tracks, active) : []),
    [library, active],
  );
}
