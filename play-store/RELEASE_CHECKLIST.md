# TempoKey — Google Play release checklist

Use this checklist before promoting a build from **internal → closed → open → production**.

## 1. Build & signing

- [ ] `bash scripts/prepare-android.sh` runs clean from a fresh checkout
- [ ] `bash scripts/android-version.sh <code> <name>` stamps the new version
- [ ] `versionCode` strictly greater than the previous Play Store release
- [ ] Release keystore present (locally or as GitHub secret `ANDROID_KEYSTORE`)
- [ ] `./gradlew bundleRelease` produces a signed `.aab`
- [ ] `./gradlew assembleRelease` produces a signed `.apk` for sideload QA
- [ ] AAB size < 150 MB (Play Store hard limit)

## 2. App manifest & target

- [ ] `applicationId` = `app.lovable.tempokey`
- [ ] `targetSdkVersion` ≥ 34 (Play Store requirement for 2026)
- [ ] `minSdkVersion` = 23 (Android 6.0)
- [ ] Permissions limited to `INTERNET` + `READ_MEDIA_AUDIO` (+ legacy `READ_EXTERNAL_STORAGE` for ≤ Android 12)
- [ ] No exported activities other than the main launcher
- [ ] `android:allowBackup="false"` (no accidental cloud backup of user data)

## 3. Visual identity

- [ ] Adaptive icon renders correctly in all launchers (Pixel, Samsung, MIUI)
- [ ] Round icon variant present
- [ ] All mipmap buckets generated (mdpi → xxxhdpi)
- [ ] Splash screen background `#0A0D14`, no flash of white
- [ ] App name "TempoKey" appears under the launcher icon

## 4. UX & content QA

- [ ] No placeholder strings (`TODO`, `lorem ipsum`, `REPLACE`)
- [ ] Empty states are designed (Library empty, no search results, no suggestions)
- [ ] Skeletons play during analysis
- [ ] All screens scroll without clipping on a 360×640 device
- [ ] Tested on a 7" tablet in portrait & landscape
- [ ] Dark mode default; light mode renders without contrast issues
- [ ] All interactive targets ≥ 48 dp
- [ ] Confirm WCAG AA contrast on text vs background

## 5. Functional smoke test

- [ ] Import a folder of 100+ tracks
- [ ] Analysis runs without freezing the UI
- [ ] BPM / key / Camelot displayed with confidence indicator
- [ ] Harmonic Mixing returns suggestions
- [ ] Set Builder saves / loads correctly
- [ ] Smart Rename preview matches actual rename
- [ ] Clear cache from Settings restores empty state
- [ ] App launches offline (airplane mode) with no error

## 6. Privacy & compliance

- [ ] `src/routes/privacy.tsx` reflects the actual app behavior
- [ ] Privacy URL accessible from a public domain (e.g. `https://tempokey.lovable.app/privacy`)
- [ ] Data Safety form filled per `play-store/DATA_SAFETY.md`
- [ ] Content rating questionnaire submitted
- [ ] Target audience set: 18+ (DJ tool)
- [ ] Ads declaration: **No ads**
- [ ] Government app declaration: **No**
- [ ] News app declaration: **No**

## 7. Store listing assets

- [ ] App icon 512×512 (`play-store/icon-512.png`)
- [ ] Feature graphic 1024×500 (`play-store/feature-graphic.jpg`)
- [ ] At least 4 phone screenshots, ≥ 1080 px wide
- [ ] At least 1 tablet screenshot for 7" and 10"
- [ ] Short description (≤ 80 chars) approved
- [ ] Full description (≤ 4000 chars) approved
- [ ] Release notes for this version written

## 8. Release tracks

### Internal testing
- [ ] AAB uploaded to **Internal testing**
- [ ] Internal testers list populated (≤ 100 emails)
- [ ] Install link verified on a real device

### Closed testing (alpha)
- [ ] Promoted from Internal
- [ ] Tester group(s) configured
- [ ] Country availability set
- [ ] First crash-free session rate ≥ 99% over 24h

### Open testing (beta)
- [ ] Promoted from Closed
- [ ] Public opt-in URL shared
- [ ] Feedback channel set (email or form)

### Production
- [ ] Staged rollout: start at 10%
- [ ] Monitor ANR / crash rate via Play Console for 48h
- [ ] Increase rollout to 50% then 100% if metrics are healthy

## 9. Post-release

- [ ] Tag the Git commit (`v<versionName>`)
- [ ] Archive the signed AAB & mapping file in a safe location
- [ ] Update `play-store/STORE_LISTING.md` "What's new" for the next version
