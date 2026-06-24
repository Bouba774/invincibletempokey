// Audio preprocessing helpers used by the analyser.
//
// The goal is to deliver Essentia.js a clean, normalised mono signal at
// 44.1 kHz – the sample rate every Essentia algorithm expects.

const TARGET_SR = 44100;

export function toMono(audio: AudioBuffer): Float32Array {
  const channels = audio.numberOfChannels;
  if (channels === 1) return audio.getChannelData(0).slice();
  const len = audio.length;
  const out = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = audio.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const inv = 1 / channels;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/**
 * Resample to 44.1 kHz via OfflineAudioContext when needed. Falls back to
 * the input samples untouched if OfflineAudioContext is unavailable.
 */
export async function resampleTo44k(
  samples: Float32Array,
  sourceRate: number,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (Math.abs(sourceRate - TARGET_SR) < 1) {
    return { samples, sampleRate: TARGET_SR };
  }
  const OAC =
    (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OAC) return { samples, sampleRate: sourceRate };
  try {
    const targetLen = Math.max(
      1,
      Math.round((samples.length * TARGET_SR) / sourceRate),
    );
    const oac = new OAC(1, targetLen, TARGET_SR);
    const buf = oac.createBuffer(1, samples.length, sourceRate);
    buf.copyToChannel(samples, 0);
    const src = oac.createBufferSource();
    src.buffer = buf;
    src.connect(oac.destination);
    src.start(0);
    const rendered = await oac.startRendering();
    return {
      samples: rendered.getChannelData(0).slice(),
      sampleRate: TARGET_SR,
    };
  } catch {
    return { samples, sampleRate: sourceRate };
  }
}

/** Normalise to a peak of 0.95 in-place. Returns the same buffer. */
export function peakNormalize(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  if (peak < 1e-6) return samples;
  const g = 0.95 / peak;
  if (Math.abs(g - 1) < 1e-3) return samples;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

/**
 * Trim leading and trailing silence (below ≈ –50 dBFS) so that intros and
 * outros do not dilute the rhythm/key analysis. The threshold is intentionally
 * conservative: we want to remove dead air, not soft outros.
 */
export function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const win = Math.max(1, Math.floor(sampleRate * 0.02)); // 20 ms windows
  const thresh = 0.003; // ≈ –50 dBFS
  // Find first window above threshold.
  let start = 0;
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0;
    for (let j = 0; j < win; j++) sum += samples[i + j] * samples[i + j];
    if (Math.sqrt(sum / win) > thresh) {
      start = i;
      break;
    }
  }
  let end = samples.length;
  for (let i = samples.length - win; i >= 0; i -= win) {
    let sum = 0;
    for (let j = 0; j < win; j++) sum += samples[i + j] * samples[i + j];
    if (Math.sqrt(sum / win) > thresh) {
      end = i + win;
      break;
    }
  }
  if (start === 0 && end === samples.length) return samples;
  if (end <= start) return samples;
  return samples.slice(start, end);
}

/**
 * Returns up to four overlapping windows that together cover the most
 * informative parts of the track: a short intro chunk, the central section,
 * the "main" body (between 30 % and 70 % of the track) and a short tail.
 * Each segment is at most `maxSec` seconds long so that key analysis stays
 * cheap on long mixes.
 */
export function pickSegments(
  samples: Float32Array,
  sampleRate: number,
  maxSec = 30,
): { name: string; start: number; samples: Float32Array; weight: number }[] {
  const totalSec = samples.length / sampleRate;
  if (totalSec < 8) {
    return [{ name: "full", start: 0, samples, weight: 1 }];
  }
  const winLen = Math.min(samples.length, Math.floor(maxSec * sampleRate));
  const out: { name: string; start: number; samples: Float32Array; weight: number }[] = [];
  const push = (name: string, startSec: number, weight: number) => {
    const start = Math.max(0, Math.min(samples.length - winLen, Math.floor(startSec * sampleRate)));
    out.push({ name, start, samples: samples.subarray(start, start + winLen), weight });
  };
  // Intro: skip the first 5 s (often a build-up) and grab the next chunk.
  push("intro", 5, 0.8);
  // Middle and "main" sections – these usually carry the dominant key/tempo.
  push("middle", Math.max(0, totalSec * 0.5 - maxSec / 2), 1.2);
  push("main", Math.max(0, totalSec * 0.7 - maxSec / 2), 1.0);
  // Outro: skip the last 5 s.
  push("outro", Math.max(0, totalSec - maxSec - 5), 0.7);
  return out;
}