/**
 * Android audio-file permission helper for TempoKey.
 *
 * Strategy:
 *  - On web: no-op, always "granted" (browser file picker handles consent).
 *  - On native Android: declare READ_MEDIA_AUDIO (API 33+) and
 *    READ_EXTERNAL_STORAGE (API ≤ 32) in the manifest so they show up in
 *    App Info → Permissions. The custom native FolderPicker plugin owns the
 *    real runtime request because Android 13+ requires READ_MEDIA_AUDIO,
 *    while Capacitor Filesystem only exposes the older publicStorage alias.
 *
 * No business logic is touched — this only mediates the consent UX.
 */

import { FolderPicker } from "@/lib/native/folder-picker";

export type AudioPermissionStatus = "granted" | "denied" | "blocked" | "unsupported";

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

/**
 * Request the Android audio-file access permission exactly when the user
 * starts the first library import. Returns "granted" when the user accepts,
 * "denied" when the user declines once, and "blocked" when Android marks the
 * permission as never-ask-again.
 */
export async function requestAudioPermission(): Promise<AudioPermissionStatus> {
  if (!(await isNativeAndroid())) return "granted";

  if (!FolderPicker?.requestAudioPermission) {
    // Plugin missing in web/dev; keep local preview usable. In the APK the
    // native plugin is required and will show Android's real runtime dialog.
    return "granted";
  }

  try {
    const current = await FolderPicker.checkAudioPermission().catch(() => null);
    const currentState = current?.state;
    if (currentState === "granted") {
      return "granted";
    }

    const res = await FolderPicker.requestAudioPermission();
    const state = res?.state as AudioPermissionStatus | undefined;
    if (state === "granted") {
      return "granted";
    }
    if (state === "blocked") return "blocked";
    if (state === "unsupported") {
      return "granted";
    }
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Best-effort: open the TempoKey app settings page on Android so the user
 * can re-enable a blocked permission. Falls back to a no-op on the web.
 */
export async function openAndroidAppSettings(): Promise<boolean> {
  if (!(await isNativeAndroid())) return false;
  try {
    const res = await FolderPicker.openAppSettings();
    return res?.opened === true;
  } catch {
    return false;
  }
}