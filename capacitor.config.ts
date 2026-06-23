import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the native Android wrapper around TempoKey.
 * The web app keeps its existing TanStack Start build; Capacitor only packages
 * the client output into an Android shell.
 *
 * webDir points to the static client bundle produced by `vite build` (the
 * Android workflow copies the SSR client assets into `dist/android` before
 * running `cap sync`).
 */
const config: CapacitorConfig = {
  appId: "app.lovable.tempokey",
  appName: "TempoKey",
  webDir: "dist/android",
  backgroundColor: "#0A0D14",
  android: {
    allowMixedContent: false,
    // Important Android WebView stability fix:
    // Capacitor's alternative InputConnection (`captureInput`) can freeze the
    // WebView on text fields / focus-heavy UI. Keep the native default path.
    captureInput: false,
    // Do not force-focus the WebView on launch; focus is applied only after a
    // user action, which avoids Android focus/keyboard deadlocks around panels.
    initialFocus: false,
    webContentsDebuggingEnabled: false,
    // Edge-to-edge moderne (Android 15+ obligatoire) : la WebView s'étend
    // sous les barres système ; nous gérons les safe areas en CSS via
    // env(safe-area-inset-*).
    adjustMarginsForEdgeToEdge: "force",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Couche transparente — la WebView dessine derrière la status bar.
      // Le style (icônes claires/sombres) est piloté depuis main.tsx
      // en suivant le thème TempoKey (clair/sombre).
      overlaysWebView: true,
      style: "DEFAULT",
      backgroundColor: "#00000000",
    },
    Keyboard: {
      // Android WebView stability: keep input focus on the native resize path.
      // This avoids fullscreen/edge-to-edge keyboard relayout deadlocks when
      // the user taps search fields or the custom rename template field.
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
