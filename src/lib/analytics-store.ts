import { create } from "zustand";

/**
 * Analytics & crash-reporting opt-in store.
 *
 * TempoKey ships with **zero analytics enabled by default**. The user must
 * explicitly opt-in from the Settings page. Even when enabled, no audio
 * content, no file names and no library data ever leaves the device — only
 * anonymous, aggregated event names (e.g. "analyze_started", "export_m3u").
 *
 * This module is intentionally a thin abstraction so a real provider
 * (Firebase Crashlytics, Plausible, PostHog, …) can be wired in later
 * without touching call sites.
 */

const KEY = "tempokey:privacy:v1";

export interface PrivacyPrefs {
  /** Anonymous product analytics (event names only, no PII). */
  analytics: boolean;
  /** Anonymous crash reports (stack traces, no audio / file data). */
  crashReports: boolean;
  /** True once the user has seen and answered the consent prompt. */
  consentGiven: boolean;
}

const DEFAULT: PrivacyPrefs = {
  analytics: false,
  crashReports: false,
  consentGiven: false,
};

function read(): PrivacyPrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<PrivacyPrefs>) };
  } catch {
    return DEFAULT;
  }
}

function write(p: PrivacyPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

interface State extends PrivacyPrefs {
  hydrated: boolean;
  hydrate: () => void;
  set: (patch: Partial<PrivacyPrefs>) => void;
  acceptAll: () => void;
  declineAll: () => void;
}

export const usePrivacyStore = create<State>((set, get) => ({
  ...DEFAULT,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...read(), hydrated: true });
  },
  set: (patch) => {
    const next = { ...get(), ...patch, consentGiven: true };
    write({
      analytics: next.analytics,
      crashReports: next.crashReports,
      consentGiven: true,
    });
    set(next);
  },
  acceptAll: () => get().set({ analytics: true, crashReports: true }),
  declineAll: () => get().set({ analytics: false, crashReports: false }),
}));

/** No-op tracker. Replace with a real provider when/if integrated. */
export function track(event: string, props?: Record<string, unknown>) {
  const { analytics } = usePrivacyStore.getState();
  if (!analytics) return;
  // Hook a real provider here.
  if (typeof console !== "undefined") {
    console.debug("[analytics]", event, props ?? {});
  }
}
