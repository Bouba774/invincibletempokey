/**
 * Android audio-file permission helper for TempoKey.
 *
 * Strategy:
 *  - On web: no-op, always "granted" (browser file picker handles consent).
 *  - On native Android: declare READ_MEDIA_AUDIO (API 33+) and
 *    READ_EXTERNAL_STORAGE (API ≤ 32) in the manifest so they show up in
 *    App Info → Permissions. Try a runtime request via the optional
 *    `@capacitor/filesystem` plugin so older Androids surface a prompt.
 *    On newer Androids the system file picker (SAF) does not require a
 *    runtime grant; we still gate the import behind a Material-style
 *    dialog for transparency.
 *
 * No business logic is touched — this only mediates the consent UX.
 */

export type AudioPermissionStatus = "granted" | "denied" | "blocked" | "unsupported";

const PERSIST_KEY = "tempokey.audio-permission.granted";

// Hide Capacitor module specifiers from the web bundler (rolldown). The
// packages are only installed during the Android build pipeline.
const dynImport = (name: string): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  (0, eval)(`import(${JSON.stringify(name)})`);
const safeImport = (name: string): Promise<any> =>
  dynImport(name).catch(() => null);

export async function isNativeAndroid(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const mod = await safeImport("@capacitor/core");
  const Capacitor = mod?.Capacitor;
  if (!Capacitor?.isNativePlatform?.()) return false;
  return Capacitor.getPlatform?.() === "android";
}

export function hasPersistedGrant(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PERSIST_KEY) === "1";
  } catch {
    return false;
  }
}

function persistGrant() {
  try {
    window.localStorage.setItem(PERSIST_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Request the Android audio-file access permission. Returns "granted" when
 * the user accepts (or when no runtime grant is needed, e.g. SAF picker),
 * "denied" when the user declines once, and "blocked" when Android marks
 * the permission as never-ask-again.
 */
export async function requestAudioPermission(): Promise<AudioPermissionStatus> {
  if (!(await isNativeAndroid())) return "granted";

  const fs = await safeImport("@capacitor/filesystem");
  const Filesystem = fs?.Filesystem;
  if (!Filesystem?.requestPermissions) {
    // Plugin missing — SAF picker still works, treat as granted.
    persistGrant();
    return "granted";
  }

  try {
    const current = await Filesystem.checkPermissions().catch(() => null);
    const currentState = current?.publicStorage;
    if (currentState === "granted") {
      persistGrant();
      return "granted";
    }

    const res = await Filesystem.requestPermissions();
    const state = res?.publicStorage as string | undefined;
    if (state === "granted") {
      persistGrant();
      return "granted";
    }
    if (state === "denied") return "blocked"; // Android maps never-ask-again to "denied"
    return "denied";
  } catch {
    // Permission API not available on this Android version — SAF still works.
    persistGrant();
    return "granted";
  }
}

/**
 * Best-effort: open the TempoKey app settings page on Android so the user
 * can re-enable a blocked permission. Falls back to a no-op on the web.
 */
export async function openAndroidAppSettings(): Promise<boolean> {
  if (!(await isNativeAndroid())) return false;
  const mod = await safeImport("@capacitor/app");
  const App = mod?.App;
  // @capacitor/app exposes openUrl which accepts intent:// URIs on Android.
  if (!App?.openUrl) return false;
  try {
    // Settings.ACTION_APPLICATION_DETAILS_SETTINGS for our package.
    await App.openUrl({
      url: "package:app.lovable.tempokey",
    });
    return true;
  } catch {
    return false;
  }
}