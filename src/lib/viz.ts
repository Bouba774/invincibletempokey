// Central visualization helpers for TempoKey: Camelot color families,
// energy meters, harmonic compatibility tiers, and library statistics.

import type { Track } from "./library-store";
import {
  camelotDistance,
  energyScore,
  parseCamelot,
} from "./harmonic";

// ---------------------------------------------------------------------------
// Camelot color families
// ---------------------------------------------------------------------------
// Six families of two consecutive numbers each. Minor (A) and major (B) share
// a hue; B is brighter / warmer, A is desaturated / cooler.

export interface CamelotTone {
  /** Solid background color (filled badge). */
  bg: string;
  /** Foreground over the solid bg. */
  fg: string;
  /** Subtle tint background (soft chip). */
  soft: string;
  /** Border color matching the family. */
  border: string;
  /** Family display label. */
  family: string;
}

const FAMILIES: Record<number, { hue: number; family: string }> = {
  1: { hue: 280, family: "Violet" },   // 1-2
  2: { hue: 280, family: "Violet" },
  3: { hue: 235, family: "Bleu" },     // 3-4
  4: { hue: 235, family: "Bleu" },
  5: { hue: 195, family: "Cyan" },     // 5-6
  6: { hue: 195, family: "Cyan" },
  7: { hue: 150, family: "Vert" },     // 7-8
  8: { hue: 150, family: "Vert" },
  9: { hue: 75,  family: "Jaune" },    // 9-10
  10: { hue: 75, family: "Jaune" },
  11: { hue: 28, family: "Orange" },   // 11-12
  12: { hue: 28, family: "Orange" },
};

const NEUTRAL: CamelotTone = {
  bg: "#3f3f46",
  fg: "#e4e4e7",
  soft: "rgba(63,63,70,0.25)",
  border: "rgba(228,228,231,0.18)",
  family: "—",
};

