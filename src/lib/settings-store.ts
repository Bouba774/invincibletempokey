import { create } from "zustand";

const RENAME_KEY = "tempokey:settings:rename";
const PLAYER_KEY = "tempokey:settings:player";

export interface RenameSettings {
  cleanPrefixes: boolean;
  keepBackup: boolean;
  detectConflicts: boolean;
}

export interface PlayerSettings {
  defaultVolume: number; // 0..1
  preloadWaveforms: boolean;
  autoplay: boolean;
}

const DEFAULT_RENAME: RenameSettings = {
  cleanPrefixes: true,
  keepBackup: true,
  detectConflicts: true,
};

const DEFAULT_PLAYER: PlayerSettings = {
  defaultVolume: 0.85,
  preloadWaveforms: true,
  autoplay: false,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

interface SettingsState {
  rename: RenameSettings;
  player: PlayerSettings;
  hydrated: boolean;
  hydrate: () => void;
  setRename: (patch: Partial<RenameSettings>) => void;
  setPlayer: (patch: Partial<PlayerSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  rename: DEFAULT_RENAME,
  player: DEFAULT_PLAYER,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      rename: read(RENAME_KEY, DEFAULT_RENAME),
      player: read(PLAYER_KEY, DEFAULT_PLAYER),
      hydrated: true,
    });
  },

  setRename: (patch) => {
    const next = { ...get().rename, ...patch };
    write(RENAME_KEY, next);
    set({ rename: next });
  },

  setPlayer: (patch) => {
    const next = { ...get().player, ...patch };
    write(PLAYER_KEY, next);
    set({ player: next });
  },
}));
