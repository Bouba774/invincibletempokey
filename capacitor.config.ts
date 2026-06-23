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
    // IMPORTANT: ne pas FORCER l'edge-to-edge. Sur Android 15+ il est déjà
    // imposé par le système (et Capacitor injecte automatiquement les safe
    // areas) ; sur Android < 15 le `force` combiné à `overlaysWebView`
    // décale le hit-testing tactile, ce qui rendait inutilisables les
    // overlays (sheet "Détails", champ de template, champ de recherche)
    // tant que l'utilisateur n'avait pas relancé l'app.
    adjustMarginsForEdgeToEdge: "auto",
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
      // La WebView NE recouvre PAS la status bar : l'activité native gère
      // l'inset top, donc les coordonnées tactiles dans la WebView restent
      // alignées avec ce qui est dessiné. Combiné à `overlaysWebView:true`,
      // le WebView Android freeze le tap sur les overlays plein écran
      // (sheet "Détails", champs de saisie) — bug reproductible sur de
      // nombreuses versions de System WebView.
      overlaysWebView: false,
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