export function camelotTone(code: string | null | undefined): CamelotTone {
  const parsed = parseCamelot(code);
  if (!parsed) return NEUTRAL;
  const fam = FAMILIES[parsed.num];
  if (!fam) return NEUTRAL;
  const isMajor = parsed.letter === "B";
  // OKLCH gives perceptually even families across hues.
  const L = isMajor ? 0.66 : 0.58;
  const C = isMajor ? 0.17 : 0.13;
  const softL = 0.32;
  return {
    bg: `oklch(${L} ${C} ${fam.hue})`,
    fg: isMajor ? "#0b0b14" : "#ffffff",
    soft: `oklch(${softL} ${C * 0.55} ${fam.hue} / 0.35)`,
    border: `oklch(${L} ${C} ${fam.hue} / 0.45)`,
    family: fam.family,
  };
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

/** Convert continuous 0..1 energy score to an integer level 1..5. */
export function energyBars(track: Pick<Track, "bpm" | "camelot">): number {
  const s = energyScore(track);
  return Math.max(1, Math.min(5, Math.round(s * 4) + 1));
}

export function energyTone(bars: number): { color: string; label: string } {
  if (bars <= 1) return { color: "oklch(0.65 0.10 230)", label: "Très calme" };
  if (bars === 2) return { color: "oklch(0.70 0.13 200)", label: "Calme" };
  if (bars === 3) return { color: "oklch(0.74 0.16 150)", label: "Moyen" };
  if (bars === 4) return { color: "oklch(0.76 0.18 70)", label: "Énergique" };
  return { color: "oklch(0.68 0.22 25)", label: "Très énergique" };
}

// ---------------------------------------------------------------------------
// Harmonic compatibility tiers
// ---------------------------------------------------------------------------

export type CompatTier = "perfect" | "great" | "ok" | "risky" | "avoid" | "unknown";

export interface CompatBadge {
  tier: CompatTier;
  label: string;
  tone: { bg: string; fg: string; ring: string };
  hint: string;
}

export function compatBetween(
  source: Pick<Track, "camelot" | "bpm"> | null,
  target: Pick<Track, "camelot" | "bpm">,
): CompatBadge {
  if (!source || !source.camelot || !target.camelot) {
    return {
      tier: "unknown",
      label: "Inconnu",
      tone: { bg: "bg-[var(--surface-elevated)]", fg: "text-muted-foreground", ring: "ring-border" },
      hint: "Camelot manquant",
    };
  }
  const a = parseCamelot(source.camelot);
  const b = parseCamelot(target.camelot);
  if (!a || !b) {
    return {
      tier: "unknown",
      label: "Inconnu",
      tone: { bg: "bg-[var(--surface-elevated)]", fg: "text-muted-foreground", ring: "ring-border" },
      hint: "Camelot invalide",
    };
  }
  const dist = camelotDistance(a, b);
  const bpmDiffPct =
    source.bpm && target.bpm
      ? (Math.abs(target.bpm - source.bpm) / source.bpm) * 100
      : 100;

  if (dist === 0 && bpmDiffPct <= 3) {
    return {
      tier: "perfect",
      label: "Très compatible",
      tone: {
        bg: "bg-emerald-500/15",
        fg: "text-emerald-300",
        ring: "ring-emerald-500/30",
      },
      hint: "Même tonalité",
    };
  }
  if (dist <= 1 && bpmDiffPct <= 6) {
    return {
      tier: "great",
      label: "Compatible",
      tone: {
        bg: "bg-[var(--primary)]/15",
        fg: "text-[var(--primary-glow)]",
        ring: "ring-[var(--primary)]/30",
      },
      hint: "Clé adjacente",
    };
  }
  if (dist <= 2 && bpmDiffPct <= 8) {
    return {
      tier: "ok",
      label: "Acceptable",
      tone: {
        bg: "bg-sky-500/15",
        fg: "text-sky-300",
        ring: "ring-sky-500/30",
      },
      hint: "Mix possible",
    };
  }
  if (dist <= 3) {
    return {
      tier: "risky",
      label: "Transition risquée",
      tone: {
        bg: "bg-amber-500/15",
        fg: "text-amber-300",
        ring: "ring-amber-500/30",
      },
      hint: "À mixer prudemment",
    };
  }
  return {
    tier: "avoid",
    label: "Non recommandé",
    tone: {
      bg: "bg-red-500/10",
      fg: "text-red-300",
      ring: "ring-red-500/25",
    },
    hint: "Tonalités éloignées",
  };
}

// ---------------------------------------------------------------------------
// Library statistics
// ---------------------------------------------------------------------------

export interface BpmBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export const BPM_BUCKETS: Array<Pick<BpmBucket, "label" | "min" | "max">> = [
  { label: "< 90", min: 0, max: 89.99 },
  { label: "90–110", min: 90, max: 109.99 },
  { label: "110–120", min: 110, max: 119.99 },
  { label: "120–128", min: 120, max: 127.99 },
  { label: "128–135", min: 128, max: 134.99 },
  { label: "135–145", min: 135, max: 144.99 },
  { label: "145+", min: 145, max: Infinity },
];

export interface LibraryStats {
  total: number;
  analyzed: number;
  totalDurationSec: number;
  bpmAvg: number | null;
  bpmMin: number | null;
  bpmMax: number | null;
  energyAvg: number | null;
  bpmHistogram: BpmBucket[];
  camelotHistogram: Array<{ code: string; count: number }>;
  energyHistogram: Array<{ bars: number; count: number }>;
  dominantCamelot: string | null;
  suspects: number;
}

export function computeStats(tracks: Track[]): LibraryStats {
  const total = tracks.length;
  let analyzed = 0;
  let durationSec = 0;
  let bpmSum = 0;
  let bpmCount = 0;
  let bpmMin: number | null = null;
  let bpmMax: number | null = null;
  let energySum = 0;
  let energyN = 0;
  let suspects = 0;

  const camelotCount = new Map<string, number>();
  const bpmBuckets = BPM_BUCKETS.map((b) => ({ ...b, count: 0 }));
  const energyBuckets = [1, 2, 3, 4, 5].map((bars) => ({ bars, count: 0 }));

  for (const t of tracks) {
    if (t.analyzed) analyzed++;
    if (t.suspect && t.analyzed) suspects++;
    if (t.durationSec) durationSec += t.durationSec;
    if (t.bpm != null) {
      bpmSum += t.bpm;
      bpmCount++;
      bpmMin = bpmMin == null ? t.bpm : Math.min(bpmMin, t.bpm);
      bpmMax = bpmMax == null ? t.bpm : Math.max(bpmMax, t.bpm);
      const bucket = bpmBuckets.find((b) => t.bpm! >= b.min && t.bpm! <= b.max);
      if (bucket) bucket.count++;
    }
    if (t.camelot) {
      const k = t.camelot.toUpperCase();
      camelotCount.set(k, (camelotCount.get(k) ?? 0) + 1);
    }
    if (t.analyzed && t.bpm != null) {
      const bars = energyBars(t);
      energyBuckets[bars - 1].count++;
      energySum += energyScore(t);
      energyN++;
    }
  }

  // Sorted by Camelot wheel order (1A, 1B, 2A, 2B, …) for visual consistency.
  const camelotHistogram = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(
    (n) =>
      (["A", "B"] as const).map((l) => {
        const code = `${n}${l}`;
        return { code, count: camelotCount.get(code) ?? 0 };
      }),
  );

  let dominantCamelot: string | null = null;
  let domCount = 0;
  for (const { code, count } of camelotHistogram) {
    if (count > domCount) {
      domCount = count;
      dominantCamelot = code;
    }
  }

  return {
    total,
    analyzed,
    totalDurationSec: durationSec,
    bpmAvg: bpmCount ? Math.round((bpmSum / bpmCount) * 10) / 10 : null,
    bpmMin,
    bpmMax,
    energyAvg: energyN ? Math.round((energySum / energyN) * 100) / 100 : null,
    bpmHistogram: bpmBuckets,
    camelotHistogram,
    energyHistogram: energyBuckets,
    dominantCamelot,
    suspects,
  };
}

export function formatTotalDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}
