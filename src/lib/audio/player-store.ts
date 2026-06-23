import { create } from "zustand";
import { useLibraryStore, type Track } from "@/lib/library-store";
import {
  getSafUri,
  isCapacitorAndroid,
  restoreFilesForLibrary,
} from "@/lib/native/folder-picker";

/**
 * Map a file extension or arbitrary mime hint to a MIME type the Android
 * WebView's MediaCodec can actually decode. The Blob URL path is sensitive
 * to the declared type — feeding an .m4a/.wav/.flac stream as "audio/mpeg"
 * makes the decoder bail out with MEDIA_ERR_SRC_NOT_SUPPORTED ("Impossible
 * de lire ce fichier"). We normalize on extension first because SAF often
 * returns an empty mime, and "audio/mpeg" as a default is actively harmful.
 */
function inferAudioMime(name: string, hinted?: string | null): string {
  const lower = (name || "").toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "opus":
      return "audio/ogg; codecs=opus";
    case "webm":
      return "audio/webm";
    case "aiff":
    case "aif":
      return "audio/aiff";
    case "wma":
      return "audio/x-ms-wma";
    default:
      // Last resort: trust the hint only if it looks like an audio mime;
      // otherwise leave the type empty so the WebView sniffs the bytes.
      if (hinted && /^audio\//i.test(hinted)) return hinted;
      return "";
  }
}

interface PlayerState {
  currentId: string | null;
  currentTitle: string | null;
  durationSec: number;
  positionSec: number;
  volume: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  play: (track: Track) => Promise<void>;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (sec: number) => void;
  seekRatio: (ratio: number) => void;
  setVolume: (v: number) => void;
}

let audio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("timeupdate", () => {
    usePlayerStore.setState({ positionSec: audio!.currentTime });
  });
  audio.addEventListener("durationchange", () => {
    if (Number.isFinite(audio!.duration)) {
      usePlayerStore.setState({ durationSec: audio!.duration });
    }
  });
  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio!.duration)) {
      usePlayerStore.setState({ durationSec: audio!.duration });
    }
  });
  audio.addEventListener("ended", () => {
    usePlayerStore.setState({ isPlaying: false, positionSec: 0 });
  });
  audio.addEventListener("playing", () => {
    usePlayerStore.setState({ isPlaying: true, isLoading: false });
  });
  audio.addEventListener("pause", () => {
    usePlayerStore.setState({ isPlaying: false });
  });
  audio.addEventListener("error", () => {
    usePlayerStore.setState({
      isPlaying: false,
      isLoading: false,
      error: "Impossible de lire ce fichier.",
    });
  });
  audio.addEventListener("waiting", () => {
    usePlayerStore.setState({ isLoading: true });
  });
  audio.addEventListener("canplay", () => {
    usePlayerStore.setState({ isLoading: false });
  });
  return audio;
}

function releaseUrl() {
  if (currentUrl) {
    try {
      URL.revokeObjectURL(currentUrl);
    } catch {}
    currentUrl = null;
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentId: null,
  currentTitle: null,
  durationSec: 0,
  positionSec: 0,
  volume: 0.85,
  isPlaying: false,
  isLoading: false,
  error: null,

  play: async (track) => {
    const file = useLibraryStore.getState().getFile(track.id);
    if (!file) {
      set({
        error:
          "Fichier audio indisponible — réimporte le dossier pour activer la pré-écoute.",
        currentId: track.id,
        currentTitle: track.title,
        isPlaying: false,
        isLoading: false,
        durationSec: track.durationSec ?? 0,
        positionSec: 0,
      });
      return;
    }
    const a = ensureAudio();
    // If same track, just resume from current position
    if (get().currentId === track.id && currentUrl) {
      try {
        await a.play();
      } catch {}
      return;
    }
    try {
      a.pause();
    } catch {}
    releaseUrl();
    // On Android SAF-backed files, the underlying Blob bytes are empty —
    // the bytes live behind `content://` and are streamed via the native
    // plugin. Fetch the full buffer once and wrap it in a real Blob so the
    // <audio> element can play it.
    const safUri = getSafUri(file);
    if (safUri) {
      set({
        currentId: track.id,
        currentTitle: track.title,
        durationSec: track.durationSec ?? 0,
        positionSec: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
      });
      try {
        const buf = await file.arrayBuffer();
        const blob = new Blob([buf], { type: file.type || "audio/mpeg" });
        currentUrl = URL.createObjectURL(blob);
        a.src = currentUrl;
        a.volume = get().volume;
        await a.play();
      } catch (e) {
        console.warn("[tempokey] saf play failed", e);
        set({
          isPlaying: false,
          isLoading: false,
          error: "Impossible de lire ce fichier.",
        });
      }
      return;
    }
    currentUrl = URL.createObjectURL(file);
    a.src = currentUrl;
    a.volume = get().volume;
    set({
      currentId: track.id,
      currentTitle: track.title,
      durationSec: track.durationSec ?? 0,
      positionSec: 0,
      isPlaying: false,
      isLoading: true,
      error: null,
    });
    try {
      await a.play();
    } catch (e) {
      console.warn("[tempokey] audio play failed", e);
      set({ isPlaying: false, isLoading: false });
    }
  },

  toggle: () => {
    const a = audio;
    if (!a || !get().currentId) return;
    if (a.paused) {
      void a.play().catch(() => {});
    } else {
      a.pause();
    }
  },

  pause: () => {
    audio?.pause();
  },
  resume: () => {
    if (audio && get().currentId) void audio.play().catch(() => {});
  },
  stop: () => {
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch {}
    }
    releaseUrl();
    set({
      currentId: null,
      currentTitle: null,
      isPlaying: false,
      isLoading: false,
      positionSec: 0,
      durationSec: 0,
      error: null,
    });
  },
  seek: (sec) => {
    if (!audio) return;
    const d = get().durationSec || audio.duration || 0;
    const clamped = Math.max(0, Math.min(d || sec, sec));
    try {
      audio.currentTime = clamped;
      set({ positionSec: clamped });
    } catch {}
  },
  seekRatio: (ratio) => {
    const d = get().durationSec || audio?.duration || 0;
    if (!d) return;
    get().seek(d * Math.max(0, Math.min(1, ratio)));
  },
  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    if (audio) audio.volume = vol;
    set({ volume: vol });
  },
}));

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
