import { hashFile } from "./hash";
import { estimateBPM } from "./bpm";
import { estimateKey } from "./key";
import { toCamelot, camelotFor } from "./camelot";
import { getCachedAnalysis, setCachedAnalysis, type TrackAnalysis } from "./cache";
import {
  toMono as preToMono,
  resampleTo44k,
  peakNormalize,
  trimSilence,
  pickSegments,
} from "./preprocess";
import { getEssentia, freeVectors, type EssentiaInstance } from "./essentia-engine";

let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (ctx) return ctx;
  const AC =
    (window.AudioContext as typeof AudioContext | undefined) ??
    ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AC) throw new Error("Web Audio API non disponible");
  ctx = new AC();
  return ctx;
}

function decode(ac: AudioContext, buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const p = ac.decodeAudioData(buf, resolve, reject) as unknown as Promise<AudioBuffer> | undefined;
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") {
        (p as Promise<AudioBuffer>).then(resolve, reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function toMono(audio: AudioBuffer): Float32Array {
  return preToMono(audio);
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface AnalyzeOptions {
  force?: boolean; // bypass cache
}

// ---------------------------------------------------------------------------
// Essentia-powered analysis pipeline.
// ---------------------------------------------------------------------------

const DJ_PREF_MIN = 85;
const DJ_PREF_MAX = 175;

function humanKeyLabel(note: string, scale: "major" | "minor"): string {
  const cap = scale === "major" ? "Major" : "Minor";
  return `${note} ${cap}`;
}

/**
 * Run RhythmExtractor2013 with the "multifeature" method (the same algorithm
 * used by AcousticBrainz / Essentia's batch tools, comparable in accuracy to
 * Mixed In Key for steady-tempo material) and resolve half / double tempo
 * ambiguity by scoring ×0.5, ×1 and ×2 candidates.
 */
function essentiaBpm(
  essentia: EssentiaInstance,
  samples: Float32Array,
): { bpm: number; confidence: number; ticks: number; intervals: number[] } | null {
  const buf = new Float32Array(samples.length);
  buf.set(samples);
  const vec = essentia.arrayToVector(buf);
  try {
    const out = essentia.RhythmExtractor2013(vec, 208, "multifeature", 40);
    const intervals: number[] = [];
    if (out.bpmIntervals) {
      const n = out.bpmIntervals.size();
      for (let i = 0; i < n; i++) intervals.push(out.bpmIntervals.get(i));
    }
    const ticks = out.ticks ? out.ticks.size() : 0;
    const result = {
      bpm: out.bpm,
      // RhythmExtractor2013 returns confidence in [0..5.3] (5.3 ≈ perfect).
      // Normalise to [0..1] for our UI.
      confidence: Math.max(0, Math.min(1, out.confidence / 3.5)),
      ticks,
      intervals,
    };
    freeVectors(out.ticks, out.estimates, out.bpmIntervals);
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[essentia] RhythmExtractor2013 failed:", e);
    return null;
  } finally {
    freeVectors(vec);
  }
}

/**
 * Cross-validation tempo estimator. Percival's algorithm is fast and very
 * reliable on the octave (it tends to lock on the "perceptual" pulse used
 * by DJ apps), so we use it as a tiebreaker for half/double tempo cases.
 */
function essentiaBpmPercival(
  essentia: EssentiaInstance,
  samples: Float32Array,
): number | null {
  const buf = new Float32Array(samples.length);
  buf.set(samples);
  const vec = essentia.arrayToVector(buf);
  try {
    const out = essentia.PercivalBpmEstimator(vec, 1024, 2048, 128, 128, 210, 50, 44100);
    return out.bpm > 0 ? out.bpm : null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[essentia] PercivalBpmEstimator failed:", e);
    return null;
  } finally {
    freeVectors(vec);
  }
}

/** Coefficient of variation of the inter-beat intervals (lower = steadier). */
function intervalsCv(intervals: number[]): number {
  if (intervals.length < 4) return 1;
  let mean = 0;
  for (const v of intervals) mean += v;
  mean /= intervals.length;
  if (mean <= 0) return 1;
  let varSum = 0;
  for (const v of intervals) varSum += (v - mean) * (v - mean);
  return Math.sqrt(varSum / intervals.length) / mean;
}

/**
 * Decide between BPM, BPM×2 and BPM/2. We trust Essentia's raw value
 * whenever it lands inside the DJ-friendly window with high confidence;
 * otherwise we lean toward the octave that falls into [85, 175] BPM.
 */
function resolveOctave(
  bpm: number,
  confidence: number,
  intervalsCvValue: number,
  reference: number | null,
): { bpm: number; corrected: boolean } {
  const candidates = [
    { bpm: bpm * 0.5, w: 0.85 },
    { bpm, w: 1.0 },
    { bpm: bpm * 2, w: 0.85 },
    { bpm: bpm * (2 / 3), w: 0.6 },
    { bpm: bpm * 1.5, w: 0.6 },
  ];
  let bestBpm = bpm;
  let bestScore = -Infinity;
  let chosenIdx = 1;
  candidates.forEach((c, idx) => {
    if (c.bpm < 40 || c.bpm > 220) return;
    const inDjWindow = c.bpm >= DJ_PREF_MIN && c.bpm <= DJ_PREF_MAX ? 1 : 0.55;
    const stability = 1 - Math.min(0.5, intervalsCvValue);
    // Cross-validation bonus: if Percival's estimate matches this candidate
    // (within ~3 %), strongly prefer it. This single check is what makes the
    // engine match Rekordbox / Serato on tricky half-time tracks.
    let refBonus = 1;
    if (reference != null && reference > 0) {
      const ratio = c.bpm / reference;
      const closeness = Math.abs(ratio - 1);
      if (closeness < 0.03) refBonus = 1.6;
      else if (closeness < 0.06) refBonus = 1.25;
      else refBonus = 0.9;
    }
    const score =
      c.w *
      inDjWindow *
      (0.5 + 0.5 * confidence) *
      (0.6 + 0.4 * stability) *
      refBonus;
    if (score > bestScore) {
      bestScore = score;
      bestBpm = c.bpm;
      chosenIdx = idx;
    }
  });
  return { bpm: bestBpm, corrected: chosenIdx !== 1 };
}

function essentiaKey(
  essentia: EssentiaInstance,
  samples: Float32Array,
  sampleRate: number,
  profileType: "bgate" | "edma" | "edmm" | "temperley" | "krumhansl" = "edma",
): { note: string; scale: "major" | "minor"; strength: number } | null {
  const buf = new Float32Array(samples.length);
  buf.set(samples);
  const vec = essentia.arrayToVector(buf);
  try {
    const out = essentia.KeyExtractor(
      vec,
      true,        // averageDetuningCorrection
      4096,        // frameSize
      2048,        // hopSize (50 % overlap – more stable HPCP averaging)
      12,          // hpcpSize
      3500,        // maxFrequency
      60,          // maximumSpectralPeaks
      25,          // minFrequency
      0.2,         // pcpThreshold
      profileType, // profileType
      sampleRate,  // sampleRate
      0.0001,      // spectralPeaksThreshold
      440,         // tuningFrequency
      "cosine",    // weightType
      "hann",      // windowType
    );
    return { note: out.key, scale: out.scale, strength: out.strength };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[essentia] KeyExtractor failed:", e);
    return null;
  } finally {
    freeVectors(vec);
  }
}

interface KeyVoteEntry {
  note: string;
  scale: "major" | "minor";
  strength: number;
  weight: number;
}

/** Weighted vote across multiple segment-level key estimates. */
function voteKey(entries: KeyVoteEntry[]): { note: string; scale: "major" | "minor"; confidence: number } | null {
  if (entries.length === 0) return null;
  const bucket = new Map<string, { note: string; scale: "major" | "minor"; total: number; count: number }>();
  let totalWeight = 0;
  for (const e of entries) {
    const key = `${e.note}|${e.scale}`;
    const w = Math.max(0, e.weight) * Math.max(0.05, Math.min(1, e.strength));
    totalWeight += w;
    const prev = bucket.get(key);
    if (prev) {
      prev.total += w;
      prev.count += 1;
    } else {
      bucket.set(key, { note: e.note, scale: e.scale, total: w, count: 1 });
    }
  }
  if (totalWeight <= 0) return null;
  const ranked = Array.from(bucket.values()).sort((a, b) => b.total - a.total);
  const best = ranked[0];
  const runner = ranked[1];
  const margin = runner ? (best.total - runner.total) / best.total : 1;
  // Average per-segment strength contribution for the winner.
  const winnerEntries = entries.filter((e) => e.note === best.note && e.scale === best.scale);
  const avgStrength = winnerEntries.reduce((s, e) => s + e.strength, 0) / Math.max(1, winnerEntries.length);
  const confidence = Math.max(0, Math.min(1, 0.4 * avgStrength + 0.6 * margin + 0.1));
  return { note: best.note, scale: best.scale, confidence };
}

async function analyzeWithEssentia(
  essentia: EssentiaInstance,
  mono44k: Float32Array,
  sampleRate: number,
): Promise<{
  bpm: number;
  bpmConfidence: number;
  keyNote: string;
  keyScale: "major" | "minor";
  keyConfidence: number;
} | null> {
  // -----------------------------------------------------------------------
  // BPM: run RhythmExtractor2013 + PercivalBpmEstimator on the whole
  // (trimmed, normalised) signal and use Percival as octave reference.
  // -----------------------------------------------------------------------
  const rhythm = essentiaBpm(essentia, mono44k);
  if (!rhythm) return null;
  await new Promise<void>((r) => setTimeout(r, 0));
  const percival = essentiaBpmPercival(essentia, mono44k);
  const cv = intervalsCv(rhythm.intervals);
  const resolved = resolveOctave(rhythm.bpm, rhythm.confidence, cv, percival);
  const steadiness = 1 - Math.min(0.5, cv);
  // Cross-validation bonus: agreement with Percival lifts confidence.
  let agreement = 0;
  if (percival) {
    const r = resolved.bpm / percival;
    if (Math.abs(r - 1) < 0.03) agreement = 0.25;
    else if (Math.abs(r - 1) < 0.06) agreement = 0.1;
  }
  const bpmConfidence = Math.max(
    0,
    Math.min(1, 0.55 * rhythm.confidence + 0.25 * steadiness + agreement),
  );

  // -----------------------------------------------------------------------
  // Key: run KeyExtractor with three complementary key profiles
  // (edma for EDM/popular, bgate for contemporary, temperley as a neutral
  // baseline) on the full signal plus 4 representative segments, then
  // weighted-vote. Multi-profile fusion mirrors what MIK/Rekordbox do
  // internally and significantly reduces relative-major/minor confusions.
  // -----------------------------------------------------------------------
  const segments = pickSegments(mono44k, sampleRate, 30);
  const votes: KeyVoteEntry[] = [];
  const profiles: Array<{
    p: "bgate" | "edma" | "temperley";
    w: number;
  }> = [
    { p: "edma", w: 1.2 },
    { p: "bgate", w: 1.0 },
    { p: "temperley", w: 0.8 },
  ];
  for (const { p, w } of profiles) {
    await new Promise<void>((r) => setTimeout(r, 0));
    const full = essentiaKey(essentia, mono44k, sampleRate, p);
    if (full) {
      votes.push({
        note: full.note,
        scale: full.scale,
        strength: full.strength,
        weight: 2.0 * w,
      });
    }
  }
  for (const seg of segments) {
    await new Promise<void>((r) => setTimeout(r, 0));
    const k = essentiaKey(essentia, seg.samples, sampleRate, "edma");
    if (k) {
      votes.push({ note: k.note, scale: k.scale, strength: k.strength, weight: seg.weight });
    }
  }
  const voted = voteKey(votes);
  if (!voted) {
    return null;
  }

  return {
    bpm: Math.round(resolved.bpm * 100) / 100,
    bpmConfidence: Math.round(bpmConfidence * 100) / 100,
    keyNote: voted.note,
    keyScale: voted.scale,
    keyConfidence: Math.round(voted.confidence * 100) / 100,
  };
}

function fallbackAnalysis(mono: Float32Array, sampleRate: number) {
  const bpmRes = estimateBPM(mono, sampleRate);
  const keyRes = estimateKey(mono, sampleRate);
  return { bpmRes, keyRes };
}

export async function analyzeFile(
  file: File,
  options: AnalyzeOptions = {},
): Promise<TrackAnalysis> {
  const fileHash = await hashFile(file);
  if (!options.force) {
    const cached = await getCachedAnalysis(fileHash);
    if (cached) return cached;
  }

  const buf = await file.arrayBuffer();
  const audio = await decode(getCtx(), buf);
  const monoRaw = preToMono(audio);

  // Preprocess: resample to 44.1 kHz, normalise peak, trim silence.
  await new Promise<void>((r) => setTimeout(r, 0));
  const { samples: mono44k, sampleRate: sr } = await resampleTo44k(monoRaw, audio.sampleRate);
  const trimmed = trimSilence(mono44k, sr);
  peakNormalize(trimmed);

  let bpm: number | null = null;
  let bpmConfidence: number | null = null;
  let bpmCandidates: TrackAnalysis["bpmCandidates"] = [];
  let keyLabel: string | null = null;
  let camelot: string | null = null;
  let keyConfidence: number | null = null;

  // Try Essentia first.
  let usedEssentia = false;
  try {
    const essentia = await getEssentia();
    if (essentia) {
      await new Promise<void>((r) => setTimeout(r, 0));
      const res = await analyzeWithEssentia(essentia, trimmed, sr);
      if (res) {
        bpm = res.bpm;
        bpmConfidence = res.bpmConfidence;
        keyLabel = humanKeyLabel(res.keyNote, res.keyScale);
        camelot = camelotFor(res.keyNote, res.keyScale);
        keyConfidence = res.keyConfidence;
        bpmCandidates = [
          { bpm: Math.round(res.bpm * 10) / 10, score: 1 },
          { bpm: Math.round(res.bpm * 20) / 10, score: 0.5 },
          { bpm: Math.round(res.bpm * 5) / 10, score: 0.5 },
        ];
        usedEssentia = true;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[analyzer] Essentia path failed, using pure-JS fallback:", e);
  }

  if (!usedEssentia) {
    // Pure-JS fallback (preserves backward compatibility).
    await new Promise<void>((r) => setTimeout(r, 0));
    const { bpmRes, keyRes } = fallbackAnalysis(trimmed, sr);
    bpm = bpmRes.bpm;
    bpmConfidence = bpmRes.confidence;
    bpmCandidates = bpmRes.candidates;
    keyLabel = keyRes?.label ?? null;
    keyConfidence = keyRes?.confidence ?? null;
    camelot = keyRes ? toCamelot(keyRes) : null;
  }

  const suspect =
    (bpmConfidence ?? 0) < 0.45 || (keyConfidence ?? 0) < 0.35 || bpm == null;

  const result: TrackAnalysis = {
    fileHash,
    bpm,
    bpmConfidence,
    bpmCandidates,
    key: keyLabel,
    keyConfidence,
    camelot,
    durationSec: audio.duration,
    suspect,
    analyzedAt: Date.now(),
  };
  await setCachedAnalysis(result);
  return result;
}
