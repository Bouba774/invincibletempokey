# Data Safety — answers for the Google Play form

The Data Safety questionnaire on Google Play Console asks, for each data type,
whether the app **collects**, **shares**, and what the data is **used for**.
TempoKey runs entirely on-device, so the answers are extremely simple.

## Summary

> TempoKey does **not** collect or share any user data.
> Audio files, analysis results and preferences stay on the device.

## Section-by-section answers

### Data collection & sharing

| Question                                                           | Answer |
| ------------------------------------------------------------------ | ------ |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | N/A — no data leaves the device |
| Do you provide a way for users to request that their data be deleted? | **Yes** — Settings → Cache → Clear all |

### Personal info / Financial info / Health / Messages / Photos / Audio files / Files & docs / Calendar / Contacts / App activity / Web browsing / App info & performance / Device or other IDs

For each of the above categories:

| Question        | Answer |
| --------------- | ------ |
| Collected?      | **No** |
| Shared?         | **No** |

### On-device processing (declared but not "collected")

The following processing happens on the device only and is **not considered
"collection"** under the Play Store policy (no server-side transmission):

- Reading audio files chosen by the user, to compute BPM / key / Camelot /
  energy / waveforms.
- Storing the resulting analysis in the app's private sandbox (IndexedDB).
- Persisting UI preferences (theme, sort, filters) in `localStorage`.

### Optional, off-by-default features

If the user **explicitly opts in** from Settings → Privacy:

| Feature        | Data type            | Purpose            | Shared with                       |
| -------------- | -------------------- | ------------------ | --------------------------------- |
| Analytics      | Aggregated, anonymous event names (no file names, no audio) | Analytics  | (none in v1.0.0 — placeholder only) |
| Crash reports  | Stack traces, device model, OS version | Diagnostics | (none in v1.0.0 — placeholder only) |

In v1.0.0 these toggles are wired through `src/lib/analytics-store.ts` but do
**not** dispatch to any third party. Before enabling a real provider
(Firebase Crashlytics, Sentry, …), update the Data Safety form **and** the
privacy policy to reflect the new collection.

## Security practices

- Data is **not transmitted off-device**, so encryption in transit is N/A.
- App private storage on Android is encrypted by the platform at rest.
- The app does not request risky permissions (location, mic, contacts, SMS).

## Deletion

Users can delete all locally stored data at any time:

- **Settings → Cache → Clear all** removes analysis cache, waveforms and
  derived data.
- Uninstalling the app removes the app sandbox entirely.

There is no server-side data to delete because no server-side data exists.
