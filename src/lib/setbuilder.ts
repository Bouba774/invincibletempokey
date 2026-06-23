import type { Track } from "./library-store";
import {
  parseCamelot,
  camelotDistance,
  energyScore,
} from "./harmonic";

export type SetType = "auto" | "warmup" | "peak" | "closing";

export interface SetMeta {
  type: SetType;
  label: string;
  description: string;
}

export const SET_PRESETS: Record<SetType, SetMeta> = {
  auto: {
    type: "auto",
    label: "Auto Mix Order",
    description: "Progression harmonique et énergétique optimale",
  },
  warmup: {
    type: "warmup",
    label: "Warm-up",
    description: "Énergie basse, 100 → 120 BPM, transitions douces",
  },
  peak: {
    type: "peak",
    label: "Peak Time",
    description: "Énergie max, 120 → 135+ BPM, transitions dynamiques",
  },
  closing: {
    type: "closing",
    label: "Closing",
    description: "Redescente progressive, fin douce",
  },
};

interface BuildOptions {
  /** Restrict source pool to these track IDs (optional). */
  trackIds?: Set<string>;
}

function eligible(t: Track): boolean {
  return !!(t.analyzed && t.bpm && t.camelot);
}

function filterPool(library: Track[], opts: BuildOptions): Track[] {
  let pool = library.filter(eligible);
  if (opts.trackIds && opts.trackIds.size > 0) {
    pool = pool.filter((t) => opts.trackIds!.has(t.id));
  }
  return pool;
}

/** Transition cost between two analyzed tracks (lower = better). */
function transitionCost(
  a: Track,
  b: Track,
  opts: { bpmTarget?: "up" | "down" | "flat"; energyTarget?: "up" | "down" | "flat" } = {},
): number {
  const ca = parseCamelot(a.camelot);
  const cb = parseCamelot(b.camelot);
  const camelot = ca && cb ? camelotDistance(ca, cb) : 4;

  const bpmA = a.bpm ?? 0;
  const bpmB = b.bpm ?? 0;
  const bpmDiff = bpmA ? (bpmB - bpmA) / bpmA : 0; // signed
  const absDiffPct = Math.abs(bpmDiff) * 100;

  // Penalize hard BPM jumps
  let bpmPenalty = absDiffPct * 0.6;
  if (absDiffPct > 6) bpmPenalty += (absDiffPct - 6) * 2;

  // Direction preference
  if (opts.bpmTarget === "up" && bpmDiff < 0) bpmPenalty += 6;
  if (opts.bpmTarget === "down" && bpmDiff > 0) bpmPenalty += 6;

  const dE = energyScore(b) - energyScore(a);
  let energyPenalty = 0;
  if (opts.energyTarget === "up" && dE < 0) energyPenalty += 8;
  if (opts.energyTarget === "down" && dE > 0) energyPenalty += 8;
  if (opts.energyTarget === "flat") energyPenalty += Math.abs(dE) * 10;

  return camelot * 5 + bpmPenalty + energyPenalty;
}

interface OrderOptions {
  bpmTarget?: "up" | "down" | "flat";
  energyTarget?: "up" | "down" | "flat";
  /** Force first track (after sorting candidates). */
  startPicker?: (pool: Track[]) => Track | null;
}

/** Greedy nearest-neighbor ordering minimizing per-step transition cost. */
function greedyOrder(pool: Track[], opts: OrderOptions = {}): Track[] {
  if (pool.length <= 1) return [...pool];
  const remaining = new Set(pool.map((t) => t.id));
  const byId = new Map(pool.map((t) => [t.id, t]));

  const start =
    opts.startPicker?.(pool) ??
    [...pool].sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))[0];
  const order: Track[] = [start];
  remaining.delete(start.id);

  while (remaining.size > 0) {
    const last = order[order.length - 1];
    let best: Track | null = null;
    let bestCost = Infinity;
    for (const id of remaining) {
      const t = byId.get(id)!;
      const c = transitionCost(last, t, opts);
      if (c < bestCost) {
        bestCost = c;
        best = t;
      }
    }
    if (!best) break;
    order.push(best);
    remaining.delete(best.id);
  }
  return order;
}

// Cache --------------------------------------------------------------

interface CacheEntry {
  v: number;
  result: Track[];
}
const cache = new Map<string, CacheEntry>();
let cacheVersion = 0;

export function invalidateSetCache(): void {
  cacheVersion++;
  cache.clear();
}

function cacheKey(type: SetType, ids: string[]): string {
  return `${type}:${ids.length}:${ids.slice(0, 8).join(",")}`;
}

// Public builders ----------------------------------------------------

export function buildAutoMixOrder(
  library: Track[],
  opts: BuildOptions = {},
): Track[] {
  const pool = filterPool(library, opts);
  const key = cacheKey("auto", pool.map((t) => t.id));
  const c = cache.get(key);
  if (c && c.v === cacheVersion) return c.result;
  const result = greedyOrder(pool, { bpmTarget: "up", energyTarget: "up" });
  cache.set(key, { v: cacheVersion, result });
  return result;
}

export function buildWarmupSet(
  library: Track[],
  opts: BuildOptions = {},
): Track[] {
  const pool = filterPool(library, opts).filter(
    (t) => (t.bpm ?? 0) >= 95 && (t.bpm ?? 0) <= 122 && energyScore(t) < 0.6,
  );
  const key = cacheKey("warmup", pool.map((t) => t.id));
  const c = cache.get(key);
  if (c && c.v === cacheVersion) return c.result;
  const result = greedyOrder(pool, {
    bpmTarget: "up",
    energyTarget: "up",
    startPicker: (p) => [...p].sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))[0] ?? null,
  });
  cache.set(key, { v: cacheVersion, result });
  return result;
}

export function buildPeakSet(
  library: Track[],
  opts: BuildOptions = {},
): Track[] {
  const pool = filterPool(library, opts).filter(
    (t) => (t.bpm ?? 0) >= 120 && energyScore(t) >= 0.5,
  );
  const key = cacheKey("peak", pool.map((t) => t.id));
  const c = cache.get(key);
  if (c && c.v === cacheVersion) return c.result;
  const result = greedyOrder(pool, {
    bpmTarget: "up",
    energyTarget: "up",
    startPicker: (p) =>
      [...p].sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0))[0] ?? null,
  });
  cache.set(key, { v: cacheVersion, result });
  return result;
}

export function buildClosingSet(
  library: Track[],
  opts: BuildOptions = {},
): Track[] {
  const pool = filterPool(library, opts).filter((t) => (t.bpm ?? 0) <= 128);
  const key = cacheKey("closing", pool.map((t) => t.id));
  const c = cache.get(key);
  if (c && c.v === cacheVersion) return c.result;
  const result = greedyOrder(pool, {
    bpmTarget: "down",
    energyTarget: "down",
    startPicker: (p) => [...p].sort((a, b) => (b.bpm ?? 0) - (a.bpm ?? 0))[0] ?? null,
  });
  cache.set(key, { v: cacheVersion, result });
  return result;
}

export function buildSet(
  type: SetType,
  library: Track[],
  opts: BuildOptions = {},
): Track[] {
  switch (type) {
    case "warmup":
      return buildWarmupSet(library, opts);
    case "peak":
      return buildPeakSet(library, opts);
    case "closing":
      return buildClosingSet(library, opts);
    case "auto":
    default:
      return buildAutoMixOrder(library, opts);
  }
}
