import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useLibraryStore } from "@/lib/library-store";
import { useAnalysisStore } from "@/lib/analysis-store";
import { useOrderingStore } from "@/lib/ordering-store";
import {
  isCapacitorAndroid,
  restoreFilesForLibrary,
} from "@/lib/native/folder-picker";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { TrackList } from "@/components/TrackList";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { RenamePanel } from "@/components/RenamePanel";
import { DuplicatesPanel } from "@/components/DuplicatesPanel";
import { LibraryContextCard } from "@/components/LibraryContextCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/workspace")({
  head: () => ({ meta: [{ title: "Workspace — TempoKey" }] }),
  component: Workspace,
});

type Tab = "library" | "analysis" | "duplicates" | "rename";

function Workspace() {
  const library = useLibraryStore((s) => s.library);
  const hydrated = useLibraryStore((s) => s.hydrated);
  const hydrate = useLibraryStore((s) => s.hydrate);
  const startAnalysis = useAnalysisStore((s) => s.start);
  const running = useAnalysisStore((s) => s.running);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("library");
  // Refs vers chaque bouton onglet pour pouvoir centrer l'onglet actif
  // dans le rail horizontal lorsqu'il devient sélectionné.
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    // `inline: "center"` repositionne le rail pour que l'onglet actif soit
    // toujours visible (et centré quand l'espace le permet), même quand on
    // passe d'un onglet de bord à l'autre.
    el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [tab]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Hydrate ordering once a library is available.
  const hydrateOrder = useOrderingStore((s) => s.hydrate);
  useEffect(() => {
    if (library) void hydrateOrder(library.id);
  }, [library, hydrateOrder]);

  // After cold start, the in-memory file map is empty. On Android, rebuild
  // it from the persisted SAF tree so playback, analysis and renaming all
  // work without asking the user to re-import.
  useEffect(() => {
    if (!library || !isCapacitorAndroid()) return;
    const state = useLibraryStore.getState();
    const hasFile = library.tracks.some((t) => !!state.getFile(t.id));
    if (hasFile) return;
    void restoreFilesForLibrary(library);
  }, [library]);

  useEffect(() => {
    if (hydrated && !library) navigate({ to: "/" });
  }, [hydrated, library, navigate]);

  // Auto-start analysis whenever pending tracks with in-memory file handles exist.
  useEffect(() => {
    if (!library || running) return;
    const getFile = useLibraryStore.getState().getFile;
    const hasWork = library.tracks.some(
      (t) => t.status === "pending" && !!getFile(t.id),
    );
    if (hasWork) void startAnalysis();
  }, [library, running, startAnalysis]);

  if (!library) return null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <WorkspaceHeader />
      <LibraryContextCard />
      <div
        role="tablist"
        className="scrollbar-none sticky z-20 mt-4 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-border bg-background px-4 [scroll-behavior:smooth] [-webkit-overflow-scrolling:touch]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 65px)" }}
      >

        {([
          { id: "library", label: "Bibliothèque" },
          { id: "analysis", label: "Analyse" },
          { id: "duplicates", label: "Doublons" },
          { id: "rename", label: "Renommer" },
        ] as { id: Tab; label: string }[]).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 scroll-mx-6 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[var(--primary-glow)] shadow-[0_0_10px_var(--primary-glow)]" />
              )}
            </button>
          );
        })}
      </div>
      <div key={tab} className="flex flex-1 flex-col min-h-0">
        <ErrorBoundary>
          {tab === "library" && <TrackList />}
          {tab === "analysis" && <AnalysisPanel />}
          {tab === "duplicates" && <DuplicatesPanel />}
          {tab === "rename" && <RenamePanel />}
        </ErrorBoundary>
      </div>
    </div>
  );
}