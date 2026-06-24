import { Capacitor, registerPlugin } from "@capacitor/core";

export interface AnalysisNotificationPlugin {
  start(opts: { total: number; title?: string }): Promise<{ ok: boolean }>;
  update(opts: { done: number; total: number; currentTitle?: string }): Promise<{ ok: boolean }>;
  finish(opts: { ok: boolean; message?: string }): Promise<{ ok: boolean }>;
  cancel(): Promise<{ ok: boolean }>;
  getCurrentState(): Promise<{ running: boolean; done: number; total: number }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
}

const Native = registerPlugin<AnalysisNotificationPlugin>("AnalysisNotification");

function isAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

const noop = async () => ({ ok: true });

export const analysisNotification = {
  async start(total: number, title?: string): Promise<void> {
    if (!isAndroid()) return;
    try {
      await Native.requestNotificationPermission();
      await Native.start({ total, title });
    } catch {
      /* notif failure must never break analysis */
    }
  },
  async update(done: number, total: number, currentTitle?: string): Promise<void> {
    if (!isAndroid()) return;
    try {
      await Native.update({ done, total, currentTitle });
    } catch {
      /* ignore */
    }
  },
  async finish(ok: boolean, message?: string): Promise<void> {
    if (!isAndroid()) return;
    try {
      await Native.finish({ ok, message });
    } catch {
      /* ignore */
    }
  },
  async cancel(): Promise<void> {
    if (!isAndroid()) return;
    try {
      await Native.cancel();
    } catch {
      /* ignore */
    }
  },
};

export { Native as AnalysisNotificationNative };

// Fallback no-op references to keep tree-shaking happy on web builds.
void noop;
