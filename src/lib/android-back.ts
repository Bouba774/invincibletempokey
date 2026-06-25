/**
 * Centralized Android hardware back-button manager.
 *
 * Goals:
 *  - One single `App.backButton` listener for the whole app (no duplicates).
 *  - LIFO stack of handlers registered by components via `useBackHandler`.
 *  - Built-in fallbacks that mimic a native Android app:
 *      1. If the soft keyboard is visible -> hide it.
 *      2. If a Radix overlay is open (dialog/sheet/menu/popover) -> dispatch
 *         Escape so Radix closes it (single source of truth, no per-component
 *         wrapping needed).
 *      3. If the router can navigate back -> history.back().
 *      4. On the root route -> "press back again to quit" toast within 2s,
 *         then `App.exitApp()`.
 *
 * Web preview is a no-op (Capacitor.isNativePlatform() === false).
 */
import { toast } from "sonner";

export type BackHandler = () => boolean | void | Promise<boolean | void>;

const stack: BackHandler[] = [];
let initialised = false;
let lastExitPromptAt = 0;

// Hide Capacitor module specifiers from the web bundler (rolldown). The
// packages are only installed during the Android build pipeline; on the web
// these resolve to `null` and the whole module is a no-op.
const dynImport = (name: string): Promise<any> =>
  (0, eval)(`import(${JSON.stringify(name)})`);
const safeImport = (name: string): Promise<any> =>
  dynImport(name).catch(() => null);

export function pushBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

function hasOpenRadixOverlay(): boolean {
  // Radix sets data-state="open" on Dialog/Sheet/AlertDialog/DropdownMenu/
  // Popover/Select/Tooltip content nodes. We only react to interactive ones.
  const selectors = [
    '[role="dialog"][data-state="open"]',
    '[role="alertdialog"][data-state="open"]',
    '[role="menu"][data-state="open"]',
    '[role="listbox"][data-state="open"]',
    '[data-radix-popper-content-wrapper] [data-state="open"]',
  ];
  return !!document.querySelector(selectors.join(","));
}

function dispatchEscape() {
  const ev = new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(ev);
}

async function defaultBack(canGoBack: boolean): Promise<void> {
  // 1) Open overlay → close it via Escape (Radix handles all primitives).
  if (hasOpenRadixOverlay()) {
    dispatchEscape();
    return;
  }
  // 2) Router history → back, but only when we're not on the root route.
  //    On the home screen, Android's expected behaviour is "double-tap to
  //    quit" — never silently rewind a stale browser history entry, which
  //    on a single-page app would either land on an empty state or crash
  //    the WebView when the popped state references unmounted components.
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const atRoot = pathname === "/" || pathname === "" || pathname === "/index.html";
  if (!atRoot && canGoBack && window.history.length > 1) {
    try {
      window.history.back();
    } catch {
      /* swallow — fall through to exit prompt */
    }
    return;
  }
  // 3) Root → double-press to exit.
  const now = Date.now();
  if (now - lastExitPromptAt < 2000) {
    const cap = await safeImport("@capacitor/app");
    cap?.App?.exitApp?.().catch?.(() => {});
    return;
  }
  lastExitPromptAt = now;
  toast("Appuyez encore une fois pour quitter TempoKey", { duration: 2000 });
}

export async function initAndroidBack(): Promise<void> {
  if (initialised) return;
  initialised = true;

  const core = await safeImport("@capacitor/core");
  if (!core?.Capacitor?.isNativePlatform?.()) return;

  const appMod = await safeImport("@capacitor/app");
  const kbMod = await safeImport("@capacitor/keyboard");

  // Track keyboard visibility — first back press should dismiss the keyboard.
  let keyboardVisible = false;
  kbMod?.Keyboard?.addListener?.("keyboardWillShow", () => {
    keyboardVisible = true;
  }).catch?.(() => {});
  kbMod?.Keyboard?.addListener?.("keyboardWillHide", () => {
    keyboardVisible = false;
  }).catch?.(() => {});

  appMod?.App?.addListener?.("backButton", async ({ canGoBack }: { canGoBack: boolean }) => {
    try {
      // a) Keyboard first.
      if (keyboardVisible && kbMod?.Keyboard?.hide) {
        await kbMod.Keyboard.hide().catch(() => {});
        return;
      }
      // b) Walk component handler stack (LIFO).
      for (let i = stack.length - 1; i >= 0; i--) {
        const fn = stack[i];
        try {
          const r = await fn();
          if (r === true) return;
        } catch {
          /* keep walking on handler failure */
        }
      }
      // c) Fallbacks.
      await defaultBack(!!canGoBack);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[TempoKey] backButton handler failed", err);
    }
  }).catch?.(() => {});
}