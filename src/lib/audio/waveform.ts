import { createStore, get as idbGet, set as idbSet } from "idb-keyval";

const store = createStore("tempokey-waveform", "peaks");

export interface WaveformData {
  peaks: number[]; // values 0..1
  durationSec: number;
  generatedAt: number;
}

const memoryCache = new Map<string, WaveformData>();
const inflight = new Map<string, Promise<WaveformData | null>>();

export function getMemoryWaveform(key: string): WaveformData | undefined {
  return memoryCache.get(key);
}

export async function getCachedWaveform(key: string): Promise<WaveformData | null> {
  const mem = memoryCache.get(key);
  if (mem) return mem;
  try {
    const v = (await idbGet(key, store)) as WaveformData | undefined;
    if (v) memoryCache.set(key, v);
    return v ?? null;
  } catch {
    return null;
  }
}

const PEAK_COUNT = 240;

export async function generateWaveform(
  key: string,
  file: File,
): Promise<WaveformData | null> {
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    try {
      const cached = await getCachedWaveform(key);
      if (cached) return cached;

      const AC: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      try {
        const buf = await file.arrayBuffer();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        const channel = audio.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / PEAK_COUNT));
        const peaks: number[] = new Array(PEAK_COUNT);
        for (let i = 0; i < PEAK_COUNT; i++) {
          const start = i * blockSize;
          let max = 0;
          const end = Math.min(start + blockSize, channel.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > max) max = v;
          }
          peaks[i] = max;
        }
        // Normalize
        const peak = peaks.reduce((m, v) => (v > m ? v : m), 0) || 1;
        for (let i = 0; i < peaks.length; i++) peaks[i] = peaks[i] / peak;

        const data: WaveformData = {
          peaks,
          durationSec: audio.duration,
          generatedAt: Date.now(),
        };
        memoryCache.set(key, data);
        try {
          await idbSet(key, data, store);
        } catch {}
        return data;
      } finally {
        try {
          await ctx.close();
        } catch {}
      }
    } catch (e) {
      console.warn("[tempokey] waveform generation failed", e);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
