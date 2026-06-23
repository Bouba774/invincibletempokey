import type { Track } from "./library-store";

// Camelot wheel helpers --------------------------------------------------

export interface CamelotCode {
  num: number; // 1..12
  letter: "A" | "B";
}

export function parseCamelot(code: string | null | undefined): CamelotCode | null {
  if (!code) return null;
  const m = /^(\d{1,2})([AB])$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const num = Number(m[1]);
  if (num < 1 || num > 12) return null;
  return { num, letter: m[2] as "A" | "B" };
}

function wrap12(n: number): number {
  return ((n - 1 + 12) % 12) + 1;
}

/** Direct neighbours: same code, ±1 on the wheel, relative major/minor (same number, opposite letter). */
export function camelotNeighbors(code: CamelotCode): string[] {
  const same = `${code.num}${code.letter}`;
  const up = `${wrap12(code.num + 1)}${code.letter}`;
  const down = `${wrap12(code.num - 1)}${code.letter}`;
  const rel = `${code.num}${code.letter === "A" ? "B" : "A"}`;
  return [same, up, down, rel];
}

/** Distance on the wheel: 0 same key, 1 adjacent / relative, 2+ further away. */
export function camelotDistance(a: CamelotCode, b: CamelotCode): number {
  const sameLetter = a.letter === b.letter;
  const ringDiff = Math.min(
    Math.abs(a.num - b.num),
    12 - Math.abs(a.num - b.num),
  );
  if (sameLetter) return ringDiff;
  // Different letter: relative major/minor is +1 cost, then add ring diff.
  return ringDiff + 1;
}

// Energy estimation ------------------------------------------------------

export type EnergyLevel = "low" | "medium" | "high";

/** Continuous score 0..1 derived from BPM and mode (major brighter than minor). */
export function energyScore(track: Pick<Track, "bpm" | "camelot">): number {
  const bpm = track.bpm ?? 0;
  // BPM contribution: 80 BPM -> 0, 140 BPM -> 1, clamped.
  const bpmPart = Math.max(0, Math.min(1, (bpm - 80) / (140 - 80)));
  const code = parseCamelot(track.camelot);
  const modeBoost = code?.letter === "B" ? 0.1 : code?.letter === "A" ? -0.05 : 0;
  return Math.max(0, Math.min(1, bpmPart * 0.9 + modeBoost + 0.05));
}

export function energyLevel(track: Pick<Track, "bpm" | "camelot">): EnergyLevel {
  const s = energyScore(track);
  if (s < 0.35) return "low";
  if (s < 0.7) return "medium";
  return "high";
}

export function energyLabel(level: EnergyLevel): string {
  return level === "low" ? "Low Energy" : level === "medium" ? "Medium Energy" : "High Energy";
}

// Suggestions ------------------------------------------------------------

export interface Suggestion {
  track: Track;
  score: number; // higher = better match
  camelotDist: number;
  bpmDiffPct: number;
  energyDelta: number; // target - source, signed
}

interface SuggestionBundle {
  compatible: Suggestion[];
  smooth: Suggestion[];
  energetic: Suggestion[];
  next: Suggestion[];
}

const cache = new Map<string, { v: number; bundle: SuggestionBundle }>();
let cacheVersion = 0;

/** Invalidate the suggestion cache (call when library changes meaningfully). */
export function invalidateHarmonicCache(): void {
  cacheVersion++;
  cache.clear();
}

export function getSuggestions(source: Track, library: Track[]): SuggestionBundle {
  const cached = cache.get(source.id);
  if (cached && cached.v === cacheVersion) return cached.bundle;

  const srcCode = parseCamelot(source.camelot);
  const srcBpm = source.bpm;
  const srcEnergy = energyScore(source);

  const scored: Suggestion[] = [];
  for (const t of library) {
    if (t.id === source.id) continue;
    if (!t.analyzed) continue;
    const code = parseCamelot(t.camelot);
    const dist = srcCode && code ? camelotDistance(srcCode, code) : 99;
    const bpmDiffPct =
      srcBpm && t.bpm ? (Math.abs(t.bpm - srcBpm) / srcBpm) * 100 : 100;
    const energyDelta = energyScore(t) - srcEnergy;

    // Lower is better; combine into a positive score for ranking.
    const penalty = dist * 4 + bpmDiffPct * 0.5;
    const score = Math.max(0, 100 - penalty);
    scored.push({ track: t, score, camelotDist: dist, bpmDiffPct, energyDelta });
  }

  const compatible = [...scored]
    .filter((s) => s.camelotDist <= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const smooth = [...scored]
    .filter((s) => s.camelotDist <= 1 && s.bpmDiffPct <= 3)
    .sort((a, b) => a.bpmDiffPct - b.bpmDiffPct || b.score - a.score)
    .slice(0, 8);

  const energetic = [...scored]
    .filter(
      (s) =>
        s.camelotDist <= 2 &&
        s.energyDelta > 0.05 &&
        s.bpmDiffPct >= 1 &&
        s.bpmDiffPct <= 8,
    )
    .sort(
      (a, b) =>
        b.energyDelta - a.energyDelta || a.camelotDist - b.camelotDist,
    )
    .slice(0, 8);

  const next = [...scored]
    .filter((s) => s.camelotDist <= 1 && s.bpmDiffPct <= 5)
    .sort((a, b) => {
      // Prefer same/adjacent key, slight forward energy progression, small BPM ramp.
      const aRank =
        a.camelotDist * 3 + Math.abs(a.energyDelta - 0.05) * 5 + a.bpmDiffPct * 0.2;
      const bRank =
        b.camelotDist * 3 + Math.abs(b.energyDelta - 0.05) * 5 + b.bpmDiffPct * 0.2;
      return aRank - bRank;
    })
    .slice(0, 5);

  const bundle: SuggestionBundle = { compatible, smooth, energetic, next };
  cache.set(source.id, { v: cacheVersion, bundle });
  return bundle;
}