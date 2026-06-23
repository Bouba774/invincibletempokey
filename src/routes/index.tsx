import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useLibraryStore,
  buildLibraryFromFiles,
  type ImportProgress,
} from "@/lib/library-store";
import { useAnalysisStore } from "@/lib/analysis-store";
import { ImportProgressModal } from "@/components/ImportProgressModal";
import {
  FolderPlus,
  Clock,
  Activity,
  Music2,
  Compass,
  Shuffle,
  ListOrdered,
  Layers,
  Pencil,
  CopyCheck,
  Search,
  ShieldCheck,
  WifiOff,
  Cloud,
  Database,
  Headphones,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import logoUrl from "@/assets/tempokey-logo.png";
import {
  filesFromDirectoryHandle,
  isFsAccessSupported,
  pickDirectoryHandle,
  saveDirectoryHandle,
} from "@/lib/rename/dir-handle";
import {
  isCapacitorAndroid,
  pickAndroidFolder,
  persistAndroidLibrary,
  restoreFilesForLibrary,
} from "@/lib/native/folder-picker";
import { AudioPermissionDialog, type AudioPermissionDialogVariant } from "@/components/AudioPermissionDialog";
import {
  openAndroidAppSettings,
  requestAudioPermission,
} from "@/lib/android-permissions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TempoKey — Analysez et organisez vos bibliothèques DJ" },
      {
        name: "description",
        content:
          "Outil DJ professionnel : analyse BPM, tonalité, Camelot, harmonic mixing et organisation intelligente — 100% local, sans cloud.",
      },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Activity, title: "Détection BPM", desc: "Tempo précis pour chaque morceau." },
  { icon: Music2, title: "Tonalité", desc: "Analyse musicale automatique." },
  { icon: Compass, title: "Notation Camelot", desc: "Roue harmonique standard DJ." },
  { icon: Shuffle, title: "Harmonic Mixing", desc: "Suggestions compatibles en un coup d'œil." },
  { icon: ListOrdered, title: "Auto Mix Order", desc: "Tri intelligent pour enchaîner sans accroc." },
  { icon: Layers, title: "Set Builder", desc: "Warm-up, Peak, Closing structurés." },
  { icon: Pencil, title: "Renommage intelligent", desc: "Templates DJ + undo complet." },
  { icon: CopyCheck, title: "Doublons", desc: "Détection exacte et approximative." },
  { icon: Search, title: "Recherche avancée", desc: "Filtres BPM, clé, durée, mots-clés." },
];

const BENEFITS = [
  { icon: ShieldCheck, label: "100% local" },
  { icon: WifiOff, label: "Aucune connexion" },
  { icon: Cloud, label: "Zéro cloud" },
  { icon: Database, label: "Bibliothèques massives" },
  { icon: Headphones, label: "Pensé pour DJs" },
];

const STEPS = [
  { n: 1, title: "Importez un dossier", desc: "Sélectionnez votre bibliothèque audio locale." },
  { n: 2, title: "Analysez vos morceaux", desc: "BPM, tonalité et Camelot calculés en arrière-plan." },
  { n: 3, title: "Construisez vos mixes", desc: "Auto-order, Set Builder et harmonic mixing." },
];

