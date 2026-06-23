// Multi-pass BPM estimation using onset autocorrelation.
// Returns the most likely BPM with a confidence score and alternative
// half / double tempo candidates. Tuned for typical DJ music (house,
// afro/amapiano, hip-hop, trap, drill, techno, EDM, dancehall).

const ENV_RATE = 100; // envelope frames per second
const MIN_BPM = 60;
const MAX_BPM = 200;
// Preferred DJ tempo window — used to resolve half / double tempo ties.
const DJ_PREF_MIN = 90;
const DJ_PREF_MAX = 160;

export interface BpmCandidate {
  bpm: number;
  score: number; // normalized 0..1
}

export interface BpmEstimate {
  bpm: number | null;
  confidence: number; // 0..1
  candidates: BpmCandidate[]; // top alternates, sorted by score desc
  suspect: boolean; // true when result is ambiguous
}

export function estimateBPM(
  samples: Float32Array,
  sampleRate: number,
): BpmEstimate {
  const empty: BpmEstimate = { bpm: null, confidence: 0, candidates: [], suspect: true };
  if (samples.length < sampleRate * 5) return empty;

  // Analyze the middle ~45s (skip intro / outro silence).
  const targetLen = Math.min(samples.length, Math.floor(sampleRate * 45));
  const offset = Math.max(0, Math.floor((samples.length - targetLen) / 2));
  const block = Math.max(1, Math.floor(sampleRate / ENV_RATE));
  const envLen = Math.floor(targetLen / block);
  if (envLen < ENV_RATE * 3) return empty;

  const env = new Float32Array(envLen);
  for (let i = 0; i < envLen; i++) {
    let sum = 0;
    const start = offset + i * block;
    for (let j = 0; j < block; j++) {
      const s = samples[start + j];
      sum += s * s;
    }
    env[i] = Math.sqrt(sum / block);
  }

  // Half-wave rectified difference => onset strength signal.
  const onset = new Float32Array(envLen);
  for (let i = 1; i < envLen; i++) {
    const d = env[i] - env[i - 1];
    onset[i] = d > 0 ? d : 0;
  }
  let mean = 0;
  for (let i = 0; i < envLen; i++) mean += onset[i];
  mean /= envLen;
  for (let i = 0; i < envLen; i++) onset[i] -= mean;

  const minLag = Math.floor((60 * ENV_RATE) / MAX_BPM);
  const maxLag = Math.floor((60 * ENV_RATE) / MIN_BPM);

  // Autocorrelation curve over the lag range.
  const acf = new Float32Array(maxLag + 1);
  let maxScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    const end = envLen - lag;
    for (let i = 0; i < end; i++) acc += onset[i] * onset[i + lag];
    acf[lag] = acc;
    if (acc > maxScore) maxScore = acc;
  }
  if (maxScore <= 0) return empty;

  // Find local peaks, normalize.
  type Peak = { lag: number; score: number };
  const peaks: Peak[] = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (acf[lag] > acf[lag - 1] && acf[lag] >= acf[lag + 1] && acf[lag] > 0) {
      peaks.push({ lag, score: acf[lag] / maxScore });
    }
  }
  if (peaks.length === 0) return empty;
  peaks.sort((a, b) => b.score - a.score);

  // Parabolic interpolation for sub-bin precision.
  function refine(lag: number): number {
    if (lag <= minLag || lag >= maxLag) return lag;
    const y0 = acf[lag - 1];
    const y1 = acf[lag];
    const y2 = acf[lag + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom === 0) return lag;
    const delta = (0.5 * (y0 - y2)) / denom;
    if (delta <= -1 || delta >= 1) return lag;
    return lag + delta;
  }

  function bpmFromLag(lag: number): number {
    return (60 * ENV_RATE) / lag;
  }

  // DJ-friendly octave pick: choose between bpm / 2*bpm / bpm/2 by
  // preferring values inside the DJ tempo window, then preferring values
  // closer to 128 (mid-window).
  function djPreferred(bpm: number, score: number): { bpm: number; weight: number } {
    const variants = [bpm, bpm * 2, bpm / 2, bpm * 4, bpm / 4].filter(
      (b) => b >= MIN_BPM && b <= MAX_BPM,
    );
    let best = bpm;
    let bestW = -Infinity;
    for (const b of variants) {
      const inside = b >= DJ_PREF_MIN && b <= DJ_PREF_MAX ? 1 : 0;
      const dist = Math.abs(b - 128) / 128;
      // Strong bonus for being inside the DJ window, mild centering bonus.
      const w = inside * 1.0 - dist * 0.25 + score * 0.5;
      if (w > bestW) {
        bestW = w;
        best = b;
      }
    }
    return { bpm: best, weight: bestW };
  }

  const topPeaks = peaks.slice(0, 4);
  const candidates: BpmCandidate[] = [];
  const seen = new Set<number>();
  for (const p of topPeaks) {
    const raw = bpmFromLag(refine(p.lag));
    for (const b of [raw, raw * 2, raw / 2]) {
      if (b < MIN_BPM || b > MAX_BPM) continue;
      const rounded = Math.round(b * 10) / 10;
      if (seen.has(rounded)) continue;
      seen.add(rounded);
      candidates.push({ bpm: rounded, score: p.score });
    }
  }

  // Pick best raw peak, then map to DJ octave.
  const top = peaks[0];
  const rawBpm = bpmFromLag(refine(top.lag));
  const { bpm: chosen } = djPreferred(rawBpm, top.score);

  // Confidence: ratio between top peak and the next non-octave peak.
  const second = peaks.find((p) => {
    if (p === top) return false;
    const b = bpmFromLag(p.lag);
    const ratios = [b / rawBpm, rawBpm / b];
    // Ignore octave-related peaks (×2, ÷2, ×3, ÷3): those are not "competing" interpretations.
    for (const r of ratios) {
      if (Math.abs(r - 2) < 0.05 || Math.abs(r - 0.5) < 0.05) return false;
      if (Math.abs(r - 3) < 0.05 || Math.abs(r - 1 / 3) < 0.05) return false;
    }
    return true;
  });
  const ratio = second ? (top.score - second.score) / top.score : 1;
  let confidence = Math.max(0, Math.min(1, ratio * 1.6 + 0.15));
  // Slight bonus when chosen lies in DJ window.
  if (chosen >= DJ_PREF_MIN && chosen <= DJ_PREF_MAX) confidence = Math.min(1, confidence + 0.05);

  const suspect = confidence < 0.5 || rawBpm < 60 || rawBpm > 200;

  return {
    bpm: Math.round(chosen * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    candidates: candidates.slice(0, 5),
    suspect,
  };
}
