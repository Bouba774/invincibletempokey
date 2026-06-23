// Musical key detection: chromagram via FFT + Krumhansl-Schmuckler correlation.
import { fftInPlace } from "./fft";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler tonal hierarchy profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const FFT_SIZE = 4096;
const HOP = 2048;
const MIN_FREQ = 65; // C2
const MAX_FREQ = 2000; // ~B6

export interface KeyResult {
  note: string; // e.g. "A"
  mode: "major" | "minor";
  label: string; // e.g. "A minor"
  confidence: number; // 0..1
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

const WINDOW = hann(FFT_SIZE);

export function estimateKey(samples: Float32Array, sampleRate: number): KeyResult | null {
  if (samples.length < FFT_SIZE * 4) return null;

  const targetLen = Math.min(samples.length, Math.floor(sampleRate * 60));
  const offset = Math.max(0, Math.floor((samples.length - targetLen) / 2));

  const chroma = new Float64Array(12);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  const binHz = sampleRate / FFT_SIZE;
  const minBin = Math.max(1, Math.floor(MIN_FREQ / binHz));
  const maxBin = Math.min(FFT_SIZE / 2 - 1, Math.ceil(MAX_FREQ / binHz));

  for (let pos = offset; pos + FFT_SIZE <= offset + targetLen; pos += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[pos + i] * WINDOW[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let k = minBin; k <= maxBin; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      if (mag <= 1e-6) continue;
      const freq = k * binHz;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag;
    }
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i];
  if (sum <= 0) return null;
  for (let i = 0; i < 12; i++) chroma[i] /= sum;

  // Collect all 24 candidate scores to derive a confidence value.
  const scores: { rot: number; mode: "major" | "minor"; score: number }[] = [];
  for (let rot = 0; rot < 12; rot++) {
    let sMaj = 0;
    let sMin = 0;
    for (let i = 0; i < 12; i++) {
      const v = chroma[(i + rot) % 12];
      sMaj += v * MAJOR_PROFILE[i];
      sMin += v * MINOR_PROFILE[i];
    }
    scores.push({ rot, mode: "major", score: sMaj });
    scores.push({ rot, mode: "minor", score: sMin });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  const ratio = best.score > 0 ? (best.score - second.score) / best.score : 0;
  const confidence = Math.max(0, Math.min(1, ratio * 4 + 0.2));

  const note = NOTE_NAMES[best.rot];
  return {
    note,
    mode: best.mode,
    label: `${note} ${best.mode}`,
    confidence: Math.round(confidence * 100) / 100,
  };
}
