// Lazy singleton wrapper around Essentia.js (WASM).
//
// Essentia.js is a ~5–10 MB WebAssembly bundle, so we load it on demand,
// only the first time the analyser actually needs it. All subsequent
// analyses reuse the same instance to avoid re-instantiating WASM.
//
// The whole module is intentionally defensive: every public entry point
// can return `null`, which causes the analyser to gracefully fall back to
// the pure-JS estimators that ship with the app. This keeps TempoKey
// working even when the WASM blob fails to load (corporate proxies, very
// old WebViews, etc.).

interface EssentiaVector {
  size(): number;
  get(i: number): number;
  delete?(): void;
}

interface EssentiaInstance {
  arrayToVector(arr: Float32Array): EssentiaVector;
  vectorToArray(v: EssentiaVector): Float32Array;
  RhythmExtractor2013(
    signal: EssentiaVector,
    maxTempo?: number,
    method?: "multifeature" | "degara",
    minTempo?: number,
  ): {
    bpm: number;
    confidence: number;
    ticks: EssentiaVector;
    estimates: EssentiaVector;
    bpmIntervals: EssentiaVector;
  };
  KeyExtractor(
    audio: EssentiaVector,
    averageDetuningCorrection?: boolean,
    frameSize?: number,
    hopSize?: number,
    hpcpSize?: number,
    maxFrequency?: number,
    maximumSpectralPeaks?: number,
    minFrequency?: number,
    pcpThreshold?: number,
    profileType?: string,
    sampleRate?: number,
    spectralPeaksThreshold?: number,
    tuningFrequency?: number,
    weightType?: string,
    windowType?: string,
  ): { key: string; scale: "major" | "minor"; strength: number };
  PercivalBpmEstimator(
    signal: EssentiaVector,
    frameSize?: number,
    frameSizeOSS?: number,
    hopSize?: number,
    hopSizeOSS?: number,
    maxBPM?: number,
    minBPM?: number,
    sampleRate?: number,
  ): { bpm: number };
  shutdown?(): void;
}

let instance: EssentiaInstance | null = null;
let pending: Promise<EssentiaInstance | null> | null = null;
let permanentlyFailed = false;

async function loadEssentia(): Promise<EssentiaInstance | null> {
  if (permanentlyFailed) return null;
  if (typeof window === "undefined") return null;
  try {
    const [wasmMod, coreMod] = await Promise.all([
      import(/* @vite-ignore */ "essentia.js/dist/essentia-wasm.es.js"),
      import(/* @vite-ignore */ "essentia.js/dist/essentia.js-core.es.js"),
    ]);
    const wasm = (wasmMod as { EssentiaWASM: unknown }).EssentiaWASM as {
      onRuntimeInitialized?: () => void;
      calledRun?: boolean;
      EssentiaJS?: unknown;
    };
    if (!wasm) throw new Error("EssentiaWASM export missing");
    // Wait for Emscripten runtime to be ready. The reliable signal that the
    // module is usable is the presence of `EssentiaJS` on the WASM module.
    if (!wasm.EssentiaJS && !wasm.calledRun) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("Essentia WASM init timeout")),
          30000,
        );
        const prev = wasm.onRuntimeInitialized;
        wasm.onRuntimeInitialized = () => {
          clearTimeout(t);
          try {
            prev?.();
          } catch { /* ignore */ }
          resolve();
        };
        // Edge case: flipped between the check and our handler.
        if (wasm.EssentiaJS || wasm.calledRun) {
          clearTimeout(t);
          resolve();
        }
        // Defensive poll – some Emscripten builds don't fire the callback
        // when the module was already initialised by a previous import.
        const poll = setInterval(() => {
          if (wasm.EssentiaJS || wasm.calledRun) {
            clearInterval(poll);
            clearTimeout(t);
            resolve();
          }
        }, 100);
      });
    }
    const EssentiaCtor = (coreMod as { default: new (m: unknown) => EssentiaInstance }).default;
    const inst = new EssentiaCtor(wasm);
    // eslint-disable-next-line no-console
    console.info("[essentia] WASM engine ready");
    return inst;
  } catch (e) {
    permanentlyFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[essentia] failed to load, falling back to pure-JS engine:", e);
    return null;
  }
}

export async function getEssentia(): Promise<EssentiaInstance | null> {
  if (instance) return instance;
  if (!pending) pending = loadEssentia().then((v) => (instance = v));
  return pending;
}

export function essentiaAvailable(): boolean {
  return instance !== null;
}

/** Safely free Essentia output vectors (silent on no-op). */
export function freeVectors(...vs: (EssentiaVector | null | undefined)[]): void {
  for (const v of vs) {
    try {
      v?.delete?.();
    } catch {
      // ignore
    }
  }
}

export type { EssentiaInstance, EssentiaVector };