# Android resources

This folder holds the source assets the Android build pipeline uses to
generate launcher icons, the adaptive icon, the round icon and the splash
screen for TempoKey.

The GitHub Actions workflow (`.github/workflows/android-release.yml`)
downloads the TempoKey logo from the project's CDN at build time and writes
it to `resources/icon.png` and `resources/splash.png`, then runs
`@capacitor/assets generate --android`. That tool produces all mipmap
buckets (`mdpi` → `xxxhdpi`), the adaptive icon foreground/background
layers, the round icon and the splash drawables.

Brand palette:

- Background: `#0A0D14`
- Foreground: TempoKey logo (centered, 1024×1024 source)

You generally don't need to edit anything here — the workflow regenerates
the assets on every build. If you want to override the source logo
permanently, replace `logo.png` (or upload a new asset via the Lovable
assets pipeline and update the workflow URL).
