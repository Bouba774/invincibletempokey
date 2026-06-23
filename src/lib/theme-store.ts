import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "tempokey:theme";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  hydrated: boolean;
  setMode: (m: ThemeMode) => void;
  hydrate: () => void;
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return true;
  }
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function applyThemeClass(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "dark";
}

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function attachSystemListener(active: boolean) {
  if (typeof window === "undefined") return;
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return;
  }
  if (mediaListener) {
    try {
      mq.removeEventListener("change", mediaListener);
    } catch {}
    mediaListener = null;
  }
  if (!active) return;
  mediaListener = (e) => {
    const resolved = e.matches ? "dark" : "light";
    applyThemeClass(resolved);
    useThemeStore.setState({ resolved });
  };
  try {
    mq.addEventListener("change", mediaListener);
  } catch {}
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  resolved: "dark",
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const mode = readStored();
    const resolved = resolveMode(mode);
    applyThemeClass(resolved);
    attachSystemListener(mode === "system");
    set({ mode, resolved, hydrated: true });
  },

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    const resolved = resolveMode(mode);
    applyThemeClass(resolved);
    attachSystemListener(mode === "system");
    set({ mode, resolved });
  },
}));
