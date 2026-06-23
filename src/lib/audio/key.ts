// Advanced musical key detection.
//
// Pipeline (close to what Mixxx / KeyFinder do):
//   1. STFT with a Hann window, log-magnitude spectrum.
//   2. Estimate global tuning offset (in cents) from the histogram of
//      strong-bin pitches, then map every bin to the closest tempered
//      pitch class using that offset. Without this step every track
//      tuned to 442 Hz or 438 Hz is mis-classified.
//   3. Build a 12-bin chromagram by summing log-magnitudes for tonal
//      peaks (bins that are local maxima — this filters out broadband
//      noise / percussion energy and behaves like a lightweight
//      harmonic-percussive separation).
//   4. Normalise the chroma and correlate it against the Temperley
//      key profiles for the 24 major / minor keys. Temperley's profiles
//      outperform Krumhansl on contemporary music.
//   5. Confidence is the contrast between the best key and the next
//      non-relative / non-parallel competitor.
import { fftInPlace } from "./fft";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Temperley (2007) "Music and Probability" key profiles.
const MAJOR_PROFILE = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0];
const MINOR_PROFILE = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0];

const FFT_SIZE = 8192;       // ~5.4 Hz resolution @ 44.1 kHz
const HOP = 4096;
const MIN_FREQ = 55;          // A1
const MAX_FREQ = 2093;        // C7

export interface KeyResult {
  note: string;
  mode: "major" | "minor";
  label: string;
  confidence: number;
  tuningCents: number;
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}
const WINDOW = hann(FFT_SIZE);

function zeroMeanUnit(v: number[] | Float64Array): { v: number[]; norm: number } {
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i];
  mean /= v.length;
  const out: number[] = new Array(v.length);
  let sq = 0;
  for (let i = 0; i < v.length; i++) {
    const d = v[i] - mean;
    out[i] = d;
    sq += d * d;
  }
  return { v: out, norm: Math.sqrt(sq) || 1 };
}

function pearson(a: { v: number[]; norm: number }, b: { v: number[]; norm: number }): number {
  let s = 0;
  for (let i = 0; i < a.v.length; i++) s += a.v[i] * b.v[i];
  return s / (a.norm * b.norm);
}

export function estimateKey(samples: Float32Array, sampleRate: number): KeyResult | null {
  if (samples.length < FFT_SIZE * 4) return null;

  // Analyse the middle ~90 s.
  const targetLen = Math.min(samples.length, Math.floor(sampleRate * 90));
  const offset = Math.max(0, Math.floor((samples.length - targetLen) / 2));

  const binHz = sampleRate / FFT_SIZE;
  const minBin = Math.max(2, Math.floor(MIN_FREQ / binHz));
  const maxBin = Math.min(FFT_SIZE / 2 - 2, Math.ceil(MAX_FREQ / binHz));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  // Pass 1: collect strong tonal peaks per frame and accumulate a cents
  // histogram for tuning estimation.
  type Peak = { freq: number; mag: number };
  const allPeaks: Peak[] = [];
  for (let pos = offset; pos + FFT_SIZE <= offset + targetLen; pos += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[pos + i] * WINDOW[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const mag = new Float32Array(maxBin + 2);
    for (let k = minBin - 1; k <= maxBin + 1; k++) {
      mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
    for (let k = minBin; k <= maxBin; k++) {
      const m = mag[k];
      if (m < 1e-4) continue;
      if (m <= mag[k - 1] || m < mag[k + 1]) continue;
      // Quadratic interpolation for sub-bin precision.
      const y0 = mag[k - 1];
      const y1 = mag[k];
      const y2 = mag[k + 1];
      const denom = y0 - 2 * y1 + y2;
      const delta = denom === 0 ? 0 : 0.5 * (y0 - y2) / denom;
      const freq = (k + delta) * binHz;
      if (freq < MIN_FREQ || freq > MAX_FREQ) continue;
      allPeaks.push({ freq, mag: Math.log1p(m) });
    }
  }
  if (allPeaks.length < 50) return null;

  // Tuning estimate: histogram of deviation (in cents) from the closest
  // tempered semitone, in [-50, +50). Take the weighted peak.
  const histBins = 100;
  const hist = new Float64Array(histBins);
  for (const p of allPeaks) {
    const midi = 69 + 12 * Math.log2(p.freq / 440);
    let cents = (midi - Math.round(midi)) * 100; // [-50, +50)
    if (cents >= 50) cents -= 100;
    if (cents < -50) cents += 100;
    const idx = Math.min(histBins - 1, Math.max(0, Math.floor(cents + 50)));
    hist[idx] += p.mag;
  }
  // Smooth the histogram (triangular kernel) and find its peak.
  const smooth = new Float64Array(histBins);
  for (let i = 0; i < histBins; i++) {
    let s = 0;
    for (let j = -3; j <= 3; j++) {
      const k = (i + j + histBins) % histBins;
      s += hist[k] * (4 - Math.abs(j));
    }
    smooth[i] = s;
  }
  let bestBin = 0;
  let bestVal = -1;
  for (let i = 0; i < histBins; i++) {
    if (smooth[i] > bestVal) {
      bestVal = smooth[i];
      bestBin = i;
    }
  }
  const tuningCents = bestBin - 50;

  // Pass 2: build the chromagram using the tuned semitone mapping.
  const chroma = new Float64Array(12);
  for (const p of allPeaks) {
    const midi = 69 + 12 * Math.log2(p.freq / 440) - tuningCents / 100;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += p.mag;
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i];
  if (sum <= 0) return null;
  for (let i = 0; i < 12; i++) chroma[i] /= sum;

  // Correlate against all 24 key profiles (Pearson on centered vectors).
  const chr = zeroMeanUnit(chroma);
  const scores: { rot: number; mode: "major" | "minor"; score: number }[] = [];
  for (let rot = 0; rot < 12; rot++) {
    const maj = new Array<number>(12);
    const min = new Array<number>(12);
    for (let i = 0; i < 12; i++) {
      maj[i] = MAJOR_PROFILE[(i - rot + 12) % 12];
      min[i] = MINOR_PROFILE[(i - rot + 12) % 12];
    }
    scores.push({ rot, mode: "major", score: pearson(chr, zeroMeanUnit(maj)) });
    scores.push({ rot, mode: "minor", score: pearson(chr, zeroMeanUnit(min)) });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // Find the strongest non-relative / non-parallel competitor to gauge
  // ambiguity (relative / parallel keys share too many pitches to count
  // as "wrong" alternatives).
  function isClose(a: typeof best, b: typeof best): boolean {
    if (a.rot === b.rot && a.mode !== b.mode) return true; // parallel
    if (a.mode === "major" && b.mode === "minor" && (a.rot - b.rot + 12) % 12 === 3) return true;
    if (a.mode === "minor" && b.mode === "major" && (b.rot - a.rot + 12) % 12 === 3) return true;
    return false;
  }
  const runner = scores.slice(1).find((s) => !isClose(best, s));
  const margin = runner ? best.score - runner.score : best.score;
  // Map margin → 0..1 confidence. Empirically a margin of ~0.15 already
  // means "very clear", so scale accordingly.
  let confidence = Math.max(0, Math.min(1, margin * 5 + best.score * 0.4));
  if (best.score < 0) confidence = Math.max(0, confidence - 0.2);

  const note = NOTE_NAMES[best.rot];
  return {
    note,
    mode: best.mode,
    label: `${note} ${best.mode}`,
    confidence: Math.round(confidence * 100) / 100,
    tuningCents,
  };
}
