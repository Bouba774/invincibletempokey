# Mode analyse Android natif en arrière-plan

## Objectif
Sur Android uniquement, l'analyse de la bibliothèque continue lorsque l'app est minimisée / écran verrouillé, avec une notification système persistante (nom de l'app, état, % de progression, X/Y fichiers), basculant en notification de succès/erreur à la fin. La version web et toute la logique d'analyse, d'import, de renommage, de lecture restent inchangées.

## Contrainte technique honnête à valider
Sur Android, lorsque l'écran se verrouille, **le WebView Chromium suspend l'exécution JavaScript** même si un foreground service tourne. L'analyse actuelle (`src/lib/audio/analyzer.ts`) repose sur `AudioContext.decodeAudioData` + FFT JS, qui s'exécutent dans le WebView. Deux options :

- **Option A — Foreground service + WakeLock partiel (recommandé, réaliste)** : un service Android natif démarre, affiche la notification persistante, acquiert un `PARTIAL_WAKE_LOCK` qui maintient le CPU actif. Le WebView reste vivant et continue d'exécuter le JS tant que l'app est en arrière-plan ; quand l'utilisateur verrouille l'écran, le WakeLock empêche le CPU de dormir mais Android peut quand même *throttle* fortement le WebView. En pratique l'analyse continue mais plus lentement écran éteint. C'est ce que font la plupart des apps Capacitor (Spotify-like). Pas de réécriture de l'analyse.
- **Option B — Réécriture native** : porter `bpm.ts` / `key.ts` / `fft.ts` / décodage audio en Kotlin pour exécution 100% native dans le service. ~2–3 semaines de travail, duplication du moteur d'analyse.

Je pars sur **Option A** sauf indication contraire — c'est ce qu'attend un utilisateur "comme un lecteur Android natif" et c'est ce que permet Capacitor sans réécrire le moteur d'analyse.

## Architecture

```text
JS (web + Android)              Plugin Capacitor (Android only)        Service Android natif
─────────────────               ────────────────────────────            ─────────────────────
analysis-store.start()  ──────► AnalysisService.start({total})  ─────► startForeground()
  for each track:                                                       + notification persistante
    analyze (JS)                                                        + PARTIAL_WAKE_LOCK
    updateProgress(done,total) ► AnalysisService.update({done,total,title})
                                                                        notif.setProgress(...)
  on finish/error  ──────────► AnalysisService.finish({ok,msg})  ─────► notif "Bibliothèque prête"
                                                                        ou notif erreur
                                                                        stopForeground()

App rouverte pendant analyse :
analysis-store auto-rehydrate (déjà en mémoire si process vivant ;
  sinon la notif reste comme indicateur).
```

## Étapes d'implémentation

### 1. Plugin Capacitor natif `AnalysisNotification` (Android only)
- `android/app/src/main/java/.../analysis/AnalysisNotificationPlugin.kt` (Kotlin) — méthodes `start`, `update`, `finish`, `cancel`, `getCurrentState`.
- `android/app/src/main/java/.../analysis/AnalysisForegroundService.kt` — service `FOREGROUND_SERVICE_TYPE_DATA_SYNC` (Android 14+), gère :
  - création du canal de notification `tempokey_analysis` (importance LOW, pas de son).
  - notification `NotificationCompat.Builder` avec `setOngoing(true)`, `setProgress(total, done, false)`, contenu "Analyse en cours · X / Y morceaux".
  - acquisition / libération `PowerManager.PARTIAL_WAKE_LOCK`.
  - état persistant en mémoire singleton pour `getCurrentState` au rattachement.
- Wrapper JS `src/lib/native/analysis-notification.ts` — détecte `Capacitor.isNativePlatform()` ; sur web, no-op (toutes les méthodes résolvent immédiatement).

### 2. Permissions Android
Ajouter dans `android/app/src/main/AndroidManifest.xml` (via le script `scripts/prepare-android.sh` déjà utilisé) :
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_DATA_SYNC` (Android 14+)
- `POST_NOTIFICATIONS` (Android 13+) — demandée à la première analyse uniquement.
- `WAKE_LOCK`
- Déclaration du `<service android:name=".analysis.AnalysisForegroundService" android:foregroundServiceType="dataSync" />`.

La permission `POST_NOTIFICATIONS` est demandée juste avant `start()` la première fois (similaire au pattern existant `android-permissions.ts`). Si refusée, l'analyse continue sans notification (au premier plan uniquement) avec un toast informatif.

### 3. Intégration `analysis-store.ts`
Branchements minimaux, sans toucher au pipeline d'analyse :
- `start()` / `reanalyzeIds()` / `reanalyzeAll()` : après l'init du state, appeler `analysisNotification.start({ total })`.
- Dans `runQueue` worker, après chaque `setState({ done })`, appeler `analysisNotification.update({ done, total, currentTitle })` (debounce ~250 ms côté JS pour ne pas spammer le binder).
- En fin de queue (succès) : `analysisNotification.finish({ ok: true, message: 'Bibliothèque prête' })`.
- En cas d'`abort` ou d'erreur globale : `finish({ ok: false, message })`.
- Sur web, le wrapper est no-op : zéro impact.

### 4. Reprise au retour au premier plan
- Sur `App` resume (listener Capacitor `App.addListener('appStateChange')`), si `useAnalysisStore.getState().running === true` → ne rien faire (l'UI lit déjà le store).
- Si le process a été tué et que la notif existe encore : le state JS est perdu, on affiche un toast "Reprenez l'analyse" et la notif sera nettoyée par le service au prochain `start()`. (Reprendre une analyse après kill = nécessiterait persistance du queue state ; hors scope, à valider si nécessaire.)

### 5. Web inchangé
- Le wrapper renvoie immédiatement sur web (`!Capacitor.isNativePlatform()`).
- Aucun composant UI modifié, aucun changement de styles.
- `AnalysisPanel.tsx` continue d'afficher la progression in-app comme aujourd'hui.

## Détails techniques

- Fichiers JS créés : `src/lib/native/analysis-notification.ts` (~80 lignes).
- Fichiers JS modifiés : `src/lib/analysis-store.ts` (5 sites d'appel + debounce update).
- Fichiers natifs créés : 2 fichiers Kotlin (~250 lignes) + enregistrement du plugin dans `MainActivity`.
- `scripts/prepare-android.sh` : ajout des permissions + déclaration du service dans le manifest.
- `capacitor.config.ts` : aucun changement requis.
- Pas de nouvelle dépendance npm (plugin écrit en local dans le projet Android).
- Type-check : `tsgo --noEmit` après modifs JS.

## Hors scope (à confirmer si nécessaire plus tard)
- Reprise après kill du process : nécessiterait de sérialiser la queue + relancer côté JS au prochain démarrage.
- Action "Annuler" dans la notification : faisable mais ajoute un PendingIntent + listener côté JS (~30 min de travail supplémentaire).
- iOS : non concerné (la demande est explicitement Android).

Confirme l'**Option A** et je passe à l'implémentation.