function Home() {
  const navigate = useNavigate();
  const setLibrary = useLibraryStore((s) => s.setLibrary);
  const setFiles = useLibraryStore((s) => s.setFiles);
  const lastMeta = useLibraryStore((s) => s.lastLibraryMeta);
  const hydrated = useLibraryStore((s) => s.hydrated);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const restoreLast = useLibraryStore((s) => s.restoreLast);
  const resetAnalysis = useAnalysisStore((s) => s.reset);
  const startAnalysis = useAnalysisStore((s) => s.start);
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [permissionDialog, setPermissionDialog] =
    useState<AudioPermissionDialogVariant | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function pickFolder() {
    void openFolderPicker();
  }

  // Platform-routed folder picker:
  //  - Native Android (Capacitor)  → ACTION_OPEN_DOCUMENT_TREE via custom plugin
  //  - Desktop / mobile web        → File System Access API
  //  - Older browsers              → legacy <input webkitdirectory> fallback
  async function openFolderPicker() {
    if (isCapacitorAndroid()) {
      const state = await requestAudioPermission();
      if (state !== "granted") {
        setPermissionDialog(state === "blocked" ? "blocked" : "denied");
        return;
      }
      await openAndroidFolderAfterPermission();
      return;
    }
    if (isFsAccessSupported()) {
      const handle = await pickDirectoryHandle();
      if (!handle) return;
      setProgress({ phase: "scan", scanned: 0, total: 0 });
      try {
        const files = await filesFromDirectoryHandle(handle, (n) =>
          setProgress({ phase: "scan", scanned: n, total: n }),
        );
        const { library: lib, files: fileEntries } = await buildLibraryFromFiles(
          files,
          (p) => setProgress(p),
        );
        if (lib.tracks.length === 0) {
          setProgress(null);
          toast.error("Aucun fichier audio compatible", {
            description: "Formats acceptés : mp3, wav, flac, aac.",
          });
          return;
        }
        resetAnalysis();
        await setLibrary(lib);
        await saveDirectoryHandle(lib.id, handle);
        setFiles(fileEntries);
        setProgress({ phase: "done", scanned: lib.tracks.length, total: lib.tracks.length });
        toast.success(`${lib.tracks.length.toLocaleString()} morceaux importés`, {
          description: lib.name,
        });
        setTimeout(() => {
          setProgress(null);
          navigate({ to: "/workspace" });
          void startAnalysis();
        }, 400);
      } catch (err) {
        console.error(err);
        setProgress(null);
        toast.error("Import impossible", {
          description: "Vérifie que le dossier est accessible et réessaie.",
        });
      }
      return;
    }
    inputRef.current?.click();
  }

  async function openAndroidFolderAfterPermission() {
    setProgress({ phase: "scan", scanned: 0, total: 0 });
    const result = await pickAndroidFolder();
    if (!result) {
      setProgress(null);
      return;
    }
    await importFiles(result.files, result.treeUri);
  }

  async function confirmAndroidPermission() {
    const state = await requestAudioPermission();
    if (state === "granted") {
      setPermissionDialog(null);
      await openAndroidFolderAfterPermission();
      return;
    }
    setPermissionDialog(state === "blocked" ? "blocked" : "denied");
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    await importFiles(files);
  }

  async function importFiles(files: File[], androidTreeUri?: string) {
    setProgress({ phase: "scan", scanned: 0, total: files.length });
    try {
      const { library: lib, files: fileEntries } = await buildLibraryFromFiles(
        files,
        (p) => setProgress(p),
      );
      if (lib.tracks.length === 0) {
        setProgress(null);
        toast.error("Aucun fichier audio compatible", {
          description: "Formats acceptés : mp3, wav, flac, aac.",
        });
        return;
      }
      resetAnalysis();
      await setLibrary(lib);
      if (androidTreeUri) {
        await persistAndroidLibrary(lib.id, androidTreeUri, lib.name, fileEntries);
      }
      setFiles(fileEntries);
      setProgress({ phase: "done", scanned: lib.tracks.length, total: lib.tracks.length });
      toast.success(`${lib.tracks.length.toLocaleString()} morceaux importés`, {
        description: lib.name,
      });
      setTimeout(() => {
        setProgress(null);
        navigate({ to: "/workspace" });
        void startAnalysis();
      }, 400);
    } catch (err) {
      console.error(err);
      setProgress(null);
      toast.error("Import impossible", {
        description: "Vérifie que le dossier est accessible et réessaie.",
      });
    }
  }

  async function openLast() {
    if (await restoreLast()) {
      const lib = useLibraryStore.getState().library;
      if (lib && isCapacitorAndroid()) {
        await restoreFilesForLibrary(lib);
      }
      navigate({ to: "/workspace" });
    }
  }

  const hasRecent = hydrated && !!lastMeta;

  return (
    <main className="min-h-[100dvh] bg-background">
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.aac,audio/*"
        multiple
        /* @ts-expect-error non-standard but widely supported attributes */
        webkitdirectory=""
        directory=""
        onChange={handleFiles}
        className="hidden"
      />
      <AudioPermissionDialog
        open={permissionDialog !== null}
        variant={permissionDialog ?? "request"}
        onCancel={() => setPermissionDialog(null)}
        onConfirm={() => void confirmAndroidPermission()}
        onOpenSettings={() => {
          setPermissionDialog(null);
          void openAndroidAppSettings();
        }}
      />

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-10 pb-8 safe-pt safe-px">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-72 opacity-60"
          style={{ background: "var(--gradient-hero, var(--gradient-primary))" }}
        />
        <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-5 animate-fade-in">
            <img
              src={logoUrl}
              alt="TempoKey"
              className="h-20 w-20 rounded-2xl bg-white object-contain p-2"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface-elevated)]/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--accent)]" />
            Outil DJ · 100% local
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            TempoKey
          </h1>
          <p className="mt-3 text-[15px] font-medium text-foreground/90 leading-relaxed">
            Analysez, organisez et optimisez votre bibliothèque DJ — localement.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Détection BPM, tonalités, Camelot, Harmonic Mixing et organisation intelligente.
          </p>

          <div className="mt-7 w-full max-w-sm space-y-3">
            <button
              onClick={pickFolder}
              className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-[var(--primary-foreground)]"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              <FolderPlus className="h-5 w-5" />
              Importer une bibliothèque audio
            </button>
            <button
              onClick={openLast}
              disabled={!hasRecent}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-[var(--surface-elevated)] text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              {hasRecent ? `Ouvrir « ${lastMeta!.name} »` : "Aucune bibliothèque récente"}
            </button>
          </div>
        </div>
      </section>

      {/* RECENT LIBRARY CARD or ONBOARDING */}
      <section className="px-6">
        <div className="mx-auto max-w-xl">
          {hasRecent ? (
            <button
              onClick={openLast}
              className="group relative w-full overflow-hidden rounded-2xl border border-border bg-[var(--surface-elevated)] p-4 text-left transition-all hover:border-[var(--primary)]/40 hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                style={{ background: "var(--gradient-primary)" }}
              />
              <div className="relative flex items-center gap-3">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--primary-foreground)]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Headphones className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Bibliothèque récente
                  </div>
                  <div className="truncate font-display text-base font-semibold text-foreground">
                    {lastMeta!.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {lastMeta!.trackCount.toLocaleString("fr-FR")} morceaux
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-border bg-[var(--surface-elevated)] p-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Premiers pas
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
                Démarrer en 3 étapes
              </h2>
              <ol className="mt-4 space-y-3">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex items-start gap-3">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold text-[var(--primary-foreground)]"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{s.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{s.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 pt-10">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Fonctionnalités</h2>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Tout en local
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="hover-lift group rounded-xl border border-border bg-[var(--surface-elevated)] p-3 hover:border-[var(--primary)]/40"
                >
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg text-[var(--accent)] transition-colors group-hover:text-[var(--primary-glow)]"
                    style={{
                      background:
                        "color-mix(in oklab, var(--accent) 12%, transparent)",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-2 text-[13px] font-semibold text-foreground">
                    {f.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {f.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="px-6 pt-10 pb-14">
        <div className="mx-auto max-w-xl">
          <div
            className="rounded-2xl border border-border p-5"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, var(--surface-elevated)), var(--surface-elevated))",
            }}
          >
            <h2 className="font-display text-base font-semibold tracking-tight">
              Pourquoi TempoKey
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Un outil pensé pour les DJs qui travaillent avec de grandes collections.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <li
                    key={b.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {b.label}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Vos fichiers ne quittent jamais votre appareil.
          </p>
        </div>
      </section>

      <ImportProgressModal progress={progress} />
    </main>
  );
}
