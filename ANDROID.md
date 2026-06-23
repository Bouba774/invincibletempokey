# TempoKey — Android packaging

TempoKey is packaged for Android using [Capacitor](https://capacitorjs.com/).
The web app (TanStack Start + Vite) is built as usual, then bundled into a
native Android shell. The pipeline produces both an **APK** (for sideloading
& QA) and an **AAB** (for Google Play).

> The Android project (`/android`) is **generated on demand** by
> `scripts/prepare-android.sh`. It is not committed to keep the repo clean.

---

## App identity

| Field         | Value                  |
| ------------- | ---------------------- |
| App name      | TempoKey               |
| Application ID| `app.lovable.tempokey` |
| Orientation   | Portrait (default), tablet supported |
| Splash color  | `#0A0D14`              |
| Min SDK       | 23 (Android 6.0)       |
| Target SDK    | 34 (Android 14)        |

Adaptive icon, round icon and all mipmap buckets (`mdpi` → `xxxhdpi`) are
auto-generated from the official TempoKey logo via `@capacitor/assets`.

---

## Local build

Requirements:

- Node 20+
- JDK 17 (Temurin recommended)
- Android SDK + platform-tools (Android Studio handles this)
- `ANDROID_HOME` exported

```bash
# One-shot: build web, stage assets, generate icons/splash, sync Capacitor
bash scripts/prepare-android.sh

# Optional: stamp a version
bash scripts/android-version.sh 2 1.0.1

# Build a debug APK
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Build a release APK (needs signing config — see below)
./gradlew assembleRelease

# Build a release AAB (Play Store)
./gradlew bundleRelease
```

Open in Android Studio:

```bash
npx cap open android
```

---

## Release signing

Signing is **optional in CI** — without a keystore the workflow still produces
a debug APK so QA can keep moving.

1. Generate a keystore once:
   ```bash
   keytool -genkey -v -keystore tempokey.keystore \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias tempokey
   ```
2. Base64-encode it:
   ```bash
   base64 -w0 tempokey.keystore > tempokey.keystore.b64
   ```
3. Add the following **GitHub Secrets** to the repository:
   - `ANDROID_KEYSTORE` — contents of `tempokey.keystore.b64`
   - `ANDROID_KEY_ALIAS` — e.g. `tempokey`
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_STORE_PASSWORD`

The workflow detects these secrets and automatically configures
`signingConfigs.release` + enables `minifyEnabled` and `shrinkResources`.

---

## GitHub Actions

Workflow: `.github/workflows/android-release.yml`

Triggers:

- `push` on `main`
- Manual `workflow_dispatch` (lets you pass `versionName` / `versionCode`)

Outputs (uploaded as workflow artifacts):

- `TempoKey-APK-v<version>` — `artifacts/apk/TempoKey-v<version>-{debug,release}.apk`
- `TempoKey-AAB-v<version>` — `artifacts/aab/TempoKey-v<version>.aab`

The pipeline is intentionally **resilient**:

- TypeScript / lint issues are reported as warnings, never block the build.
- If release signing isn't configured, the release step falls back to debug.
- If the AAB build fails (e.g. unsigned), the workflow still publishes the APK.

---

## Permissions

Only the permissions actually required by TempoKey are declared:

- `INTERNET` — required by Capacitor's WebView bridge.
- `READ_MEDIA_AUDIO` (Android 13+) / `READ_EXTERNAL_STORAGE` (≤12) — to let
  the user pick a music folder for the library.

No location, no microphone, no contacts, no background services.

---

## Storage & file access

TempoKey uses the **scoped, modern Android storage APIs** via Capacitor's
`Filesystem` plugin and the standard `<input type="file" webkitdirectory>`
flow handled by the WebView. This works on Android 10+ without legacy
`requestLegacyExternalStorage` flags.

All analysis data is kept locally (IndexedDB inside the WebView). No cloud,
no account, no network calls for the core flow.

---

## Versioning

`versionCode` and `versionName` are stamped at build time by
`scripts/android-version.sh`. In CI the defaults are:

- `versionName` → workflow input or `1.0.0`
- `versionCode` → workflow input or `github.run_number`

Bumping locally:

```bash
bash scripts/android-version.sh 3 1.0.2
```

---

## Troubleshooting

- **`SDK location not found`** locally → install Android Studio and set
  `ANDROID_HOME` (typically `~/Library/Android/sdk` or `~/Android/Sdk`).
- **Blank screen on launch** → make sure `dist/android/index.html` exists
  after `prepare-android.sh`; rerun the script.
- **Icon looks cropped** → replace `resources/icon.png` with a 1024×1024
  PNG and rerun `npx @capacitor/assets generate --android`.
